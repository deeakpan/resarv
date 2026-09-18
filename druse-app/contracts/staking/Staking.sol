// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStaking} from "../interfaces/IStaking.sol";
import {IWETH9} from "../interfaces/external/IWETH9.sol";

/// @notice Single staking pool. Rewards accrue in WETH and are paid out as ETH.
contract Staking is IStaking, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakeToken;
    IERC20 public immutable WETH;

    address public notifier;
    uint256 public override totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public leftover;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 internal constant PRECISION = 1e18;

    error NotNotifier();
    error ZeroAmount();
    error ZeroAddress();
    error EthTransferFailed();

    event NotifierSet(address indexed notifier);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount);
    event RewardNotified(uint256 amount);

    modifier onlyNotifier() {
        if (msg.sender != notifier) revert NotNotifier();
        _;
    }

    constructor(IERC20 stakeToken_, IERC20 weth_) {
        if (address(stakeToken_) == address(0) || address(weth_) == address(0)) {
            revert ZeroAddress();
        }
        stakeToken = stakeToken_;
        WETH = weth_;
    }

    function setNotifier(address notifier_) external onlyOwner {
        if (notifier_ == address(0)) revert ZeroAddress();
        notifier = notifier_;
        emit NotifierSet(notifier_);
    }

    function notifyRewardAmount(uint256 amount) external override onlyNotifier {
        if (amount == 0) revert ZeroAmount();
        WETH.safeTransferFrom(msg.sender, address(this), amount);

        if (totalStaked == 0) {
            leftover += amount;
            emit RewardNotified(amount);
            return;
        }

        uint256 toDistribute = amount + leftover;
        leftover = 0;
        rewardPerTokenStored += (toDistribute * PRECISION) / totalStaked;
        emit RewardNotified(toDistribute);
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > balanceOf[msg.sender]) revert ZeroAmount();
        _updateReward(msg.sender);
        balanceOf[msg.sender] -= amount;
        totalStaked -= amount;
        stakeToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() external nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = rewards[msg.sender];
        if (reward == 0) return;
        rewards[msg.sender] = 0;
        _payEth(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function exit() external nonReentrant {
        uint256 bal = balanceOf[msg.sender];
        if (bal > 0) {
            _updateReward(msg.sender);
            balanceOf[msg.sender] = 0;
            totalStaked -= bal;
            stakeToken.safeTransfer(msg.sender, bal);
            emit Withdrawn(msg.sender, bal);
        }
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            _payEth(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    receive() external payable {}

    function _payEth(address to, uint256 amount) internal {
        IWETH9(address(WETH)).withdraw(amount);
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function earned(address account) public view returns (uint256) {
        return
            (balanceOf[account] *
                (rewardPerTokenStored - userRewardPerTokenPaid[account])) /
            PRECISION +
            rewards[account];
    }

    function _updateReward(address account) internal {
        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
}
