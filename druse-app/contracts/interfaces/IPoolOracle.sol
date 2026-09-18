// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPoolOracle {
    function getPriceX96(address pToken) external view returns (uint256 priceX96);
}
