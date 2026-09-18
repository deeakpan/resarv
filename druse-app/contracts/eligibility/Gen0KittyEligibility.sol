// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Eligibility.sol";

interface KittyCore {
    function ownerOf(uint256 _tokenId) external view returns (address owner);

    function getKitty(
        uint256 _id
    )
        external
        view
        returns (
            bool,
            bool,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256 _generation,
            uint256
        );
}

contract Gen0KittyEligibility is Eligibility {
    function name() public pure virtual override returns (string memory) {
        return "Gen0Kitty";
    }

    function finalized() public view virtual override returns (bool) {
        return true;
    }

    function targetAsset() public pure virtual override returns (address) {
        return 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
    }

    event EligibilityInit();

    function __Eligibility_init_bytes(
        bytes memory /* configData */
    ) public virtual override initializer {
        __Eligibility_init();
    }

    // Parameters here should mirror the config struct.
    function __Eligibility_init() public initializer {
        emit EligibilityInit();
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view virtual override returns (bool) {
        (, , , , , , , , uint256 _generation, ) = KittyCore(targetAsset())
            .getKitty(_tokenId);
        return _generation == 0;
    }
}
