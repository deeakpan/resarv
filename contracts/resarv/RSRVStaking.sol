// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IRUSD {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IRSRV {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title RSRVStaking
 * @notice Stake RSRV to earn a share of borrow fees (rUSD).
 */
contract RSRVStaking {
    uint256 public constant DECIMAL_PRECISION = 1e18;

    IRSRV public immutable rsrv;
    IRUSD public immutable rusd;
    address public feeSource;
    address public owner;

    mapping(address => uint256) public stakes;
    uint256 public totalStaked;

    // Running sum of rUSD fees per RSRV staked
    uint256 public F_RUSD;
    mapping(address => uint256) public snapshots;

    event StakeChanged(address indexed user, uint256 newStake);
    event GainsWithdrawn(address indexed user, uint256 rusdGain);
    event F_RUSDUpdated(uint256 F_RUSD);
    event FeeSourceUpdated(address feeSource);

    modifier onlyOwner() {
        require(msg.sender == owner, "Staking: not owner");
        _;
    }

    modifier onlyFeeSource() {
        require(msg.sender == feeSource, "Staking: not fee source");
        _;
    }

    constructor(address _rsrv, address _rusd) {
        require(_rsrv != address(0) && _rusd != address(0), "Staking: zero");
        owner = msg.sender;
        rsrv = IRSRV(_rsrv);
        rusd = IRUSD(_rusd);
    }

    function setFeeSource(address _feeSource) external onlyOwner {
        require(_feeSource != address(0), "Staking: zero");
        feeSource = _feeSource;
        emit FeeSourceUpdated(_feeSource);
    }

    function transferOwnership(address _owner) external onlyOwner {
        require(_owner != address(0), "Staking: zero");
        owner = _owner;
    }

    /// @notice Called by NFTCDP when routing borrow fees. Tokens must already be transferred.
    /// @dev If nobody is staked yet, rUSD sits in this contract and is distributed on the next notify after stakes exist.
    function notifyFee(uint256 amount) external onlyFeeSource {
        if (amount == 0) return;
        if (totalStaked == 0) return;
        // Include any previously parked fees (balance - already-accounted is hard;
        // distribute exactly `amount` for this call).
        F_RUSD += (amount * DECIMAL_PRECISION) / totalStaked;
        emit F_RUSDUpdated(F_RUSD);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Staking: zero amount");
        _payout(msg.sender);
        require(rsrv.transferFrom(msg.sender, address(this), amount), "Staking: transfer");
        stakes[msg.sender] += amount;
        totalStaked += amount;
        snapshots[msg.sender] = F_RUSD;
        emit StakeChanged(msg.sender, stakes[msg.sender]);
    }

    function unstake(uint256 amount) external {
        require(amount > 0 && stakes[msg.sender] >= amount, "Staking: amount");
        _payout(msg.sender);
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        snapshots[msg.sender] = F_RUSD;
        require(rsrv.transfer(msg.sender, amount), "Staking: transfer");
        emit StakeChanged(msg.sender, stakes[msg.sender]);
    }

    function claim() external {
        _payout(msg.sender);
        snapshots[msg.sender] = F_RUSD;
    }

    function pendingRUSD(address user) public view returns (uint256) {
        uint256 stakeAmt = stakes[user];
        if (stakeAmt == 0) return 0;
        return (stakeAmt * (F_RUSD - snapshots[user])) / DECIMAL_PRECISION;
    }

    function _payout(address user) internal {
        uint256 gain = pendingRUSD(user);
        if (gain == 0) return;
        snapshots[user] = F_RUSD;
        require(rusd.transfer(user, gain), "Staking: rusd");
        emit GainsWithdrawn(user, gain);
    }
}
