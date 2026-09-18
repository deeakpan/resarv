// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

// inheriting
import {UpgradeableBeacon} from "./custom/proxy/UpgradeableBeacon.sol";
import {PausableUpgradeable} from "./custom/PausableUpgradeable.sol";

import {ExponentialPremium} from "./lib/ExponentialPremium.sol";
import {Create2Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Create2Upgradeable.sol";

import {Create2BeaconProxy} from "./custom/proxy/Create2BeaconProxy.sol";
import {DruseVault} from "./DruseVault.sol";

import {IDruseVault} from "./interfaces/IDruseVault.sol";
import {IPoolOracle} from "./interfaces/IPoolOracle.sol";
import {IDruseVaultFactory} from "./interfaces/IDruseVaultFactory.sol";

contract DruseVaultFactory is
    IDruseVaultFactory,
    PausableUpgradeable,
    UpgradeableBeacon
{
    // =============================================================
    //                            CONSTANTS
    // =============================================================
    uint256 constant MAX_DEPOSITOR_PREMIUM_SHARE = 1 ether;
    bytes internal constant BEACON_CODE = type(Create2BeaconProxy).creationCode;

    // =============================================================
    //                            VARIABLES
    // =============================================================

    address public override feeSplit;
    address public override eligibilityManager;

    mapping(address => address[]) internal _vaultsForAsset;

    address[] internal _vaults;

    mapping(address => bool) public override excludedFromFees;
    mapping(address => bool) public override isOperator;

    mapping(uint256 => VaultFees) internal _vaultFees;

    uint64 public override factoryMintFee;
    uint64 public override factoryRedeemFee;
    uint64 public override factorySwapFee;

    uint32 public override twapInterval;
    // time during which a deposited tokenId incurs premium during withdrawal from the vault
    uint256 public override premiumDuration;
    // max premium value in pTOKEN when NFT just deposited
    uint256 public override premiumMax;
    // fraction in wei, what portion of the premium to send to the NFT depositor
    uint256 public override depositorPremiumShare;
    address public override poolOracle;

    modifier onlyOperator() {
        if (msg.sender != owner() && !isOperator[msg.sender]) revert NotOperator();
        _;
    }

    // =============================================================
    //                           INIT
    // =============================================================

    function __DruseVaultFactory_init(
        address vaultImpl,
        uint32 twapInterval_,
        uint256 premiumDuration_,
        uint256 premiumMax_,
        uint256 depositorPremiumShare_
    ) public override initializer {
        __Pausable_init();
        // We use a beacon proxy so that every child contract follows the same implementation code.
        __UpgradeableBeacon__init(vaultImpl);
        setFactoryFees(0.01 ether, 0.01 ether, 0.01 ether);

        if (twapInterval_ == 0) revert ZeroTwapInterval();
        if (depositorPremiumShare_ > MAX_DEPOSITOR_PREMIUM_SHARE)
            revert DepositorPremiumShareExceedsLimit();

        twapInterval = twapInterval_;
        premiumDuration = premiumDuration_;
        premiumMax = premiumMax_;
        depositorPremiumShare = depositorPremiumShare_;
    }

    // =============================================================
    //                     PUBLIC / EXTERNAL WRITE
    // =============================================================

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function createVault(
        string memory name,
        string memory symbol,
        address assetAddress,
        bool is1155,
        bool allowAllItems
    ) external override onlyOperator returns (uint256 vaultId) {
        if (feeSplit == address(0)) revert FeeSplitNotSet();
        if (implementation() == address(0)) revert VaultImplementationNotSet();

        address vaultAddr = _deployVault(
            name,
            symbol,
            assetAddress,
            is1155,
            allowAllItems
        );

        vaultId = _vaults.length;
        _vaultsForAsset[assetAddress].push(vaultAddr);
        _vaults.push(vaultAddr);

        emit NewVault(vaultId, vaultAddr, assetAddress, name, symbol);
    }

    // =============================================================
    //                     ONLY PRIVILEGED WRITE
    // =============================================================

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setFactoryFees(
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    ) public override onlyOwner {
        if (mintFee > 0.5 ether) revert FeeExceedsLimit();
        if (redeemFee > 0.5 ether) revert FeeExceedsLimit();
        if (swapFee > 0.5 ether) revert FeeExceedsLimit();

        factoryMintFee = uint64(mintFee);
        factoryRedeemFee = uint64(redeemFee);
        factorySwapFee = uint64(swapFee);

        emit UpdateFactoryFees(mintFee, redeemFee, swapFee);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setVaultFees(
        uint256 vaultId,
        uint256 mintFee,
        uint256 redeemFee,
        uint256 swapFee
    ) external override {
        if (msg.sender != owner()) {
            address vaultAddr = _vaults[vaultId];
            if (msg.sender != vaultAddr) revert CallerIsNotVault();
        }
        if (mintFee > 0.5 ether) revert FeeExceedsLimit();
        if (redeemFee > 0.5 ether) revert FeeExceedsLimit();
        if (swapFee > 0.5 ether) revert FeeExceedsLimit();

        _vaultFees[vaultId] = VaultFees(
            true,
            uint64(mintFee),
            uint64(redeemFee),
            uint64(swapFee)
        );
        emit UpdateVaultFees(vaultId, mintFee, redeemFee, swapFee);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function disableVaultFees(uint256 vaultId) external override {
        if (msg.sender != owner()) {
            address vaultAddr = _vaults[vaultId];
            if (msg.sender != vaultAddr) revert CallerIsNotVault();
        }
        delete _vaultFees[vaultId];
        emit DisableVaultFees(vaultId);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setFeeSplit(address feeSplit_) external override onlyOwner {
        if (feeSplit_ == address(0)) revert ZeroAddress();

        emit NewFeeSplit(feeSplit, feeSplit_);
        feeSplit = feeSplit_;
    }

    function setOperator(address account, bool allowed) external override onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isOperator[account] = allowed;
        emit OperatorSet(account, allowed);
    }

    function setPoolOracle(address poolOracle_) external override onlyOwner {
        poolOracle = poolOracle_;
    }

    /**
     * @inheritdoc IDruseVaultFactory
     * @dev Whitelisted addresses mint and redeem NFTs with no vault fee or snipe premium.
     */
    function setFeeExclusion(
        address excludedAddr,
        bool excluded
    ) external override onlyOwner {
        if (excludedAddr == address(0)) revert ZeroAddress();
        excludedFromFees[excludedAddr] = excluded;
        emit FeeExclusion(excludedAddr, excluded);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setEligibilityManager(
        address eligibilityManager_
    ) external override onlyOwner {
        emit NewEligibilityManager(eligibilityManager, eligibilityManager_);
        eligibilityManager = eligibilityManager_;
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setTwapInterval(uint32 twapInterval_) external override onlyOwner {
        if (twapInterval_ == 0) revert ZeroTwapInterval();

        twapInterval = twapInterval_;

        emit NewTwapInterval(twapInterval_);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setPremiumDuration(
        uint256 premiumDuration_
    ) external override onlyOwner {
        premiumDuration = premiumDuration_;

        emit NewPremiumDuration(premiumDuration_);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setPremiumMax(uint256 premiumMax_) external override onlyOwner {
        premiumMax = premiumMax_;

        emit NewPremiumMax(premiumMax_);
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function setDepositorPremiumShare(
        uint256 depositorPremiumShare_
    ) external override onlyOwner {
        if (depositorPremiumShare_ > MAX_DEPOSITOR_PREMIUM_SHARE)
            revert DepositorPremiumShareExceedsLimit();

        depositorPremiumShare = depositorPremiumShare_;

        emit NewDepositorPremiumShare(depositorPremiumShare_);
    }

    // =============================================================
    //                     PUBLIC / EXTERNAL VIEW
    // =============================================================

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function vaultFees(
        uint256 vaultId
    )
        external
        view
        override
        returns (uint256 mintFee, uint256 redeemFee, uint256 swapFee)
    {
        VaultFees memory fees = _vaultFees[vaultId];
        if (fees.active) {
            return (
                uint256(fees.mintFee),
                uint256(fees.redeemFee),
                uint256(fees.swapFee)
            );
        }

        return (
            uint256(factoryMintFee),
            uint256(factoryRedeemFee),
            uint256(factorySwapFee)
        );
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function getPTokenPremium721(
        uint256 vaultId,
        uint256 tokenId
    ) external view override returns (uint256 premium, address depositor) {
        IDruseVault _vault = IDruseVault(_vaults[vaultId]);

        if (_vault.holdingsContains(tokenId)) {
            uint48 timestamp;
            (timestamp, depositor) = _vault.tokenDepositInfo(tokenId);

            premium = _getPTokenPremium(timestamp, premiumMax, premiumDuration);
        }
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function getPTokenPremium1155(
        uint256 vaultId,
        uint256 tokenId,
        uint256 amount
    )
        external
        view
        override
        returns (
            uint256 totalPremium,
            uint256[] memory premiums,
            address[] memory depositors
        )
    {
        IDruseVault _vault = IDruseVault(_vaults[vaultId]);

        if (_vault.holdingsContains(tokenId)) {
            if (amount == 0) revert ZeroAmountRequested();

            // max possible array lengths
            premiums = new uint256[](amount);
            depositors = new address[](amount);

            uint256 _pointerIndex1155 = _vault.pointerIndex1155(tokenId);

            uint256 i = 0;
            // cache
            uint256 _premiumMax = premiumMax;
            uint256 _premiumDuration = premiumDuration;
            uint256 _tokenPositionLength = _vault.depositInfo1155Length(
                tokenId
            );
            while (true) {
                if (_tokenPositionLength <= _pointerIndex1155 + i)
                    revert NFTInventoryExceeded();

                (uint256 qty, address depositor, uint48 timestamp) = _vault
                    .depositInfo1155(tokenId, _pointerIndex1155 + i);

                if (qty >= amount) {
                    uint256 pTokenPremium = _getPTokenPremium(
                        timestamp,
                        _premiumMax,
                        _premiumDuration
                    ) * amount;
                    totalPremium += pTokenPremium;

                    premiums[i] = pTokenPremium;
                    depositors[i] = depositor;

                    // end loop
                    break;
                } else {
                    amount -= qty;

                    uint256 pTokenPremium = _getPTokenPremium(
                        timestamp,
                        _premiumMax,
                        _premiumDuration
                    ) * qty;
                    totalPremium += pTokenPremium;

                    premiums[i] = pTokenPremium;
                    depositors[i] = depositor;

                    unchecked {
                        ++i;
                    }
                }
            }

            uint256 finalArrayLength = i + 1;

            if (finalArrayLength < premiums.length) {
                // change array length
                assembly {
                    mstore(premiums, finalArrayLength)
                    mstore(depositors, finalArrayLength)
                }
            }
        }
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function isLocked(uint256 lockId) external view override returns (bool) {
        return isPaused[lockId];
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function vaultsForAsset(
        address assetAddress
    ) external view override returns (address[] memory) {
        return _vaultsForAsset[assetAddress];
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function allVaults() external view override returns (address[] memory) {
        return _vaults;
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function numVaults() external view override returns (uint256) {
        return _vaults.length;
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function vault(uint256 vaultId) external view override returns (address) {
        return _vaults[vaultId];
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function computeVaultAddress(
        address assetAddress,
        string memory name,
        string memory symbol
    ) external view returns (address) {
        return
            Create2Upgradeable.computeAddress(
                keccak256(abi.encode(assetAddress, name, symbol)),
                keccak256(BEACON_CODE)
            );
    }

    /**
     * @inheritdoc IDruseVaultFactory
     */
    function getTwapX96(
        address pToken
    ) external view override returns (uint256 priceX96) {
        if (poolOracle == address(0)) return 0;
        return IPoolOracle(poolOracle).getPriceX96(pToken);
    }

    // =============================================================
    //                        INTERNAL HELPERS
    // =============================================================

    function _deployVault(
        string memory name,
        string memory symbol,
        address assetAddress,
        bool is1155,
        bool allowAllItems
    ) internal returns (address) {
        address newBeaconProxy = Create2Upgradeable.deploy(
            0,
            keccak256(abi.encode(assetAddress, name, symbol)),
            BEACON_CODE
        );
        DruseVault(newBeaconProxy).__DruseVault_init(
            name,
            symbol,
            assetAddress,
            is1155,
            allowAllItems
        );
        // Manager for configuration.
        DruseVault(newBeaconProxy).setManager(msg.sender);
        // Owner for administrative functions.
        DruseVault(newBeaconProxy).transferOwnership(owner());
        return newBeaconProxy;
    }

    function _getPTokenPremium(
        uint48 timestamp,
        uint256 _premiumMax,
        uint256 _premiumDuration
    ) internal view returns (uint256) {
        return
            ExponentialPremium.getPremium(
                timestamp,
                _premiumMax,
                _premiumDuration
            );
    }
}
