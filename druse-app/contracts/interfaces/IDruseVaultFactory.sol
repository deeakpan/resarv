// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IBeacon} from "../custom/proxy/IBeacon.sol";

interface IDruseVaultFactory is IBeacon {
    // =============================================================
    //                            STRUCTS
    // =============================================================

    struct VaultFees {
        bool active;
        uint64 mintFee;
        uint64 redeemFee;
        uint64 swapFee;
    }

    // =============================================================
    //                            VARIABLES
    // =============================================================

    function feeSplit() external view returns (address);

    function eligibilityManager() external view returns (address);

    function excludedFromFees(address addr) external view returns (bool);

    function isOperator(address account) external view returns (bool);

    function factoryMintFee() external view returns (uint64);

    function factoryRedeemFee() external view returns (uint64);

    function factorySwapFee() external view returns (uint64);

    function twapInterval() external view returns (uint32);

    function premiumDuration() external view returns (uint256);

    function premiumMax() external view returns (uint256);

    function depositorPremiumShare() external view returns (uint256);

    function poolOracle() external view returns (address);

    // =============================================================
    //                            EVENTS
    // =============================================================

    event NewFeeSplit(address oldSplit, address newSplit);
    event FeeExclusion(address feeExcluded, bool excluded);
    event NewEligibilityManager(address oldEligManager, address newEligManager);
    event NewVault(
        uint256 indexed vaultId,
        address vaultAddress,
        address assetAddress,
        string name,
        string symbol
    );
    event UpdateVaultFees(
        uint256 vaultId,
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    );
    event DisableVaultFees(uint256 vaultId);
    event UpdateFactoryFees(
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    );
    event NewPremiumMax(uint256 premiumMax);
    event NewPremiumDuration(uint256 premiumDuration);
    event NewDepositorPremiumShare(uint256 depositorPremiumShare);
    event NewTwapInterval(uint32 twapInterval);
    event OperatorSet(address indexed account, bool allowed);

    // =============================================================
    //                            ERRORS
    // =============================================================

    error FeeSplitNotSet();
    error VaultImplementationNotSet();
    error FeeExceedsLimit();
    error CallerIsNotVault();
    error ZeroTwapInterval();
    error DepositorPremiumShareExceedsLimit();
    error ZeroAddress();
    error ZeroAmountRequested();
    error NFTInventoryExceeded();
    error NotOperator();

    // =============================================================
    //                           INIT
    // =============================================================

    function __DruseVaultFactory_init(
        address vaultImpl,
        uint32 twapInterval_,
        uint256 premiumDuration_,
        uint256 premiumMax_,
        uint256 depositorPremiumShare_
    ) external;

    // =============================================================
    //                     ONLY PRIVILEGED WRITE
    // =============================================================

    function setFactoryFees(
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    ) external;

    function setVaultFees(
        uint256 vaultId,
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    ) external;

    function disableVaultFees(uint256 vaultId) external;

    function setFeeSplit(address feeSplit_) external;

    function setFeeExclusion(address excludedAddr, bool excluded) external;

    function setEligibilityManager(address eligibilityManager_) external;

    function setTwapInterval(uint32 twapInterval_) external;

    function setPremiumDuration(uint256 premiumDuration_) external;

    function setPremiumMax(uint256 premiumMax_) external;

    function setDepositorPremiumShare(uint256 depositorPremiumShare_) external;

    function setPoolOracle(address poolOracle_) external;

    function setOperator(address account, bool allowed) external;

    // =============================================================
    //                     PUBLIC / EXTERNAL WRITE
    // =============================================================

    /// @notice Operator or factory owner. Deploys an empty vault. No NFT is deposited.
    function createVault(
        string calldata name,
        string calldata symbol,
        address assetAddress,
        bool is1155,
        bool allowAllItems
    ) external returns (uint256 vaultId);

    // =============================================================
    //                     PUBLIC / EXTERNAL VIEW
    // =============================================================

    function vaultFees(
        uint256 vaultId
    )
        external
        view
        returns (uint256 mintFee, uint256 redeemFee, uint256 swapFee);

    function isLocked(uint256 id) external view returns (bool);

    function vaultsForAsset(
        address asset
    ) external view returns (address[] memory);

    function allVaults() external view returns (address[] memory);

    function numVaults() external view returns (uint256);

    function vault(uint256 vaultId) external view returns (address);

    function computeVaultAddress(
        address assetAddress,
        string memory name,
        string memory symbol
    ) external view returns (address);

    function getTwapX96(address pToken) external view returns (uint256 priceX96);

    /**
     * @notice Get pTOKEN premium corresponding for a tokenId in the vault
     *
     * @param tokenId token id to calculate the premium for
     * @return premium Premium in pTOKEN
     * @return depositor Depositor that receives a share of this premium
     */
    function getPTokenPremium721(
        uint256 vaultId,
        uint256 tokenId
    ) external view returns (uint256 premium, address depositor);

    /**
     * @notice Get pTOKEN premium corresponding for a tokenId in the vault
     *
     * @param tokenId token id to calculate the premium for
     * @param amount ERC1155 amount of tokenId to redeem
     *
     * @return totalPremium Total premium in pTOKEN
     * @return premiums Premiums corresponding to each depositor
     * @return depositors Depositors that receive a share from the `premiums`
     */
    function getPTokenPremium1155(
        uint256 vaultId,
        uint256 tokenId,
        uint256 amount
    )
        external
        view
        returns (
            uint256 totalPremium,
            uint256[] memory premiums,
            address[] memory depositors
        );
}
