// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/// @notice CREATE2 factory so DruseHook can be mined to a Uniswap v4 flag address.
contract Create2Deployer {
    error DeployFailed();

    event Deployed(address indexed addr, bytes32 salt);

    function deploy(bytes32 salt, bytes memory bytecode) external returns (address addr) {
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (addr == address(0)) revert DeployFailed();
        emit Deployed(addr, salt);
    }
}
