import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");
const Q96 = 2n ** 96n;
const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
const TICK_SPACING = 200;
const LP_FEE = 10_000;
const PRICE = 0.01; // 1 pTOKEN = 0.01 WETH

const LIQ_ABI = [
  "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) payable returns (int256)",
];
const SWAP_ABI = [
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) payable returns (int256)",
];

function load() {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"));
}

function getWallet() {
  const rpcUrl =
    process.env.RPC_URL || "https://unichain-sepolia-rpc.publicnode.com";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;

  class FetchJsonRpcProvider extends ethers.JsonRpcApiProvider {
    readonly rpcUrl: string;
    constructor(url: string) {
      super(ethers.Network.from(1301), { staticNetwork: true });
      this.rpcUrl = url;
    }
    async _send(payload: unknown) {
      const resp = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await resp.json();
      return Array.isArray(result) ? result : [result];
    }
  }

  return new ethers.Wallet(key, new FetchJsonRpcProvider(rpcUrl));
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function priceToSqrtX96(price: number): bigint {
  return BigInt(Math.floor(Math.sqrt(price) * 2 ** 96));
}

async function main() {
  const wallet = getWallet();
  const me = await wallet.getAddress();
  const provider = wallet.provider!;
  let nonce = await provider.getTransactionCount(me, "latest");
  const take = () => nonce++;
  const send = async (p: Promise<{ wait: () => Promise<unknown> }>) => {
    const tx = await p;
    const receipt = await tx.wait();
    if (!receipt) throw new Error("missing receipt");
    return receipt as { hash?: string };
  };

  const all = load();
  const d = all["1301"];
  assert(d?.druse && d?.nfts && d?.vaults, "missing 1301 deployment");

  const v4 = d.uniswapV4;
  const punksNft = await ethers.getContractAt("MockERC721", d.nfts.punks, wallet);
  const itemsNft = await ethers.getContractAt("MockERC1155", d.nfts.items, wallet);
  const vault = await ethers.getContractAt("DruseVault", d.vaults.punks, wallet);
  const itemsVault = await ethers.getContractAt("DruseVault", d.vaults.items, wallet);
  const launcher = await ethers.getContractAt("PoolLauncher", d.druse.launcher, wallet);
  const staking = await ethers.getContractAt("Staking", d.druse.staking, wallet);
  const stakeToken = await ethers.getContractAt("MockERC20", d.druse.stakeToken, wallet);
  const weth = await ethers.getContractAt("MockWETH", v4.weth, wallet);
  const erc20 = (addr: string) => ethers.getContractAt("MockERC20", addr, wallet);
  const nft721 = await ethers.getContractAt("MockERC721", d.nfts.punks, wallet);

  const factory = await ethers.getContractAt(
    "DruseVaultFactory",
    d.druse.factory,
    wallet
  );
  const vaultFee = ethers.parseEther("0.01"); // 1% of floor
  await send(factory.setFactoryFees(vaultFee, vaultFee, vaultFee, { nonce: take() }));
  await send(factory.setPremiumMax(0, { nonce: take() }));

  const ethBefore = await provider.getBalance(me);
  console.log("tester", me);
  console.log("ETH", ethers.formatEther(ethBefore));
  assert(ethBefore > ethers.parseEther("0.003"), "need a bit more test ETH for gas");

  // --- 1. Stake DRUSE so hook fees notify stakers ---
  const stakeAmt = ethers.parseEther("1000");
  if ((await staking.balanceOf(me)) === 0n) {
    await send(stakeToken.approve(d.druse.staking, stakeAmt, { nonce: take() }));
    await send(staking.stake(stakeAmt, { nonce: take() }));
  }
  assert((await staking.totalStaked()) > 0n, "nothing staked");
  console.log("1 ok  staked", ethers.formatEther(await staking.balanceOf(me)), "DRUSE");

  const idsOwnedBy = async (owner: string) => {
    const ids: bigint[] = [];
    for (let i = 1n; i <= 20n; i++) {
      if ((await punksNft.ownerOf(i)).toLowerCase() === owner.toLowerCase()) ids.push(i);
    }
    return ids;
  };

  // --- 2. Mint NFTs into vault (no pool => 0 ETH fee / 0 TWAP) ---
  assert(
    (await factory.getTwapX96(d.vaults.items)) === 0n,
    "vault with no pool must return TWAP 0"
  );
  let vBal = await vault.balanceOf(me);
  if (vBal < ethers.parseEther("2")) {
    const mine = await idsOwnedBy(me);
    const need = 2n - vBal / ethers.parseEther("1");
    const mintIds = mine.slice(0, Number(need));
    assert(mintIds.length >= Number(need), "not enough punks in wallet to mint");
    await send(punksNft.setApprovalForAll(d.vaults.punks, true, { nonce: take() }));
    await send(vault.mint(mintIds, [], me, me, { nonce: take() }));
    vBal = await vault.balanceOf(me);
  }
  assert(vBal >= ethers.parseEther("2"), `expected at least 2 pTOKEN, got ${ethers.formatEther(vBal)}`);
  console.log("2 ok  pTOKEN", ethers.formatEther(vBal));

  if ((await itemsVault.balanceOf(me)) < ethers.parseEther("2")) {
    await send(itemsNft.setApprovalForAll(d.vaults.items, true, { nonce: take() }));
    await send(itemsVault.mint([1], [2], me, me, { nonce: take() }));
  }
  assert((await itemsVault.balanceOf(me)) >= ethers.parseEther("2"), "expected 2 item pTOKEN");
  console.log("2b ok minted 2 ERC1155 into items vault");

  // --- 3. Create 1% v4 pool ---
  const sqrtPriceX96 = priceToSqrtX96(PRICE);
  const existing = await launcher.sqrtPriceX96Of(d.vaults.punks);
  if (existing === 0n) {
    await send(launcher.createPool(d.vaults.punks, sqrtPriceX96, { nonce: take() }));
  }
  const stored = await launcher.sqrtPriceX96Of(d.vaults.punks);
  assert(stored > 0n, "pool price not stored");
  const token0 = d.vaults.punks.toLowerCase() < v4.weth.toLowerCase() ? d.vaults.punks : v4.weth;
  const token1 = token0 === d.vaults.punks ? v4.weth : d.vaults.punks;
  const key = {
    currency0: token0,
    currency1: token1,
    fee: LP_FEE,
    tickSpacing: TICK_SPACING,
    hooks: d.druse.hook,
  };
  const pTokenIs0 = token0.toLowerCase() === d.vaults.punks.toLowerCase();
  const hook = await ethers.getContractAt("DruseHook", d.druse.hook, wallet);
  await send(hook.increaseObservationCardinalityNext(key, 16, { nonce: take() }));
  console.log("3 ok  pool", { token0, token1, pTokenIs0, sqrtPriceX96: stored.toString() });

  // --- 4. Wrap ETH, add liquidity ---
  const wethAmt = ethers.parseEther("0.002");
  const wethBal = await weth.balanceOf(me);
  if (wethBal < wethAmt) {
    await send(weth.deposit({ value: wethAmt - wethBal, nonce: take() }));
  }
  const pToken = await erc20(d.vaults.punks);
  await send(
    pToken.approve(v4.poolModifyLiquidityTest, ethers.MaxUint256, { nonce: take() })
  );
  await send(
    weth.approve(v4.poolModifyLiquidityTest, ethers.MaxUint256, { nonce: take() })
  );
  await send(
    pToken.approve(v4.poolSwapTest, ethers.MaxUint256, { nonce: take() })
  );
  await send(weth.approve(v4.poolSwapTest, ethers.MaxUint256, { nonce: take() }));

  const tickLower = -48000;
  const tickUpper = -44000;
  const liquidityDelta = 10n ** 15n;
  const liq = new ethers.Contract(v4.poolModifyLiquidityTest, LIQ_ABI, wallet);
  console.log(
    "liq balances",
    "pTOKEN",
    ethers.formatEther(await pToken.balanceOf(me)),
    "WETH",
    ethers.formatEther(await weth.balanceOf(me))
  );
  await send(
    liq.modifyLiquidity(
      key,
      { tickLower, tickUpper, liquidityDelta, salt: ethers.ZeroHash },
      "0x",
      { nonce: take(), gasLimit: 2_000_000n }
    )
  );
  console.log("4 ok  added liquidity L=", liquidityDelta.toString());

  // --- 5. Exact-in WETH swap; hook takes 1% ---
  const swapIn = ethers.parseEther("0.0002");
  const hookFee = (swapIn * 10_000n) / 1_000_000n;
  const stakingWethBefore = await weth.balanceOf(d.druse.staking);
  const walletWethBefore = await weth.balanceOf(me);
  const earnedBefore = await staking.earned(me);

  const swapper = new ethers.Contract(v4.poolSwapTest, SWAP_ABI, wallet);
  const zeroForOne = pTokenIs0 ? false : true; // WETH -> pTOKEN
  await send(
    swapper.swap(
      key,
      {
        zeroForOne,
        amountSpecified: -swapIn,
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n,
      },
      { takeClaims: false, settleUsingBurn: false },
      "0x",
      { nonce: take() }
    )
  );

  const stakingWethAfter = await weth.balanceOf(d.druse.staking);
  const earnedAfter = await staking.earned(me);
  const stakerShare = (hookFee * 60n) / 100n;
  assert(
    stakingWethAfter >= stakingWethBefore + stakerShare,
    `staking WETH ${stakingWethAfter - stakingWethBefore} < expected ${stakerShare}`
  );
  assert(earnedAfter > earnedBefore, "staker should have new WETH rewards");
  console.log("5 ok  swapped", ethers.formatEther(swapIn), "WETH in; hook fee", ethers.formatEther(hookFee));
  console.log("   staking WETH +", ethers.formatEther(stakingWethAfter - stakingWethBefore));
  console.log("   earned +", ethers.formatEther(earnedAfter - earnedBefore));
  console.log("   wallet WETH delta", ethers.formatEther((await weth.balanceOf(me)) - walletWethBefore));

  await send(staking.getReward({ nonce: take() }));
  console.log("5b ok claimed staking rewards");

  // --- 5c. TWAP: NFTX fallback needs time after last write (new block) ---
  await send(wallet.sendTransaction({ to: me, value: 0, nonce: take() }));
  const twapX96 = await factory.getTwapX96(d.vaults.punks);
  assert(twapX96 > 0n, "TWAP should be non-zero once an observation exists");
  console.log("5c ok twapX96", twapX96.toString());

  // --- 6. Redeem 1 NFT (vault fee + snipe premium in ETH) ---
  const vaultIds = await idsOwnedBy(d.vaults.punks);
  assert(vaultIds.length > 0, "vault empty, nothing to redeem");
  const redeemId = vaultIds[0];
  await send(
    vault.redeem([redeemId], me, 0, ethers.MaxUint256, false, {
      nonce: take(),
    })
  );
  assert((await nft721.ownerOf(redeemId)) === me, `punk #${redeemId} should be back in wallet`);
  console.log("6 ok  redeemed punk", redeemId.toString());

  // --- 7. Vault inventory swap ---
  const walletIds = await idsOwnedBy(me);
  const stillInVault = await idsOwnedBy(d.vaults.punks);
  assert(walletIds.length > 0 && stillInVault.length > 0, "need an NFT in wallet and one in vault");
  const inId = walletIds[0];
  const outId = stillInVault[0];
  if (!(await punksNft.isApprovedForAll(me, d.vaults.punks))) {
    await send(punksNft.setApprovalForAll(d.vaults.punks, true, { nonce: take() }));
  }
  await send(
    vault.swap([inId], [], [outId], me, me, ethers.MaxUint256, false, {
      nonce: take(),
    })
  );
  assert((await nft721.ownerOf(inId)) === d.vaults.punks, `vault should own #${inId}`);
  assert((await nft721.ownerOf(outId)) === me, `wallet should own #${outId}`);
  console.log("7 ok  vault swap", inId.toString(), "in /", outId.toString(), "out");

  d.e2e = {
    ok: true,
    at: new Date().toISOString(),
    pool: key,
    steps: [
      "stake DRUSE",
      "mint 5 ERC721 + 2 ERC1155 into vaults",
      "create v4 1% pool",
      "add liquidity",
      "swap WETH exact-in (hook 1% -> 60/30/10)",
      "claim staking rewards",
      "TWAP (NFTX observe math)",
      "redeem 1 punk",
      "vault NFT swap",
    ],
  };
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(all, null, 2) + "\n");
  console.log("\nend-to-end passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
