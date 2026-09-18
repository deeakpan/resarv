// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

// inheriting
import {OwnableUpgradeable} from "./custom/OwnableUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {ERC1155HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC20FlashMintUpgradeable} from "./custom/tokens/ERC20/ERC20FlashMintUpgradeable.sol";
import {IERC3156FlashBorrowerUpgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC3156FlashBorrowerUpgradeable.sol";

// libs
import {FullMath} from "./lib/math/FullMath.sol";
import {TransferLib} from "./lib/TransferLib.sol";
import {FixedPoint96} from "./lib/math/FixedPoint96.sol";
import {ExponentialPremium} from "./lib/ExponentialPremium.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

// interfaces
import {IWETH9} from "./interfaces/external/IWETH9.sol";
import {IEligibility} from "./interfaces/IEligibility.sol";
import {IDelegateRegistry} from "./interfaces/IDelegateRegistry.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IDruseVaultFactory} from "./interfaces/IDruseVaultFactory.sol";
import {IERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import {IFeeSplit} from "./interfaces/IFeeSplit.sol";
import {IEligibilityManager} from "./interfaces/IEligibilityManager.sol";

import {IDruseVault} from "./interfaces/IDruseVault.sol";

contract DruseVault is
    IDruseVault,
    OwnableUpgradeable,
    ERC20FlashMintUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // =============================================================
    //                           CONSTANTS
    // =============================================================

    uint256 constant BASE = 10 ** 18;
    IWETH9 public immutable override WETH;
    address constant CRYPTO_PUNKS = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;
    address constant CRYPTO_KITTIES =
        0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
    IDelegateRegistry constant DELEGATE_REGISTRY =
        IDelegateRegistry(0x00000000000000447e69651d841bD8D104Bed493);

    // "constants": only set during initialization

    address public override assetAddress;
    IDruseVaultFactory public override vaultFactory;
    uint256 public override vaultId;
    bool public override is1155;

    // =============================================================
    //                            VARIABLES
    // =============================================================

    address public override manager;

    IEligibility public override eligibilityStorage;

    bool public override allowAllItems;
    bool public override enableMint;
    bool public override enableRedeem;
    bool public override enableSwap;

    EnumerableSetUpgradeable.UintSet internal _holdings;
    // tokenId => qty
    mapping(uint256 => uint256) internal _quantity1155;

    // tokenId => info
    mapping(uint256 => TokenDepositInfo) public override tokenDepositInfo;

    /**
     * For ERC1155 deposits, per TokenId:
     *
     *                          pointerIndex1155
     *                                |
     *                                V
     * [{qty: 0, depositor: A}, {qty: 5, depositor: B}, {qty: 10, depositor: C}, ...]
     *
     * New deposits are pushed to the end of array, and the oldest remaining deposit is used while withdrawing, hence following FIFO.
     */

    // tokenId => info[]
    mapping(uint256 => DepositInfo1155[]) public override depositInfo1155;
    // tokenId => pointerIndex
    mapping(uint256 => uint256) public override pointerIndex1155;

    // =============================================================
    //                           INIT
    // =============================================================

    constructor(IWETH9 WETH_) {
        WETH = WETH_;
    }

    function __DruseVault_init(
        string calldata name_,
        string calldata symbol_,
        address assetAddress_,
        bool is1155_,
        bool allowAllItems_
    ) public override initializer {
        __Ownable_init();
        __ERC20_init(name_, symbol_);

        if (assetAddress_ == address(0)) revert ZeroAddress();
        assetAddress = assetAddress_;
        vaultFactory = IDruseVaultFactory(msg.sender);
        vaultId = IDruseVaultFactory(msg.sender).numVaults();
        is1155 = is1155_;
        allowAllItems = allowAllItems_;

        emit VaultInit(vaultId, assetAddress_, is1155_, allowAllItems_);

        setVaultFeatures(
            true /*enableMint*/,
            true /*enableRedeem*/,
            true /*enableSwap*/
        );

        if (address(DELEGATE_REGISTRY).code.length > 0) {
            DELEGATE_REGISTRY.delegateAll(
                OwnableUpgradeable(msg.sender).owner(),
                bytes32(""),
                true
            );
        }
    }

    // =============================================================
    //                     PUBLIC / EXTERNAL WRITE
    // =============================================================

    /**
     * @inheritdoc IDruseVault
     */
    function mint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address depositor,
        address to
    ) external payable override nonReentrant returns (uint256 pTokensMinted) {
        _onlyOwnerIfPaused(1);
        if (!enableMint) revert MintingDisabled();

        // Take the NFTs.
        uint256 nftCount = _receiveNFTs(depositor, tokenIds, amounts);
        pTokensMinted = BASE * nftCount;

        // Mint to the user.
        _mint(to, pTokensMinted);

        uint256 ethFees;
        if (!vaultFactory.excludedFromFees(msg.sender)) {
            (uint256 mintFee, , ) = vaultFees();
            uint256 totalPTokenFee = mintFee * nftCount;
            ethFees = _chargeAndDistributeFees(totalPTokenFee, msg.value);
        }

        _refundETH(msg.value, ethFees);

        emit Minted(tokenIds, amounts, to, depositor);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function redeem(
        uint256[] calldata idsOut,
        address to,
        uint256 wethAmount,
        uint256 pTokenPremiumLimit,
        bool forceFees
    ) external payable override nonReentrant returns (uint256 ethFees) {
        _onlyOwnerIfPaused(2);
        if (!enableRedeem) revert RedeemDisabled();

        uint256 ethOrWethAmt;
        if (wethAmount > 0) {
            if (msg.value > 0) revert ETHSent();

            ethOrWethAmt = wethAmount;
        } else {
            ethOrWethAmt = msg.value;
        }

        uint256 totalVaultFee;
        {
            uint256 count = idsOut.length;

            // burn from the sender.
            _burn(msg.sender, BASE * count);

            {
                (, uint256 redeemFee, ) = vaultFees();
                totalVaultFee = (redeemFee * count);
            }
        }

        // Withdraw from vault.
        IDruseVaultFactory _vaultFactory = vaultFactory;
        bool deductFees = forceFees ||
            !_vaultFactory.excludedFromFees(msg.sender);
        (
            uint256 netPTokenPremium,
            uint256[] memory pTokenPremiums,
            address[] memory depositors
        ) = _withdrawNFTsTo(idsOut, to, deductFees, _vaultFactory);

        if (deductFees) {
            if (netPTokenPremium > pTokenPremiumLimit)
                revert PremiumLimitExceeded();

            ethFees = _chargeAndDistributeFeesForRedeem(
                ethOrWethAmt,
                msg.value > 0,
                totalVaultFee,
                netPTokenPremium,
                pTokenPremiums,
                depositors
            );
        }

        if (msg.value > 0) {
            _refundETH(msg.value, ethFees);
        }

        emit Redeemed(idsOut, to);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function swap(
        uint256[] calldata idsIn,
        uint256[] calldata amounts,
        uint256[] calldata idsOut,
        address depositor,
        address to,
        uint256 pTokenPremiumLimit,
        bool forceFees
    ) external payable override nonReentrant returns (uint256 ethFees) {
        _onlyOwnerIfPaused(3);
        if (!enableSwap) revert SwapDisabled();

        {
            uint256 count;
            if (is1155) {
                uint256 len = idsIn.length;
                for (uint256 i; i < len; ) {
                    if (amounts[i] == 0) revert TransferAmountIsZero();
                    count += amounts[i];

                    unchecked {
                        ++i;
                    }
                }
            } else {
                count = idsIn.length;
            }

            if (count != idsOut.length) revert TokenLengthMismatch();
        }

        {
            (, , uint256 swapFee) = vaultFees();
            uint256 totalVaultFee = (swapFee * idsOut.length);

            // Give the NFTs first, so the user wont get the same thing back.
            IDruseVaultFactory _vaultFactory = vaultFactory;
            bool deductFees = forceFees ||
                !_vaultFactory.excludedFromFees(msg.sender);
            (
                uint256 netPTokenPremium,
                uint256[] memory pTokenPremiums,
                address[] memory depositors
            ) = _withdrawNFTsTo(idsOut, to, deductFees, _vaultFactory);

            if (deductFees) {
                if (netPTokenPremium > pTokenPremiumLimit)
                    revert PremiumLimitExceeded();

                ethFees = _chargeAndDistributeFeesForRedeem(
                    msg.value,
                    true,
                    totalVaultFee,
                    netPTokenPremium,
                    pTokenPremiums,
                    depositors
                );
            }
        }

        _receiveNFTs(depositor, idsIn, amounts);

        _refundETH(msg.value, ethFees);

        emit Swapped(idsIn, amounts, idsOut, to, depositor);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function flashLoan(
        IERC3156FlashBorrowerUpgradeable receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) public override(ERC20FlashMintUpgradeable, IDruseVault) returns (bool) {
        _onlyOwnerIfPaused(4);
        return super.flashLoan(receiver, token, amount, data);
    }

    // =============================================================
    //                     ONLY PRIVILEGED WRITE
    // =============================================================

    /**
     * @inheritdoc IDruseVault
     */
    function finalizeVault() external override {
        _onlyPrivileged();
        setManager(address(0));
    }

    /**
     * @inheritdoc IDruseVault
     */
    function setVaultMetadata(
        string calldata name_,
        string calldata symbol_
    ) external override {
        _onlyPrivileged();
        _setMetadata(name_, symbol_);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function setVaultFeatures(
        bool enableMint_,
        bool enableRedeem_,
        bool enableSwap_
    ) public override {
        _onlyPrivileged();
        enableMint = enableMint_;
        enableRedeem = enableRedeem_;
        enableSwap = enableSwap_;

        emit EnableMintUpdated(enableMint_);
        emit EnableRedeemUpdated(enableRedeem_);
        emit EnableSwapUpdated(enableSwap_);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function setFees(
        uint256 mintFee_,
        uint256 redeemFee_,
        uint256 swapFee_
    ) external override {
        _onlyPrivileged();
        vaultFactory.setVaultFees(vaultId, mintFee_, redeemFee_, swapFee_);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function disableVaultFees() external override {
        _onlyPrivileged();
        vaultFactory.disableVaultFees(vaultId);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function deployEligibilityStorage(
        uint256 moduleIndex,
        bytes calldata initData
    ) external override returns (address) {
        _onlyPrivileged();
        if (address(eligibilityStorage) != address(0))
            revert EligibilityAlreadySet();

        IEligibilityManager eligManager = IEligibilityManager(
            vaultFactory.eligibilityManager()
        );
        address _eligibility = eligManager.deployEligibility(
            moduleIndex,
            initData
        );
        eligibilityStorage = IEligibility(_eligibility);
        // Toggle this to let the contract know to check eligibility now.
        allowAllItems = false;
        emit EligibilityDeployed(moduleIndex, _eligibility);
        return _eligibility;
    }

    /**
     * @inheritdoc IDruseVault
     */
    function setManager(address manager_) public override {
        _onlyPrivileged();
        manager = manager_;
        emit ManagerSet(manager_);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function updateDelegate() external {
        _onlyPrivileged();
        DELEGATE_REGISTRY.delegateAll(
            OwnableUpgradeable(address(vaultFactory)).owner(),
            bytes32(""),
            true
        );
    }

    // =============================================================
    //                     ONLY OWNER WRITE
    // =============================================================

    /**
     * @inheritdoc IDruseVault
     */
    function rescueTokens(
        TokenType tt,
        address token,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (address(token) == assetAddress) revert CantRescueAssetToken();

        if (tt == TokenType.ERC20) {
            uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
            IERC20Upgradeable(token).safeTransfer(msg.sender, balance);
        } else if (tt == TokenType.ERC721) {
            uint256 len = ids.length;
            for (uint256 i; i < len; ) {
                _transferERC721(token, msg.sender, ids[i]);

                unchecked {
                    ++i;
                }
            }
        } else {
            IERC1155Upgradeable(token).safeBatchTransferFrom(
                address(this),
                msg.sender,
                ids,
                amounts,
                ""
            );
        }
    }

    function shutdown(
        address recipient,
        uint256[] calldata tokenIds
    ) external override onlyOwner {
        uint256 numItems = totalSupply() / BASE;
        if (numItems > 4) revert TooManyItems();

        _withdrawNFTsTo(tokenIds, recipient, false, vaultFactory);

        emit VaultShutdown(assetAddress, numItems, recipient);
        assetAddress = address(0);
    }

    // =============================================================
    //                     PUBLIC / EXTERNAL VIEW
    // =============================================================

    /**
     * @inheritdoc IDruseVault
     */
    function vaultFees()
        public
        view
        override
        returns (uint256 mintFee, uint256 redeemFee, uint256 swapFee)
    {
        return vaultFactory.vaultFees(vaultId);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function allValidNFTs(
        uint256[] memory tokenIds
    ) public view override returns (bool) {
        if (allowAllItems) {
            return true;
        }

        IEligibility _eligibilityStorage = eligibilityStorage;
        if (address(_eligibilityStorage) == address(0)) {
            return false;
        }
        return _eligibilityStorage.checkAllEligible(tokenIds);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function nftIdAt(
        uint256 holdingsIndex
    ) external view override returns (uint256) {
        return _holdings.at(holdingsIndex);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function allHoldings() external view override returns (uint256[] memory) {
        uint256 len = _holdings.length();
        uint256[] memory idArray = new uint256[](len);
        for (uint256 i; i < len; ) {
            idArray[i] = _holdings.at(i);

            unchecked {
                ++i;
            }
        }
        return idArray;
    }

    /**
     * @inheritdoc IDruseVault
     */
    function totalHoldings() external view override returns (uint256) {
        return _holdings.length();
    }

    /**
     * @inheritdoc IDruseVault
     */
    function holdingsContains(
        uint256 tokenId
    ) external view override returns (bool) {
        return _holdings.contains(tokenId);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function version() external pure override returns (string memory) {
        return "v3.0.0";
    }

    /**
     * @inheritdoc IDruseVault
     */
    function pTokenToETH(
        uint256 pTokenAmount
    ) external view override returns (uint256 ethAmount) {
        (ethAmount, ) = _pTokenToETH(vaultFactory, pTokenAmount);
    }

    /**
     * @inheritdoc IDruseVault
     */
    function depositInfo1155Length(
        uint256 tokenId
    ) external view override returns (uint256) {
        return depositInfo1155[tokenId].length;
    }

    // =============================================================
    //                        INTERNAL HELPERS
    // =============================================================

    function _flashFee(
        address /** token */,
        uint256 amount
    ) internal view override returns (uint256) {
        (uint256 mintFee, uint256 redeemFee, uint256 swapFee) = vaultFees();

        uint256 maxFee = mintFee;
        if (redeemFee > maxFee) {
            maxFee = redeemFee;
        }
        if (swapFee > maxFee) {
            maxFee = swapFee;
        }

        return (amount * maxFee) / BASE;
    }

    function _flashFeeReceiver() internal view override returns (address) {
        return IFeeSplit(vaultFactory.feeSplit()).staking();
    }

    // We set a hook to the eligibility module (if it exists) after redeems in case anything needs to be modified.
    function _afterRedeemHook(uint256[] memory tokenIds) internal {
        IEligibility _eligibilityStorage = eligibilityStorage;
        if (address(_eligibilityStorage) == address(0)) {
            return;
        }
        _eligibilityStorage.afterRedeemHook(tokenIds);
    }

    function _receiveNFTs(
        address depositor,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) internal returns (uint256) {
        if (!allValidNFTs(tokenIds)) revert NotEligible();

        if (!is1155) {
            address _assetAddress = assetAddress;
            uint256 len = tokenIds.length;
            for (uint256 i; i < len; ) {
                uint256 tokenId = tokenIds[i];
                // We may already own the NFT here so we check in order:
                // Does the vault own it?
                //   - If so, check if its in holdings list
                //      - If so, we reject. This means the NFT has already been claimed for.
                //      - If not, it means we have not yet accounted for this NFT, so we continue.
                //   -If not, we "pull" it from the msg.sender and add to holdings.
                _transferFromERC721(_assetAddress, tokenId);
                if (!_holdings.add(tokenId)) revert HoldingsUpdationFailed();
                tokenDepositInfo[tokenId] = TokenDepositInfo({
                    timestamp: uint48(block.timestamp),
                    depositor: depositor
                });

                unchecked {
                    ++i;
                }
            }
            return len;
        } else {
            // This is technically a check, so placing it before the effect.
            IERC1155Upgradeable(assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                tokenIds,
                amounts,
                ""
            );

            uint256 count;
            uint256 len = tokenIds.length;
            for (uint256 i; i < len; ) {
                uint256 tokenId = tokenIds[i];
                uint256 amount = amounts[i];

                if (amount == 0) revert TransferAmountIsZero();

                if (_quantity1155[tokenId] == 0) {
                    if (!_holdings.add(tokenId))
                        revert HoldingsUpdationFailed();
                }
                _quantity1155[tokenId] += amount;
                count += amount;

                depositInfo1155[tokenId].push(
                    DepositInfo1155({
                        qty: amount,
                        depositor: depositor,
                        timestamp: uint48(block.timestamp)
                    })
                );

                unchecked {
                    ++i;
                }
            }
            return count;
        }
    }

    function _withdrawNFTsTo(
        uint256[] memory specificIds,
        address to,
        bool deductFees,
        IDruseVaultFactory _vaultFactory
    )
        internal
        returns (
            uint256 netPTokenPremium,
            uint256[] memory pTokenPremiums,
            address[] memory depositors
        )
    {
        // cache
        bool _is1155 = is1155;
        address _assetAddress = assetAddress;

        uint256 premiumMax;
        uint256 premiumDuration;

        if (deductFees) {
            premiumMax = _vaultFactory.premiumMax();
            premiumDuration = _vaultFactory.premiumDuration();

            pTokenPremiums = new uint256[](specificIds.length);
            depositors = new address[](specificIds.length);
        }

        uint256 len = specificIds.length;
        for (uint256 i; i < len; ) {
            uint256 tokenId = specificIds[i];

            if (_is1155) {
                {
                    uint256 _qty1155 = _quantity1155[tokenId];
                    if (_qty1155 == 0) revert IdNotFound();
                    _quantity1155[tokenId] = _qty1155 - 1;
                    // updated _quantity1155 is 0 now, so remove from holdings
                    if (_qty1155 == 1) {
                        if (!_holdings.remove(tokenId))
                            revert HoldingsUpdationFailed();
                    }
                }

                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    to,
                    tokenId,
                    1,
                    ""
                );

                uint256 _pointerIndex1155 = pointerIndex1155[tokenId];
                DepositInfo1155 storage depositInfo = depositInfo1155[tokenId][
                    _pointerIndex1155
                ];
                uint256 _qty = depositInfo.qty;

                depositInfo.qty = _qty - 1;

                // if it was the last nft from this deposit
                if (_qty == 1) {
                    pointerIndex1155[tokenId] = _pointerIndex1155 + 1;
                }

                if (deductFees) {
                    uint256 pTokenPremium = _getPTokenPremium(
                        depositInfo.timestamp,
                        premiumMax,
                        premiumDuration
                    );
                    netPTokenPremium += pTokenPremium;

                    pTokenPremiums[i] = pTokenPremium;
                    depositors[i] = depositInfo.depositor;
                }
            } else {
                if (deductFees) {
                    TokenDepositInfo memory depositInfo = tokenDepositInfo[
                        tokenId
                    ];

                    uint256 pTokenPremium = _getPTokenPremium(
                        depositInfo.timestamp,
                        premiumMax,
                        premiumDuration
                    );
                    netPTokenPremium += pTokenPremium;

                    pTokenPremiums[i] = pTokenPremium;
                    depositors[i] = depositInfo.depositor;
                }

                if (!_holdings.remove(tokenId)) revert HoldingsUpdationFailed();
                _transferERC721(_assetAddress, to, tokenId);
            }

            unchecked {
                ++i;
            }
        }
        _afterRedeemHook(specificIds);
    }

    /// @dev Uses TWAP to calculate fees `ethAmount` corresponding to the given `pTokenAmount`
    /// Returns 0 if pool doesn't exist or sender is excluded from fees.
    function _chargeAndDistributeFees(
        uint256 pTokenFeeAmount,
        uint256 ethReceived
    ) internal returns (uint256 ethAmount) {
        // cache
        IDruseVaultFactory _vaultFactory = vaultFactory;

        if (_vaultFactory.excludedFromFees(msg.sender)) {
            return 0;
        }

        IFeeSplit feeSplit_;
        (ethAmount, feeSplit_) = _pTokenToETH(
            _vaultFactory,
            pTokenFeeAmount
        );

        if (ethAmount > 0) {
            if (ethReceived < ethAmount) revert InsufficientETHSent();

            WETH.deposit{value: ethAmount}();
            WETH.approve(address(feeSplit_), ethAmount);
            feeSplit_.split(ethAmount);

            emit FeesDistributed(ethAmount);
        }
    }

    function _chargeAndDistributeFeesForRedeem(
        uint256 ethOrWethReceived,
        bool isETH,
        uint256 totalVaultFees,
        uint256 netPTokenPremium,
        uint256[] memory pTokenPremiums,
        address[] memory depositors
    ) internal returns (uint256 ethAmount) {
        uint256 vaultETHFees;
        IFeeSplit feeSplit_;
        (vaultETHFees, feeSplit_) = _pTokenToETH(
            vaultFactory,
            totalVaultFees
        );

        if (vaultETHFees > 0) {
            uint256 netETHPremium;
            uint256 netETHPremiumForDepositors;
            if (netPTokenPremium > 0) {
                netETHPremium =
                    (vaultETHFees * netPTokenPremium) /
                    totalVaultFees;
                netETHPremiumForDepositors =
                    (netETHPremium * vaultFactory.depositorPremiumShare()) /
                    1 ether;
            }
            ethAmount = vaultETHFees + netETHPremium;

            if (ethOrWethReceived < ethAmount) revert InsufficientETHSent();

            if (isETH) {
                WETH.deposit{value: ethAmount}();
            } else {
                // pull only required weth from sender
                WETH.transferFrom(msg.sender, address(this), ethAmount);
            }

            uint256 sumWethPremium;
            uint256 len = pTokenPremiums.length;
            for (uint256 i; i < len; ) {
                if (pTokenPremiums[i] > 0) {
                    uint256 wethPremium = (netETHPremiumForDepositors *
                        pTokenPremiums[i]) / netPTokenPremium;

                    WETH.transfer(depositors[i], wethPremium);
                    sumWethPremium += wethPremium;

                    emit PremiumShared(depositors[i], wethPremium);
                }

                unchecked {
                    ++i;
                }
            }

            uint256 feeToDistribute = ethAmount - sumWethPremium;
            WETH.approve(address(feeSplit_), feeToDistribute);
            feeSplit_.split(feeToDistribute);

            emit FeesDistributed(feeToDistribute);
        }
    }

    function _pTokenToETH(
        IDruseVaultFactory _vaultFactory,
        uint256 pTokenAmount
    ) internal view returns (uint256 ethAmount, IFeeSplit feeSplit_) {
        feeSplit_ = IFeeSplit(_vaultFactory.feeSplit());
        if (address(feeSplit_) == address(0)) {
            return (0, IFeeSplit(address(0)));
        }

        uint256 priceX96 = vaultFactory.getTwapX96(address(this));
        if (priceX96 == 0) return (0, feeSplit_);

        if (address(this) < address(WETH)) {
            ethAmount = FullMath.mulDiv(
                pTokenAmount,
                priceX96,
                FixedPoint96.Q96
            );
        } else {
            ethAmount = FullMath.mulDiv(
                pTokenAmount,
                FixedPoint96.Q96,
                priceX96
            );
        }
    }

    function _getPTokenPremium(
        uint48 timestamp,
        uint256 premiumMax,
        uint256 premiumDuration
    ) internal view returns (uint256) {
        return
            ExponentialPremium.getPremium(
                timestamp,
                premiumMax,
                premiumDuration
            );
    }

    /// @dev Must satisfy ethReceived >= ethFees
    function _refundETH(uint256 ethReceived, uint256 ethFees) internal {
        uint256 ethRefund = ethReceived - ethFees;
        if (ethRefund > 0) {
            TransferLib.transferETH(msg.sender, ethRefund);
        }
    }

    function _transferERC721(
        address assetAddr,
        address to,
        uint256 tokenId
    ) internal {
        bytes memory data;

        if (assetAddr != CRYPTO_PUNKS && assetAddr != CRYPTO_KITTIES) {
            // Default
            data = abi.encodeWithSignature(
                "safeTransferFrom(address,address,uint256)",
                address(this),
                to,
                tokenId
            );
        } else if (assetAddr == CRYPTO_PUNKS) {
            data = abi.encodeWithSignature(
                "transferPunk(address,uint256)",
                to,
                tokenId
            );
        } else {
            data = abi.encodeWithSignature(
                "transfer(address,uint256)",
                to,
                tokenId
            );
        }

        (bool success, bytes memory returnData) = address(assetAddr).call(data);
        require(success, string(returnData));
    }

    function _transferFromERC721(address assetAddr, uint256 tokenId) internal {
        bytes memory data;

        if (assetAddr != CRYPTO_PUNKS && assetAddr != CRYPTO_KITTIES) {
            // Default
            // Allow other contracts to "push" into the vault, safely.
            // If we already have the token requested, make sure we don't have it in the list to prevent duplicate minting.
            if (
                IERC721Upgradeable(assetAddress).ownerOf(tokenId) ==
                address(this)
            ) {
                if (_holdings.contains(tokenId)) revert NFTAlreadyOwned();

                return;
            } else {
                data = abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256)",
                    msg.sender,
                    address(this),
                    tokenId
                );
            }
        } else if (assetAddr == CRYPTO_PUNKS) {
            // To prevent frontrun attack
            bytes memory punkIndexToAddress = abi.encodeWithSignature(
                "punkIndexToAddress(uint256)",
                tokenId
            );
            (bool checkSuccess, bytes memory result) = address(assetAddr)
                .staticcall(punkIndexToAddress);
            address nftOwner = abi.decode(result, (address));

            if (!checkSuccess || nftOwner != msg.sender) revert NotNFTOwner();

            data = abi.encodeWithSignature("buyPunk(uint256)", tokenId);
        } else {
            // CRYPTO_KITTIES
            data = abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                address(this),
                tokenId
            );
        }

        (bool success, bytes memory resultData) = address(assetAddr).call(data);
        require(success, string(resultData));
    }

    function _onlyPrivileged() internal view {
        if (manager == address(0)) {
            if (msg.sender != owner()) revert NotOwner();
        } else {
            if (msg.sender != manager) revert NotManager();
        }
    }

    function _onlyOwnerIfPaused(uint256 lockId) internal view {
        if (vaultFactory.isLocked(lockId) && msg.sender != owner())
            revert Paused();
    }
}
