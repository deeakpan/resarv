/**
 * Bootstrap Spritehood Wisps on Robinhood Chain:
 * fee-exclude deployer → create vault → (optional buy) → mint → create pool → add LP.
 *
 * Buy needs OPENSEA_API_KEY. Or set TOKEN_ID if you already own a Wisp.
 * Max buy: MAX_BUY_USD (default 15).
 */
import fs from "fs";
import path from "path";
import https from "https";
import { ethers } from "hardhat";
import { DRUSE_TICK_SPACING } from "../config/uniswap";

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");
const WISP_NFT = "0xd6577124F96394faee65AfD2408f2ffA88445f63";
const WISP_SLUG = "spritehood-wisps";
const MAX_BUY_USD = Number(process.env.MAX_BUY_USD || 15);
const ETH_USD_FALLBACK = 2500;
const WETH_PCT = Number(process.env.WETH_PCT || 40); // % of remaining ETH for LP after buy/gas reserve

function loadAddresses() {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"));
}

function saveAddresses(all: unknown) {
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(all, null, 2) + "\n");
}

function getWallet() {
  const chainId = Number(process.env.CHAIN_ID || 4663);
  const rpcHost = process.env.RPC_HOST || "rpc.mainnet.chain.robinhood.com";
  const rpcUrl = process.env.RPC_URL || `https://${rpcHost}`;
  const rpcIp = process.env.RPC_IP || "104.20.46.209";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;

  class FetchJsonRpcProvider extends ethers.JsonRpcApiProvider {
    constructor() {
      super(ethers.Network.from(chainId), { staticNetwork: true });
    }
    async _send(payload: unknown) {
      const body = JSON.stringify(payload);
      const result = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: rpcIp,
            servername: rpcHost,
            method: "POST",
            path: "/",
            headers: {
              host: rpcHost,
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            timeout: 60_000,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
              } catch (err) {
                reject(err);
              }
            });
          },
        );
        req.on("error", reject);
        req.end(body);
      });
      return Array.isArray(result) ? result : [result];
    }
  }

  return new ethers.Wallet(key, new FetchJsonRpcProvider());
}

async function send(txPromise: Promise<{ wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  if (!receipt) throw new Error("missing receipt");
  return receipt;
}

function httpsJson(
  hostname: string,
  servername: string,
  ip: string,
  method: string,
  urlPath: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<any> {
  const payload = body == null ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip,
        servername,
        method,
        path: urlPath,
        headers: {
          host: servername,
          accept: "application/json",
          origin: "https://opensea.io",
          referer: "https://opensea.io/",
          "user-agent": "Mozilla/5.0 DruseBootstrap",
          ...(payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode, json: JSON.parse(text) });
          } catch {
            resolve({ status: res.statusCode, text });
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.end(payload);
    else req.end();
  });
}

async function gqlOpenSea(query: string) {
  const { json } = await httpsJson(
    "gql.opensea.io",
    "gql.opensea.io",
    "104.18.33.97",
    "POST",
    "/graphql",
    { query },
  );
  if (json?.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  return json.data;
}

function priceToTick(price: number) {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

function nearestUsableTick(tick: number, spacing: number) {
  return Math.round(tick / spacing) * spacing;
}

function tickToSqrtPriceX96(tick: number): bigint {
  const abs = tick < 0 ? -tick : tick;
  let ratio =
    (abs & 0x1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
  if (abs & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (abs & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (abs & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (abs & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (abs & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if (abs & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if (abs & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if (abs & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if (abs & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if (abs & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if (abs & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if (abs & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if (abs & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if (abs & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if (abs & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if (abs & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if (abs & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if (abs & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if (abs & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;
  return ratio >> 32n;
}

function initSqrtFromFloor(floorEth: number, pToken: string, weth: string) {
  const pTokenIs0 = pToken.toLowerCase() < weth.toLowerCase();
  const price = pTokenIs0 ? floorEth : 1 / floorEth;
  return tickToSqrtPriceX96(nearestUsableTick(priceToTick(price), DRUSE_TICK_SPACING));
}

function amount0(sqrtA: bigint, sqrtB: bigint, liquidity: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (lo === 0n) return 0n;
  return (liquidity * (2n ** 96n) * (hi - lo)) / hi / lo;
}

function amount1(sqrtA: bigint, sqrtB: bigint, liquidity: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  return (liquidity * (hi - lo)) / (2n ** 96n);
}

function amountsForLiquidity(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
) {
  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  if (sqrtPrice <= sqrtA) return { amount0: amount0(sqrtA, sqrtB, liquidity), amount1: 0n };
  if (sqrtPrice < sqrtB) {
    return {
      amount0: amount0(sqrtPrice, sqrtB, liquidity),
      amount1: amount1(sqrtA, sqrtPrice, liquidity),
    };
  }
  return { amount0: 0n, amount1: amount1(sqrtA, sqrtB, liquidity) };
}

function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amt0: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (lo === 0n || hi <= lo || amt0 <= 0n) return 0n;
  return (amt0 * lo * hi) / ((2n ** 96n) * (hi - lo));
}

function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amt1: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (hi <= lo || amt1 <= 0n) return 0n;
  return (amt1 * (2n ** 96n)) / (hi - lo);
}

function liquidityForAmounts(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  amt0: bigint,
  amt1: bigint,
) {
  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  if (sqrtPrice <= sqrtA) return liquidityForAmount0(sqrtA, sqrtB, amt0);
  if (sqrtPrice >= sqrtB) return liquidityForAmount1(sqrtA, sqrtB, amt1);
  const liq0 = liquidityForAmount0(sqrtPrice, sqrtB, amt0);
  const liq1 = liquidityForAmount1(sqrtA, sqrtPrice, amt1);
  return liq0 < liq1 ? liq0 : liq1;
}

function encodeMintPosition(args: {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
  owner: string;
  weth: string;
}) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  // Actions: MINT_POSITION, WRAP, SETTLE, CLOSE_CURRENCY, SWEEP
  const actions = ethers.hexlify(Uint8Array.from([0x02, 0x15, 0x0b, 0x12, 0x14]));
  const keyTuple = [
    args.currency0,
    args.currency1,
    args.fee,
    args.tickSpacing,
    args.hooks,
  ];
  const mint = coder.encode(
    [
      "tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)",
      "int24",
      "int24",
      "uint256",
      "uint128",
      "uint128",
      "address",
      "bytes",
    ],
    [keyTuple, args.tickLower, args.tickUpper, args.liquidity, args.amount0Max, args.amount1Max, args.owner, "0x"],
  );
  const wrap = coder.encode(["uint256"], [0]);
  const settleWeth = coder.encode(["address", "uint256", "bool"], [args.weth, 0, false]);
  const pToken =
    args.currency0.toLowerCase() === args.weth.toLowerCase()
      ? args.currency1
      : args.currency0;
  const closeP = coder.encode(["address"], [pToken]);
  const sweep = coder.encode(
    ["address", "address"],
    ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001"],
  );
  return coder.encode(["bytes", "bytes[]"], [actions, [mint, wrap, settleWeth, closeP, sweep]]);
}

async function tryBuyWithOpenSeaApi(wallet: ethers.Wallet, maxUsd: number) {
  const apiKey = process.env.OPENSEA_API_KEY?.trim();
  if (!apiKey) {
    console.log("skip buy: set OPENSEA_API_KEY to purchase from OpenSea");
    return null as string | null;
  }

  const data = await gqlOpenSea(`query {
    collectionItems(
      collectionSlug: "${WISP_SLUG}",
      sort: { by: PRICE, direction: ASC },
      filter: { isListed: true }
    ) {
      items {
        tokenId
        bestListing {
          id
          pricePerItem { token { unit } usd }
        }
      }
    }
  }`);

  const item = data.collectionItems.items.find(
    (row: { bestListing?: { pricePerItem?: { usd?: number; token?: { unit?: number } } } }) => {
      const usd = row.bestListing?.pricePerItem?.usd;
      const eth = row.bestListing?.pricePerItem?.token?.unit;
      const approx = usd ?? (eth ?? 99) * ETH_USD_FALLBACK;
      return approx > 0 && approx <= maxUsd;
    },
  );
  if (!item) throw new Error(`No listing under $${maxUsd}`);

  const ethPrice = item.bestListing.pricePerItem.token.unit as number;
  const usdPrice = item.bestListing.pricePerItem.usd as number;
  console.log("buying token", item.tokenId, "eth", ethPrice, "usd", usdPrice);

  // Best listing endpoint for order hash
  const best = await httpsJson(
    "api.opensea.io",
    "api.opensea.io",
    "104.18.33.97",
    "GET",
    `/api/v2/listings/collection/${WISP_SLUG}/nfts/${item.tokenId}/best`,
    undefined,
    { "x-api-key": apiKey },
  );
  if (best.status !== 200) {
    throw new Error(`best listing HTTP ${best.status}: ${JSON.stringify(best.json || best.text)}`);
  }
  const listing = best.json?.listings?.[0] || best.json;
  const orderHash = listing?.order_hash || listing?.orderHash;
  const protocol = listing?.protocol_address || "0x0000000000000068F116a894984e2DB1123eB395";
  if (!orderHash) throw new Error(`No order hash in best listing: ${JSON.stringify(best.json)}`);

  const fulfill = await httpsJson(
    "api.opensea.io",
    "api.opensea.io",
    "104.18.33.97",
    "POST",
    "/api/v2/listings/fulfillment_data",
    {
      listing: { hash: orderHash, chain: "robinhood", protocol_address: protocol },
      fulfiller: { address: await wallet.getAddress() },
    },
    { "x-api-key": apiKey },
  );
  if (fulfill.status !== 200) {
    throw new Error(`fulfill HTTP ${fulfill.status}: ${JSON.stringify(fulfill.json || fulfill.text)}`);
  }

  const tx = fulfill.json?.fulfillment_data?.transaction;
  if (!tx?.to || !tx?.data) throw new Error(`Bad fulfillment payload: ${JSON.stringify(fulfill.json)}`);

  const value = BigInt(tx.value || 0);
  const maxWei = ethers.parseEther(((maxUsd / ETH_USD_FALLBACK) * 1.05).toFixed(8));
  if (value > maxWei) throw new Error(`Buy value ${ethers.formatEther(value)} ETH over $${maxUsd} cap`);

  const sent = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value,
    gasLimit: tx.gas_limit ? BigInt(tx.gas_limit) : 800_000n,
  });
  console.log("buy tx", sent.hash);
  await sent.wait();
  return String(item.tokenId);
}

async function main() {
  const wallet = getWallet();
  const me = await wallet.getAddress();
  let nonce = await wallet.provider!.getTransactionCount(me, "latest");
  const take = () => nonce++;

  const bal = await wallet.provider!.getBalance(me);
  console.log("deployer", me);
  console.log("balance", ethers.formatEther(bal), "ETH");

  const all = loadAddresses();
  const chain = all["4663"];
  if (!chain?.druse?.factory) throw new Error("Missing 4663 druse deployment");
  const { factory: factoryAddr, launcher: launcherAddr } = chain.druse;
  const wethAddr = chain.uniswapV4.weth as string;
  const pm = chain.uniswapV4.positionManager as string;
  const permit2 = chain.uniswapV4.permit2 as string;

  const factory = await ethers.getContractAt("DruseVaultFactory", factoryAddr, wallet);
  const launcher = await ethers.getContractAt("PoolLauncher", launcherAddr, wallet);

  // 1) Fee-exclude deployer
  if (!(await factory.excludedFromFees(me))) {
    console.log("whitelisting deployer for fee exclusion");
    await send(factory.setFeeExclusion(me, true, { nonce: take() }));
  } else {
    console.log("deployer already fee-excluded");
  }

  // 2) Create vault if missing
  let vaultAddr = (chain.vaults && chain.vaults["spritehood-wisps"]) as string | undefined;
  const existingForAsset = (await factory.vaultsForAsset(WISP_NFT)) as string[];
  if (!vaultAddr && existingForAsset.length > 0) {
    vaultAddr = existingForAsset[existingForAsset.length - 1];
  }
  if (!vaultAddr || vaultAddr === ethers.ZeroAddress) {
    console.log("creating Spritehood Wisps vault");
    await send(
      factory.createVault("Spritehood Wisps", "pWISP", WISP_NFT, false, true, {
        nonce: take(),
      }),
    );
    const list = (await factory.vaultsForAsset(WISP_NFT)) as string[];
    if (!list.length) throw new Error("createVault succeeded but vaultsForAsset empty");
    vaultAddr = list[list.length - 1];
  }
  console.log("vault", vaultAddr);

  chain.nfts = { ...(chain.nfts || {}), "spritehood-wisps": WISP_NFT };
  chain.vaults = { ...(chain.vaults || {}), "spritehood-wisps": vaultAddr };
  chain.demo = chain.demo || { collections: [] };
  // keep demo mocks listed separately; real collection mapping for UI
  chain.collections = {
    ...(chain.collections || {}),
    "spritehood-wisps": { nft: WISP_NFT, vault: vaultAddr },
  };
  chain.updatedAt = new Date().toISOString();
  all["4663"] = chain;
  saveAddresses(all);

  // 3) Buy or use existing token
  let tokenId = process.env.TOKEN_ID?.trim() || "";
  if (!tokenId) {
    const nft = await ethers.getContractAt("IERC721", WISP_NFT, wallet);
    // scan recent owned via balance + tokenOfOwnerByIndex if enumerable — WISP may not be
    try {
      tokenId = (await tryBuyWithOpenSeaApi(wallet, MAX_BUY_USD)) || "";
      nonce = await wallet.provider!.getTransactionCount(me, "latest");
    } catch (err) {
      console.error("buy failed:", err instanceof Error ? err.message : err);
    }
  }
  if (!tokenId) {
    console.log(
      "Stopped before deposit/pool. Add OPENSEA_API_KEY and re-run, or buy a Wisp under $15 then re-run with TOKEN_ID=<id>.",
    );
    console.log("OpenSea floor item example: https://opensea.io/collection/spritehood-wisps");
    return;
  }

  const vault = await ethers.getContractAt("DruseVault", vaultAddr, wallet);
  const nft = new ethers.Contract(
    WISP_NFT,
    [
      "function ownerOf(uint256) view returns (address)",
      "function setApprovalForAll(address,bool)",
      "function isApprovedForAll(address,address) view returns (bool)",
      "function approve(address,uint256)",
      "function getApproved(uint256) view returns (address)",
      "function safeTransferFrom(address from, address to, uint256 tokenId)",
      "function transferFrom(address from, address to, uint256 tokenId)",
    ],
    wallet,
  );

  const owner = (await nft.ownerOf(tokenId)).toLowerCase();
  if (owner !== me.toLowerCase() && owner !== vaultAddr.toLowerCase()) {
    throw new Error(`Token ${tokenId} owned by ${owner}, not deployer/vault`);
  }

  // 4) Floor + create pool BEFORE deposit (price set at OpenSea floor)
  const floorData = await gqlOpenSea(`query {
    collectionBySlug(slug: "${WISP_SLUG}") {
      ... on Collection {
        floorPrice { pricePerItem { token { unit } usd } }
      }
    }
  }`);
  const floorEth =
    Number(floorData.collectionBySlug?.floorPrice?.pricePerItem?.token?.unit) || 0.0048;
  console.log("floorEth", floorEth);

  const existing = await launcher.sqrtPriceX96Of(vaultAddr);
  if (existing === 0n) {
    const sqrt = initSqrtFromFloor(floorEth, vaultAddr, wethAddr);
    console.log("creating pool at floor sqrt", sqrt.toString());
    await send(launcher.createPool(vaultAddr, sqrt, { nonce: take() }));
  } else {
    console.log("pool already exists", existing.toString());
  }

  // 5) Deposit NFT → mint pWISP (skip if already minted)
  let pBal = await vault.balanceOf(me);
  const ownedByVault =
    ((await nft.ownerOf(tokenId)) as string).toLowerCase() === vaultAddr.toLowerCase();
  if (pBal < ethers.parseEther("1")) {
    if (!ownedByVault) {
      console.log("pushing NFT to vault (owner transfer)");
      await send(nft.safeTransferFrom(me, vaultAddr, tokenId, { nonce: take() }));
    } else {
      console.log("vault already holds NFT", tokenId);
    }
    console.log("minting into vault", tokenId);
    await send(vault.mint([tokenId], [], me, me, { nonce: take() }));
    pBal = await vault.balanceOf(me);
  } else {
    console.log("already have pWISP", ethers.formatEther(pBal));
  }
  console.log("pWISP", ethers.formatEther(pBal));

  // 6) Add liquidity via Position Manager (ETH + pTOKEN), ~WETH_PCT of remaining balance
  const balAfter = await wallet.provider!.getBalance(me);
  const gasReserve = ethers.parseEther("0.001");
  const usable = balAfter > gasReserve ? balAfter - gasReserve : 0n;
  const ethForLp = (usable * BigInt(Math.floor(WETH_PCT))) / 100n;
  if (ethForLp === 0n) throw new Error("Not enough ETH left for LP");
  if (pBal < ethers.parseEther("1")) throw new Error("Need at least 1 pWISP");

  console.log("LP eth budget", ethers.formatEther(ethForLp), `(${WETH_PCT}% of usable)`);

  const hook = chain.druse.hook as string;
  const token0 = vaultAddr.toLowerCase() < wethAddr.toLowerCase() ? vaultAddr : wethAddr;
  const token1 = token0.toLowerCase() === vaultAddr.toLowerCase() ? wethAddr : vaultAddr;
  const pIs0 = vaultAddr.toLowerCase() === token0.toLowerCase();
  const midTick = nearestUsableTick(
    priceToTick(pIs0 ? floorEth : 1 / floorEth),
    DRUSE_TICK_SPACING,
  );
  const tickLower = nearestUsableTick(
    priceToTick(pIs0 ? floorEth * 0.5 : 1 / (floorEth * 1.5)),
    DRUSE_TICK_SPACING,
  );
  const tickUpper = nearestUsableTick(
    priceToTick(pIs0 ? floorEth * 1.5 : 1 / (floorEth * 0.5)),
    DRUSE_TICK_SPACING,
  );
  const [lo, hi] = tickLower < tickUpper ? [tickLower, tickUpper] : [tickUpper, tickLower];
  const sqrt = tickToSqrtPriceX96(midTick);
  const amountP = ethers.parseEther("1");
  const amount0Want = pIs0 ? amountP : ethForLp;
  const amount1Want = pIs0 ? ethForLp : amountP;
  const liq = liquidityForAmounts(sqrt, lo, hi, amount0Want, amount1Want);
  if (liq === 0n) throw new Error("Computed zero liquidity");
  const used = amountsForLiquidity(sqrt, lo, hi, liq);
  console.log("range", lo, hi, "liq", liq.toString(), "used0", used.amount0.toString(), "used1", used.amount1.toString());

  const erc20 = new ethers.Contract(
    vaultAddr,
    [
      "function approve(address,uint256) returns (bool)",
      "function allowance(address,address) view returns (uint256)",
    ],
    wallet,
  );
  const p2 = new ethers.Contract(
    permit2,
    [
      "function approve(address token, address spender, uint160 amount, uint48 expiration)",
    ],
    wallet,
  );

  if ((await erc20.allowance(me, permit2)) < amountP) {
    await send(erc20.approve(permit2, ethers.MaxUint256, { nonce: take() }));
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  await send(p2.approve(vaultAddr, pm, 2n ** 160n - 1n, exp, { nonce: take() }));

  const unlock = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const payload = encodeMintPosition({
    currency0: token0,
    currency1: token1,
    fee: 10_000,
    tickSpacing: DRUSE_TICK_SPACING,
    hooks: hook,
    tickLower: lo,
    tickUpper: hi,
    liquidity: liq,
    amount0Max: (used.amount0 * 105n) / 100n + 1n,
    amount1Max: (used.amount1 * 105n) / 100n + 1n,
    owner: me,
    weth: wethAddr,
  });

  const posm = new ethers.Contract(
    pm,
    ["function modifyLiquidities(bytes unlockData, uint256 deadline) payable"],
    wallet,
  );
  const ethValue = pIs0 ? used.amount1 : used.amount0;
  console.log("adding liquidity value", ethers.formatEther(ethValue));
  await send(
    posm.modifyLiquidities(payload, unlock, {
      value: (ethValue * 105n) / 100n + 1n,
      nonce: take(),
      gasLimit: 2_500_000n,
    }),
  );

  console.log("done");
  console.log({
    vault: vaultAddr,
    tokenId,
    floorEth,
    tickLower: lo,
    tickUpper: hi,
    remainingEth: ethers.formatEther(await wallet.provider!.getBalance(me)),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
