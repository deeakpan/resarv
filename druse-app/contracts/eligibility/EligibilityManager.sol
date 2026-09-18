// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import {IEligibility} from "../interfaces/IEligibility.sol";
import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract EligibilityManager is OwnableUpgradeable {
    struct EligibilityModule {
        address implementation;
        address targetAsset;
        string name;
    }
    EligibilityModule[] public modules;

    event ModuleAdded(
        address implementation,
        address targetAsset,
        string name,
        bool finalizedOnDeploy
    );
    event ModuleUpdated(
        address implementation,
        string name,
        bool finalizedOnDeploy
    );

    function __EligibilityManager_init() public initializer {
        __Ownable_init();
    }

    function addModule(address implementation) external onlyOwner {
        require(implementation != address(0), "Impl != address(0)");
        IEligibility elig = IEligibility(implementation);
        string memory name = elig.name();
        EligibilityModule memory module = EligibilityModule(
            implementation,
            elig.targetAsset(),
            name
        );
        modules.push(module);
        emit ModuleAdded(
            implementation,
            module.targetAsset,
            name,
            elig.finalized()
        );
    }

    function updateModule(
        uint256 moduleIndex,
        address implementation
    ) external onlyOwner {
        require(moduleIndex < modules.length, "Out of bounds");
        require(implementation != address(0), "Impl != address(0)");
        modules[moduleIndex].implementation = implementation;
        IEligibility elig = IEligibility(implementation);
        emit ModuleUpdated(implementation, elig.name(), elig.finalized());
    }

    function deployEligibility(
        uint256 moduleIndex,
        bytes calldata configData
    ) external virtual returns (address) {
        require(moduleIndex < modules.length, "Out of bounds");
        address eligImpl = modules[moduleIndex].implementation;
        address eligibilityClone = ClonesUpgradeable.clone(eligImpl);
        IEligibility(eligibilityClone).__Eligibility_init_bytes(
            configData
        );
        return eligibilityClone;
    }

    function allModules() external view returns (EligibilityModule[] memory) {
        return modules;
    }

    function allModuleNames() external view returns (string[] memory) {
        EligibilityModule[] memory modulesCopy = modules;
        string[] memory names = new string[](modulesCopy.length);
        for (uint256 i = 0; i < modulesCopy.length; i++) {
            names[i] = modulesCopy[i].name;
        }
        return names;
    }
}
