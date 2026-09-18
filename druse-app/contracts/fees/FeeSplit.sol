// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFeeSplit} from "../interfaces/IFeeSplit.sol";
import {IStaking} from "../interfaces/IStaking.sol";

/// @notice Pulls WETH and sends 60% to staking, 30% to treasury, 10% to dev.
contract FeeSplit is IFeeSplit, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant STAKER_SHARE = 60;
    uint256 public constant TREASURY_SHARE = 30;
    uint256 public constant DEV_SHARE = 10;
    uint256 public constant SHARE_DENOM = 100;

    IERC20 public immutable WETH;
    IStaking public stakingContract;
    address public treasury;
    address public dev;

    error ZeroAddress();
    error ZeroAmount();

    event Split(uint256 stakers, uint256 treasuryAmount, uint256 devAmount);
    event StakingSet(address indexed staking);
    event TreasurySet(address indexed treasury);
    event DevSet(address indexed dev);

    constructor(
        IERC20 weth_,
        IStaking staking_,
        address treasury_,
        address dev_
    ) {
        if (
            address(weth_) == address(0) ||
            address(staking_) == address(0) ||
            treasury_ == address(0) ||
            dev_ == address(0)
        ) revert ZeroAddress();
        WETH = weth_;
        stakingContract = staking_;
        treasury = treasury_;
        dev = dev_;
    }

    function staking() external view override returns (address) {
        return address(stakingContract);
    }

    function setStaking(address staking_) external onlyOwner {
        if (staking_ == address(0)) revert ZeroAddress();
        stakingContract = IStaking(staking_);
        emit StakingSet(staking_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setDev(address dev_) external onlyOwner {
        if (dev_ == address(0)) revert ZeroAddress();
        dev = dev_;
        emit DevSet(dev_);
    }

    function split(uint256 wethAmount) external override {
        if (wethAmount == 0) revert ZeroAmount();
        WETH.safeTransferFrom(msg.sender, address(this), wethAmount);

        uint256 toStakers = (wethAmount * STAKER_SHARE) / SHARE_DENOM;
        uint256 toTreasury = (wethAmount * TREASURY_SHARE) / SHARE_DENOM;
        uint256 toDev = wethAmount - toStakers - toTreasury;

        if (toStakers > 0 && stakingContract.totalStaked() > 0) {
            WETH.safeApprove(address(stakingContract), toStakers);
            stakingContract.notifyRewardAmount(toStakers);
        } else if (toStakers > 0) {
            toTreasury += toStakers;
            toStakers = 0;
        }

        if (toTreasury > 0) WETH.safeTransfer(treasury, toTreasury);
        if (toDev > 0) WETH.safeTransfer(dev, toDev);

        emit Split(toStakers, toTreasury, toDev);
    }
}
