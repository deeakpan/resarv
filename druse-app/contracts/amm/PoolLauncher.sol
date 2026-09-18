// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolOracle} from "../interfaces/IPoolOracle.sol";
import {FullMath} from "../lib/math/FullMath.sol";
import {FixedPoint96} from "../lib/math/FixedPoint96.sol";
import {TickMath} from "../lib/math/TickMath.sol";
import {
    IPoolManager,
    PoolKey,
    PoolId,
    PoolIdLibrary,
    Currency,
    IHooks
} from "./v4/Types.sol";

interface IOperatorAuth {
    function owner() external view returns (address);
    function isOperator(address account) external view returns (bool);
}

interface ITwapInterval {
    function twapInterval() external view returns (uint32);
}

interface IDruseOracle {
    function observe(PoolKey calldata key, uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        );

    function observationStates(PoolId id)
        external
        view
        returns (uint16 index, uint16 cardinality, uint16 cardinalityNext);

    function observations(PoolId id, uint256 index)
        external
        view
        returns (
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulativeX128,
            bool initialized
        );
}

/// @notice Creates Uniswap v4 pTOKEN/WETH pools (1% LP fee, tickSpacing 200) with DruseHook.
contract PoolLauncher is IPoolOracle, Ownable {
    using PoolIdLibrary for PoolKey;

    uint24 public constant LP_FEE = 10_000; // 1%
    int24 public constant TICK_SPACING = 200;

    IPoolManager public immutable poolManager;
    address public immutable WETH;
    address public hook;
    address public factory;

    mapping(address => PoolKey) public poolKeys;
    mapping(address => uint160) public sqrtPriceX96Of;

    error HookAlreadySet();
    error ZeroAddress();
    error PoolExists();
    error NotOperator();

    event HookSet(address indexed hook);
    event FactorySet(address indexed factory);
    event PoolCreated(address indexed pToken, bytes32 poolId, uint160 sqrtPriceX96);

    modifier onlyOperator() {
        if (!_isOperator(msg.sender)) revert NotOperator();
        _;
    }

    constructor(IPoolManager poolManager_, address weth_) {
        if (address(poolManager_) == address(0) || weth_ == address(0)) {
            revert ZeroAddress();
        }
        poolManager = poolManager_;
        WETH = weth_;
    }

    function setHook(address hook_) external onlyOwner {
        if (hook != address(0)) revert HookAlreadySet();
        if (hook_ == address(0)) revert ZeroAddress();
        hook = hook_;
        emit HookSet(hook_);
    }

    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function createPool(address pToken, uint160 sqrtPriceX96) external onlyOperator returns (PoolKey memory key) {
        if (pToken == address(0) || pToken == WETH) revert ZeroAddress();
        if (Currency.unwrap(poolKeys[pToken].currency0) != address(0)) revert PoolExists();
        if (hook == address(0)) revert ZeroAddress();

        address token0 = pToken < WETH ? pToken : WETH;
        address token1 = pToken < WETH ? WETH : pToken;

        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hook)
        });

        poolManager.initialize(key, sqrtPriceX96);
        poolKeys[pToken] = key;
        sqrtPriceX96Of[pToken] = sqrtPriceX96;

        emit PoolCreated(pToken, PoolId.unwrap(key.toId()), sqrtPriceX96);
    }

    /// @notice NFTX `getTwapX96` verbatim: observe([twapInterval, 0]), else oldest observation, else 0.
    /// Returns token1/token0 priceX96 (vault inverts if pTOKEN is token1).
    function getPriceX96(address pToken) external view override returns (uint256 priceX96) {
        PoolKey memory key = poolKeys[pToken];
        if (Currency.unwrap(key.currency0) == address(0)) return 0;

        uint32 interval = _twapInterval();
        if (interval == 0) return 0;

        // secondsAgos[0] (from [before]) -> secondsAgos[1] (to [now])
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = interval;
        secondsAgos[1] = 0;

        (bool success, bytes memory data) = hook.staticcall(
            abi.encodeWithSelector(IDruseOracle.observe.selector, key, secondsAgos)
        );

        // observe might fail for newly created pools that don't have sufficient observations yet
        if (!success) {
            // observations = [0, 1, 2, ..., index, (index + 1), ..., (cardinality - 1)]
            // Case 1: if entire array initialized once, then oldest observation at (index + 1) % cardinality
            // Case 2: array only initialized till index, then oldest obseravtion at index 0

            PoolId id = key.toId();
            (uint16 index, uint16 cardinality, ) = IDruseOracle(hook)
                .observationStates(id);
            if (cardinality == 0) return 0;

            (
                uint32 oldestAvailableTimestamp,
                ,
                ,
                bool initialized
            ) = IDruseOracle(hook).observations(id, (index + 1) % cardinality);

            // Case 2
            if (!initialized)
                (oldestAvailableTimestamp, , , ) = IDruseOracle(hook)
                    .observations(id, 0);

            // get corresponding observation
            secondsAgos[0] = uint32(block.timestamp - oldestAvailableTimestamp);
            (success, data) = hook.staticcall(
                abi.encodeWithSelector(IDruseOracle.observe.selector, key, secondsAgos)
            );
            // might revert if oldestAvailableTimestamp == block.timestamp, so we return price as 0
            if (!success || secondsAgos[0] == 0) {
                return 0;
            }
        }

        int56[] memory tickCumulatives = abi.decode(data, (int56[])); // don't bother decoding the liquidityCumulatives array

        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(
            int24(
                (tickCumulatives[1] - tickCumulatives[0]) /
                    int56(int32(secondsAgos[0]))
            )
        );
        priceX96 = FullMath.mulDiv(
            sqrtPriceX96,
            sqrtPriceX96,
            FixedPoint96.Q96
        );
    }

    function _twapInterval() internal view returns (uint32) {
        try ITwapInterval(msg.sender).twapInterval() returns (uint32 interval) {
            return interval;
        } catch {
            return 0;
        }
    }

    function _isOperator(address account) internal view returns (bool) {
        if (account == owner()) return true;
        if (factory == address(0)) return false;
        IOperatorAuth auth = IOperatorAuth(factory);
        return account == auth.owner() || auth.isOperator(account);
    }
}
