// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IPoolManager, PoolId} from "./Types.sol";

/// @dev Uniswap v4 PoolManager slot readers (POOLS_SLOT = 6), copied from v4-core StateLibrary.
library StateLibrary {
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));
    uint256 internal constant LIQUIDITY_OFFSET = 3;

    function getSlot0(IPoolManager manager, PoolId poolId)
        internal
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
    {
        bytes32 data = manager.extsload(_getPoolStateSlot(poolId));
        assembly {
            sqrtPriceX96 := and(data, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            tick := signextend(2, shr(160, data))
            protocolFee := and(shr(184, data), 0xFFFFFF)
            lpFee := and(shr(208, data), 0xFFFFFF)
        }
    }

    function getLiquidity(IPoolManager manager, PoolId poolId)
        internal
        view
        returns (uint128 liquidity)
    {
        bytes32 slot = bytes32(uint256(_getPoolStateSlot(poolId)) + LIQUIDITY_OFFSET);
        liquidity = uint128(uint256(manager.extsload(slot)));
    }

    function _getPoolStateSlot(PoolId poolId) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
    }
}
