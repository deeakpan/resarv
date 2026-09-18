// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/// @dev Minimal Uniswap V4 types used by DruseHook / PoolLauncher.

type Currency is address;

interface IHooks {}

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    IHooks hooks;
}

type PoolId is bytes32;

library PoolIdLibrary {
    function toId(PoolKey memory poolKey) internal pure returns (PoolId poolId) {
        assembly {
            poolId := keccak256(poolKey, 0xa0)
        }
    }
}

type BeforeSwapDelta is int256;

library BeforeSwapDeltaLibrary {
    BeforeSwapDelta public constant ZERO_DELTA = BeforeSwapDelta.wrap(0);

    function toBeforeSwapDelta(
        int128 deltaSpecified,
        int128 deltaUnspecified
    ) internal pure returns (BeforeSwapDelta) {
        return
            BeforeSwapDelta.wrap(
                int256(deltaSpecified) << 128 |
                    int256(uint256(uint128(deltaUnspecified)))
            );
    }
}

type BalanceDelta is int256;

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    function initialize(
        PoolKey memory key,
        uint160 sqrtPriceX96
    ) external returns (int24 tick);

    function take(Currency currency, address to, uint256 amount) external;

    function extsload(bytes32 slot) external view returns (bytes32);
}
