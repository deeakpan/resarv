// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IEligibilityManager {
    function deployEligibility(uint256 moduleIndex, bytes calldata initData)
        external
        returns (address);
}
