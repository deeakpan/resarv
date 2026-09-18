// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFeeSplit {
    function split(uint256 wethAmount) external;

    function staking() external view returns (address);

    function setStaking(address staking_) external;
}
