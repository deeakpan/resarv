// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFeeSplit} from "../interfaces/IFeeSplit.sol";
import {IWETH9} from "../interfaces/external/IWETH9.sol";
import {Oracle} from "../lib/oracle/Oracle.sol";
import {
    IPoolManager,
    PoolKey,
    PoolId,
    PoolIdLibrary,
    Currency,
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary
} from "./v4/Types.sol";
import {StateLibrary} from "./v4/StateLibrary.sol";

/// @notice Uniswap v4 hook: V3-style TWAP oracle + extra 1% WETH to FeeSplit (60/30/10).
/// CREATE2 address flags: afterInitialize | beforeSwap | beforeSwapReturnDelta (0x1088).
/// Oracle writes at most once per block (same gas profile as Uniswap V3).
contract DruseHook {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using Oracle for Oracle.Observation[65535];

    uint256 public constant HOOK_FEE_PIPS = 10_000; // 1%
    uint256 public constant PIPS_DENOM = 1_000_000;
    /// @dev AFTER_INITIALIZE (1<<12) | BEFORE_SWAP (1<<7) | BEFORE_SWAP_RETURNS_DELTA (1<<3)
    uint160 public constant HOOK_FLAGS = 0x1088;

    IPoolManager public immutable poolManager;
    IFeeSplit public immutable feeSplit;
    IWETH9 public immutable WETH;
    address public immutable launcher;

    struct ObservationState {
        uint16 index;
        uint16 cardinality;
        uint16 cardinalityNext;
    }

    mapping(PoolId => Oracle.Observation[65535]) internal _observations;
    mapping(PoolId => ObservationState) public observationStates;

    error NotPoolManager();
    error InvalidHookAddress();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(
        IPoolManager poolManager_,
        IFeeSplit feeSplit_,
        IWETH9 weth_,
        address launcher_
    ) {
        if (uint160(address(this)) & uint160((1 << 14) - 1) != HOOK_FLAGS) {
            revert InvalidHookAddress();
        }
        poolManager = poolManager_;
        feeSplit = feeSplit_;
        WETH = weth_;
        launcher = launcher_;
    }

    function afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24
    ) external onlyPoolManager returns (bytes4) {
        PoolId id = key.toId();
        ObservationState storage state = observationStates[id];
        state.cardinality = _observations[id].initialize(uint32(block.timestamp));
        state.cardinalityNext = 1;
        return this.afterInitialize.selector;
    }

    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        _writeOracle(key);

        bool exactIn = params.amountSpecified < 0;
        Currency specified = params.zeroForOne ? key.currency0 : key.currency1;

        if (exactIn && Currency.unwrap(specified) == address(WETH)) {
            uint256 input = uint256(-params.amountSpecified);
            uint256 fee = (input * HOOK_FEE_PIPS) / PIPS_DENOM;
            if (fee > 0) {
                poolManager.take(specified, address(this), fee);
                _forwardWeth(fee);
                return (
                    this.beforeSwap.selector,
                    BeforeSwapDeltaLibrary.toBeforeSwapDelta(int128(int256(fee)), 0),
                    0
                );
            }
        }

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @notice Same as Uniswap V3 `observe(secondsAgos)` — one hook serves every pool.
    function observe(PoolKey calldata key, uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        PoolId id = key.toId();
        ObservationState storage state = observationStates[id];
        (, int24 tick, , ) = StateLibrary.getSlot0(poolManager, id);
        uint128 liquidity = StateLibrary.getLiquidity(poolManager, id);
        return _observations[id].observe(
            uint32(block.timestamp),
            secondsAgos,
            tick,
            state.index,
            liquidity,
            state.cardinality
        );
    }

    function observations(PoolId id, uint256 index)
        external
        view
        returns (
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulativeX128,
            bool initialized
        )
    {
        Oracle.Observation storage o = _observations[id][index];
        return (
            o.blockTimestamp,
            o.tickCumulative,
            o.secondsPerLiquidityCumulativeX128,
            o.initialized
        );
    }

    /// @notice Same as Uniswap V3 `increaseObservationCardinalityNext`. Caller pays the SSTOREs.
    function increaseObservationCardinalityNext(
        PoolKey calldata key,
        uint16 observationCardinalityNext
    ) external {
        PoolId id = key.toId();
        ObservationState storage state = observationStates[id];
        uint16 next = _observations[id].grow(
            state.cardinalityNext,
            observationCardinalityNext,
            true
        );
        state.cardinalityNext = next;
    }

    function _writeOracle(PoolKey calldata key) internal {
        PoolId id = key.toId();
        ObservationState storage state = observationStates[id];
        (, int24 tick, , ) = StateLibrary.getSlot0(poolManager, id);
        uint128 liquidity = StateLibrary.getLiquidity(poolManager, id);
        (state.index, state.cardinality) = _observations[id].write(
            state.index,
            uint32(block.timestamp),
            tick,
            liquidity,
            state.cardinality,
            state.cardinalityNext
        );
    }

    function _forwardWeth(uint256 amount) internal {
        IERC20(address(WETH)).safeApprove(address(feeSplit), amount);
        feeSplit.split(amount);
    }
}
