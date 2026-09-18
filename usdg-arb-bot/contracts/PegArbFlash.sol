// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * PegArbFlash — inventory-neutral USDG peg arb on Uniswap v4 (Robinhood Chain).
 *
 * Flow:
 *  1. unlock PoolManager
 *  2. take (flash) USDG
 *  3. swap along encoded path toward 1:1
 *  4. settle flash + keep profit
 *
 * Deploy on chainId 4663. Wire PoolManager + Universal Router / V4 swap router.
 * This contract is a skeleton: fill `_swap` with your preferred V4 swap surface
 * (UniversalRouter commands or PoolManager.swap in unlock callback).
 */
interface IPoolManager {
    function unlock(bytes calldata data) external returns (bytes memory);
    function take(address currency, address to, uint256 amount) external;
    function sync(address currency) external;
    function settle() external payable returns (uint256);
    function settleFor(address recipient) external payable returns (uint256);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

contract PegArbFlash {
    IPoolManager public immutable poolManager;
    address public immutable usdg;
    address public owner;

    error NotOwner();
    error NotPoolManager();
    error InsufficientProfit();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address poolManager_, address usdg_) {
        poolManager = IPoolManager(poolManager_);
        usdg = usdg_;
        owner = msg.sender;
    }

    function transferOwnership(address next) external onlyOwner {
        owner = next;
    }

    /**
     * @param flashToken token to flash (USDG)
     * @param flashAmount amount to borrow
     * @param path opaque swap path for callback
     * @param minProfit minimum leftover USDG (or peg) after repay
     */
    function executeArb(
        address flashToken,
        uint256 flashAmount,
        bytes calldata path,
        uint256 minProfit
    ) external payable onlyOwner {
        bytes memory data = abi.encode(flashToken, flashAmount, path, minProfit, msg.sender);
        poolManager.unlock(data);
    }

    /// @dev PoolManager unlock callback (selector depends on IUnlockCallback)
    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (
            address flashToken,
            uint256 flashAmount,
            bytes memory path,
            uint256 minProfit,
            address beneficiary
        ) = abi.decode(raw, (address, uint256, bytes, uint256, address));

        // 1) Flash take USDG to this contract
        poolManager.take(flashToken, address(this), flashAmount);

        // 2) Swap path (implement with UniversalRouter / V4 swap)
        _swap(flashToken, flashAmount, path);

        // 3) Repay flash via sync + settle
        uint256 bal = IERC20(flashToken).balanceOf(address(this));
        require(bal >= flashAmount, "cannot repay flash");
        IERC20(flashToken).transfer(address(poolManager), flashAmount);
        poolManager.sync(flashToken);
        poolManager.settle();

        uint256 profit = IERC20(flashToken).balanceOf(address(this));
        if (profit < minProfit) revert InsufficientProfit();
        if (profit > 0) {
            IERC20(flashToken).transfer(beneficiary, profit);
        }

        return raw;
    }

    /// @dev Override / replace with real Uniswap v4 multi-hop swap
    function _swap(address /*tokenIn*/, uint256 /*amountIn*/, bytes memory /*path*/) internal {
        // Intentionally empty skeleton — integrate UniversalRouter.execute here.
        // Without a live swap the flash repay will fail (by design in tests).
        revert("PegArbFlash: wire Uniswap v4 swap path");
    }

    receive() external payable {}
}
