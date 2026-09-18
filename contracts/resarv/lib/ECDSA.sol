// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @dev Minimal ECDSA (OpenZeppelin-style) for signature recovery.
 */
library ECDSA {
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "ECDSA: length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "ECDSA: v");

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ECDSA: invalid");
        return signer;
    }
}
