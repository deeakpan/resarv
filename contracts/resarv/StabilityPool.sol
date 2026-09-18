// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IRUSD {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title StabilityPool
 * @notice Deposit rUSD to earn borrow-fee share and optionally offset liquidations.
 */
contract StabilityPool {
    uint256 public constant DECIMAL_PRECISION = 1e18;

    IRUSD public immutable rusd;
    address public feeSource;
    address public cdp;
    address public owner;

    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    uint256 public F_RUSD;
    mapping(address => uint256) public snapshots;

    // Compounded deposit product (starts at 1e18, shrinks on offsets)
    uint256 public P = DECIMAL_PRECISION;
    mapping(address => uint256) public depositSnapshotsP;

    event DepositChanged(address indexed user, uint256 newDeposit);
    event GainsWithdrawn(address indexed user, uint256 rusdGain);
    event Offset(uint256 amount, uint256 newP);
    event F_RUSDUpdated(uint256 F_RUSD);

    modifier onlyOwner() {
        require(msg.sender == owner, "SP: not owner");
        _;
    }

    modifier onlyFeeSource() {
        require(msg.sender == feeSource, "SP: not fee source");
        _;
    }

    modifier onlyCDP() {
        require(msg.sender == cdp, "SP: not cdp");
        _;
    }

    constructor(address _rusd) {
        require(_rusd != address(0), "SP: zero");
        owner = msg.sender;
        rusd = IRUSD(_rusd);
    }

    function setFeeSource(address _feeSource) external onlyOwner {
        require(_feeSource != address(0), "SP: zero");
        feeSource = _feeSource;
    }

    function setCDP(address _cdp) external onlyOwner {
        require(_cdp != address(0), "SP: zero");
        cdp = _cdp;
    }

    function transferOwnership(address _owner) external onlyOwner {
        require(_owner != address(0), "SP: zero");
        owner = _owner;
    }

    function notifyFee(uint256 amount) external onlyFeeSource {
        if (amount == 0 || totalDeposits == 0) return;
        F_RUSD += (amount * DECIMAL_PRECISION) / totalDeposits;
        emit F_RUSDUpdated(F_RUSD);
    }

    function provide(uint256 amount) external {
        require(amount > 0, "SP: zero");
        _sync(msg.sender);
        require(rusd.transferFrom(msg.sender, address(this), amount), "SP: transfer");
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        emit DepositChanged(msg.sender, deposits[msg.sender]);
    }

    function withdraw(uint256 amount) external {
        _sync(msg.sender);
        require(amount > 0 && deposits[msg.sender] >= amount, "SP: amount");
        deposits[msg.sender] -= amount;
        totalDeposits -= amount;
        require(rusd.transfer(msg.sender, amount), "SP: transfer");
        emit DepositChanged(msg.sender, deposits[msg.sender]);
    }

    function claim() external {
        _sync(msg.sender);
    }

    /// @notice Shrink deposits for a CDP liquidation offset. CDP must burn the rUSD from this contract.
    function offset(uint256 amount) external onlyCDP {
        require(amount > 0 && amount <= totalDeposits, "SP: amount");
        P = (P * (totalDeposits - amount)) / totalDeposits;
        if (P == 0) P = 1;
        totalDeposits -= amount;
        emit Offset(amount, P);
    }

    function compoundedDeposit(address user) public view returns (uint256) {
        uint256 d = deposits[user];
        if (d == 0) return 0;
        uint256 snapP = depositSnapshotsP[user];
        if (snapP == 0) snapP = DECIMAL_PRECISION;
        return (d * P) / snapP;
    }

    function pendingRUSD(address user) public view returns (uint256) {
        uint256 d = compoundedDeposit(user);
        if (d == 0) return 0;
        return (d * (F_RUSD - snapshots[user])) / DECIMAL_PRECISION;
    }

    function _sync(address user) internal {
        uint256 compounded = compoundedDeposit(user);
        uint256 gain = 0;
        if (deposits[user] != 0) {
            gain = (compounded * (F_RUSD - snapshots[user])) / DECIMAL_PRECISION;
        }
        deposits[user] = compounded;
        depositSnapshotsP[user] = P;
        snapshots[user] = F_RUSD;
        if (gain > 0) {
            require(rusd.transfer(user, gain), "SP: rusd");
            emit GainsWithdrawn(user, gain);
        }
    }
}
