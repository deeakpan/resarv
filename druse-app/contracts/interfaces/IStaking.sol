// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStaking {
    function notifyRewardAmount(uint256 amount) external;

    function totalStaked() external view returns (uint256);
}
