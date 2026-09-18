// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ECDSA} from "./lib/ECDSA.sol";

interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IRUSDMintBurn {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IFeeSink {
    function notifyFee(uint256 amount) external;
}

interface IStabilityPoolOffset {
    function offset(uint256 amount) external;
    function totalDeposits() external view returns (uint256);
}

/**
 * @title NFTCDP
 * @notice NFT-backed CDP: deposit a whitelisted ERC721, mint rUSD against a signed floor price.
 *         No vault tokens. Price is an operator EIP-712 signature (collection, tokenId, price, deadline).
 */
contract NFTCDP {
    using ECDSA for bytes32;

    uint256 public constant DECIMAL_PRECISION = 1e18;
    /// @notice Max borrow = 40% of signed NFT USD price
    uint256 public constant MAX_LTV = 4e17; // 40%
    /// @notice Liquidatable when debt / price >= 50%
    uint256 public constant LIQ_THRESHOLD = 5e17; // 50%
    /// @notice One-time borrow fee (Liquity-style), 0.5%
    uint256 public constant BORROW_FEE = 5e15; // 0.5%
    /// @notice Max signature lifetime from now
    uint256 public constant MAX_PRICE_AGE = 40;
    uint256 public constant FEE_TO_STAKERS_BPS = 2000; // 20%
    uint256 public constant FEE_TO_SP_BPS = 2000; // 20%
    uint256 public constant BPS = 10000;

    bytes32 public constant PRICE_TYPEHASH =
        keccak256("PriceAttestation(address collection,uint256 tokenId,uint256 price,uint256 deadline)");

    IRUSDMintBurn public immutable rusd;
    IFeeSink public staking;
    IStabilityPoolOffset public stabilityPool;
    address public treasury;
    address public priceSigner;
    address public owner;
    /// @notice When false (or staking is zero), the staker fee share goes to treasury.
    bool public stakingEnabled;

    bytes32 public DOMAIN_SEPARATOR;

    struct Position {
        address owner;
        uint256 debt; // rUSD principal + accrued borrow fee
    }

    /// @dev keccak256(collection, tokenId) => position
    mapping(bytes32 => Position) public positions;
    mapping(address => bool) public supportedCollections;
    address[] public collectionList;

    event CollectionUpdated(address indexed collection, bool supported);
    event PositionOpened(
        address indexed user,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 price,
        uint256 debt,
        uint256 fee
    );
    event PositionClosed(
        address indexed user,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 debtRepaid
    );
    event PositionLiquidated(
        address indexed liquidator,
        address indexed collection,
        uint256 indexed tokenId,
        address borrower,
        uint256 debt,
        uint256 price
    );
    event PriceSignerUpdated(address signer);
    event TreasuryUpdated(address treasury);
    event StakingUpdated(address staking, bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "CDP: not owner");
        _;
    }

    constructor(
        address _rusd,
        address _staking,
        address _stabilityPool,
        address _treasury,
        address _priceSigner
    ) {
        require(
            _rusd != address(0) &&
                _stabilityPool != address(0) &&
                _treasury != address(0) &&
                _priceSigner != address(0),
            "CDP: zero"
        );
        owner = msg.sender;
        rusd = IRUSDMintBurn(_rusd);
        // Staking is optional at launch — pass address(0) and leave stakingEnabled=false.
        staking = IFeeSink(_staking);
        stakingEnabled = _staking != address(0);
        stabilityPool = IStabilityPoolOffset(_stabilityPool);
        treasury = _treasury;
        priceSigner = _priceSigner;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("ResarvNFTCDP")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function transferOwnership(address _owner) external onlyOwner {
        require(_owner != address(0), "CDP: zero");
        owner = _owner;
    }

    function setPriceSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "CDP: zero");
        priceSigner = _signer;
        emit PriceSignerUpdated(_signer);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "CDP: zero");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Wire or disable RSRV staking fee sink.
     * @param _staking Staking contract (address(0) disables routing).
     * @param enabled Must be false if `_staking` is zero; true only when a real sink is set.
     */
    function setStaking(address _staking, bool enabled) external onlyOwner {
        require(!enabled || _staking != address(0), "CDP: staking");
        staking = IFeeSink(_staking);
        stakingEnabled = enabled;
        emit StakingUpdated(_staking, enabled);
    }

    function setSupportedCollection(address collection, bool supported) external onlyOwner {
        require(collection != address(0), "CDP: zero");
        bool was = supportedCollections[collection];
        supportedCollections[collection] = supported;
        if (supported && !was) {
            collectionList.push(collection);
        }
        emit CollectionUpdated(collection, supported);
    }

    function positionKey(address collection, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(collection, tokenId));
    }

    function getPosition(
        address collection,
        uint256 tokenId
    ) external view returns (address posOwner, uint256 debt) {
        Position storage p = positions[positionKey(collection, tokenId)];
        return (p.owner, p.debt);
    }

    function collectionCount() external view returns (uint256) {
        return collectionList.length;
    }

    /**
     * @notice Deposit NFT and mint rUSD against signed floor price.
     * @param borrowAmount Net rUSD the user wants (fee is minted on top and added to debt).
     */
    function open(
        address collection,
        uint256 tokenId,
        uint256 borrowAmount,
        uint256 price,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(supportedCollections[collection], "CDP: collection");
        require(borrowAmount > 0, "CDP: borrow");
        _verifyPrice(collection, tokenId, price, deadline, signature);

        bytes32 key = positionKey(collection, tokenId);
        require(positions[key].owner == address(0), "CDP: exists");

        uint256 fee = (borrowAmount * BORROW_FEE) / DECIMAL_PRECISION;
        uint256 debt = borrowAmount + fee;
        require((debt * DECIMAL_PRECISION) / price <= MAX_LTV, "CDP: LTV");

        IERC721Minimal(collection).transferFrom(msg.sender, address(this), tokenId);

        positions[key] = Position({owner: msg.sender, debt: debt});

        rusd.mint(msg.sender, borrowAmount);
        if (fee > 0) {
            rusd.mint(address(this), fee);
            _routeFee(fee);
        }

        emit PositionOpened(msg.sender, collection, tokenId, price, debt, fee);
    }

    /**
     * @notice Repay full debt and withdraw the NFT.
     */
    function close(address collection, uint256 tokenId) external {
        bytes32 key = positionKey(collection, tokenId);
        Position storage p = positions[key];
        require(p.owner == msg.sender, "CDP: not owner");
        uint256 debt = p.debt;
        require(debt > 0, "CDP: empty");

        delete positions[key];

        require(rusd.transferFrom(msg.sender, address(this), debt), "CDP: repay");
        rusd.burn(address(this), debt);

        IERC721Minimal(collection).safeTransferFrom(address(this), msg.sender, tokenId);

        emit PositionClosed(msg.sender, collection, tokenId, debt);
    }

    /**
     * @notice Liquidate an undercollateralized position with a fresh signed price.
     *         Liquidator pays the debt and receives the NFT.
     *         If Stability Pool has enough rUSD, debt is offset there instead and NFT goes to liquidator as keeper incentive...
     *         MVP: liquidator always pays debt, receives NFT. Optional SP offset burns pool rUSD and liquidator still gets NFT
     *         only if they trigger — simplified: prefer SP offset when funded, else liquidator pays.
     */
    function liquidate(
        address collection,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        bytes calldata signature
    ) external {
        _verifyPrice(collection, tokenId, price, deadline, signature);

        bytes32 key = positionKey(collection, tokenId);
        Position storage p = positions[key];
        require(p.owner != address(0), "CDP: none");
        uint256 debt = p.debt;
        require((debt * DECIMAL_PRECISION) / price >= LIQ_THRESHOLD, "CDP: healthy");

        address borrower = p.owner;
        delete positions[key];

        uint256 spBal = stabilityPool.totalDeposits();
        if (spBal >= debt) {
            stabilityPool.offset(debt);
            rusd.burn(address(stabilityPool), debt);
        } else {
            require(rusd.transferFrom(msg.sender, address(this), debt), "CDP: repay");
            rusd.burn(address(this), debt);
        }

        IERC721Minimal(collection).safeTransferFrom(address(this), msg.sender, tokenId);

        emit PositionLiquidated(msg.sender, collection, tokenId, borrower, debt, price);
    }

    function maxBorrow(uint256 price) public pure returns (uint256) {
        // debt = borrow + fee = borrow * (1 + BORROW_FEE)
        // debt <= price * MAX_LTV
        // borrow <= price * MAX_LTV / (1 + BORROW_FEE)
        return (price * MAX_LTV) / (DECIMAL_PRECISION + BORROW_FEE);
    }

    function _routeFee(uint256 fee) internal {
        uint256 toStakers =
            stakingEnabled && address(staking) != address(0)
                ? (fee * FEE_TO_STAKERS_BPS) / BPS
                : 0;
        uint256 toSP = (fee * FEE_TO_SP_BPS) / BPS;
        uint256 toTreasury = fee - toStakers - toSP;

        if (toStakers > 0) {
            require(rusd.transfer(address(staking), toStakers), "CDP: stake fee");
            staking.notifyFee(toStakers);
        }
        if (toSP > 0) {
            require(rusd.transfer(address(stabilityPool), toSP), "CDP: sp fee");
            IFeeSink(address(stabilityPool)).notifyFee(toSP);
        }
        if (toTreasury > 0) {
            require(rusd.transfer(treasury, toTreasury), "CDP: treasury fee");
        }
    }

    function _verifyPrice(
        address collection,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        require(price > 0, "CDP: price");
        require(block.timestamp <= deadline, "CDP: expired");
        require(deadline <= block.timestamp + MAX_PRICE_AGE, "CDP: too long");

        bytes32 structHash = keccak256(
            abi.encode(PRICE_TYPEHASH, collection, tokenId, price, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recovered = digest.recover(signature);
        require(recovered == priceSigner, "CDP: bad sig");
    }

    /// @dev ERC721 receiver
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
