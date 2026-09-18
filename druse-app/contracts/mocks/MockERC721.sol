// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Mintable ERC-721 collection for testnet vaults.
contract MockERC721 is ERC721 {
    uint256 public nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
        if (tokenId >= nextId) nextId = tokenId + 1;
    }

    function mintTo(address to) external returns (uint256 tokenId) {
        tokenId = nextId;
        unchecked {
            nextId = tokenId + 1;
        }
        _mint(to, tokenId);
    }

    function mintBatch(address to, uint256 startId, uint256 count) external {
        for (uint256 i; i < count; ) {
            uint256 tokenId = startId + i;
            _mint(to, tokenId);
            if (tokenId >= nextId) nextId = tokenId + 1;
            unchecked {
                ++i;
            }
        }
    }
}
