import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  pad,
  toHex,
  type Address,
} from "viem";
import { createPublicClient, http } from "viem";
import { DRUSE_LP_FEE, DRUSE_TICK_SPACING, getUniswap } from "@/config/uniswap";
import {
  DEFAULT_CHAIN_ID,
  getDeployment,
  type LiveVault,
} from "@/lib/druse";
import { loadLiveVaults } from "@/lib/live-vaults";
import { robinhoodChain } from "@/lib/rpc";
import {
  amountsForLiquidity,
  feesFromGrowth,
  MAX_TICK,
  MIN_TICK,
  nearestUsableTick,
  pTokenPriceEth,
  priceToTick,
  ticksFromPositionInfo,
  tickToSqrtPriceX96,
} from "@/lib/v4-math";
import { drusePoolKey, type PoolKey } from "@/lib/universalRouter";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";

export const LAUNCHER_ABI = [
  { type: "error", name: "NotOperator" },
  { type: "error", name: "PoolExists" },
  { type: "error", name: "ZeroAddress" },
  { type: "error", name: "HookAlreadySet" },
  {
    type: "function",
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pToken", type: "address" },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    outputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "poolKeys",
    stateMutability: "view",
    inputs: [{ name: "pToken", type: "address" }],
    outputs: [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
  },
  {
    type: "function",
    name: "sqrtPriceX96Of",
    stateMutability: "view",
    inputs: [{ name: "pToken", type: "address" }],
    outputs: [{ type: "uint160" }],
  },
] as const;

export const HOOK_ABI = [
  {
    type: "function",
    name: "increaseObservationCardinalityNext",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "observationCardinalityNext", type: "uint16" },
    ],
    outputs: [],
  },
] as const;

export const POSITION_MANAGER_ABI = [
  {
    type: "function",
    name: "modifyLiquidities",
    stateMutability: "payable",
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPoolAndPositionInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

export const STATE_VIEW_ABI = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "getFeeGrowthInside",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
    ],
    outputs: [
      { name: "feeGrowthInside0X128", type: "uint256" },
      { name: "feeGrowthInside1X128", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPositionInfo",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
  {
    type: "function",
    name: "getTickBitmap",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tick", type: "int16" },
    ],
    outputs: [{ name: "tickBitmap", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTickLiquidity",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tick", type: "int24" },
    ],
    outputs: [
      { name: "liquidityGross", type: "uint128" },
      { name: "liquidityNet", type: "int128" },
    ],
  },
] as const;

const POOL_KEY_COMPONENTS = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

export const RESERVES_LENS_ABI = [
  {
    type: "function",
    name: "getPoolTVL",
    stateMutability: "view",
    inputs: [
      { name: "manager", type: "address" },
      { name: "key", type: "tuple", components: POOL_KEY_COMPONENTS },
    ],
    outputs: [
      {
        name: "result",
        type: "tuple",
        components: [
          { name: "coreAmount0", type: "uint256" },
          { name: "coreAmount1", type: "uint256" },
          { name: "hookReserves0", type: "uint256" },
          { name: "hookReserves1", type: "uint256" },
          { name: "hookEffective0", type: "uint256" },
          { name: "hookEffective1", type: "uint256" },
          { name: "sqrtPriceX96", type: "uint160" },
          { name: "tick", type: "int24" },
          { name: "activeLiquidity", type: "uint128" },
          { name: "blockNumber", type: "uint256" },
          { name: "statsProvider", type: "address" },
          { name: "hookPermissions", type: "uint16" },
          { name: "hasCustomAccounting", type: "bool" },
          { name: "statsStatus", type: "uint8" },
        ],
      },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const WETH_ABI = [
  ...ERC20_ABI,
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;

export const Actions = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  BURN_POSITION: 0x03,
  SETTLE: 0x0b,
  SETTLE_PAIR: 0x0d,
  TAKE_PAIR: 0x11,
  CLOSE_CURRENCY: 0x12,
  SWEEP: 0x14,
  WRAP: 0x15,
} as const;

const OPEN_DELTA = 0n;
const NATIVE = "0x0000000000000000000000000000000000000000" as Address;
const MSG_SENDER = "0x0000000000000000000000000000000000000001" as Address;

export type LivePool = {
  vault: LiveVault;
  exists: boolean;
  currency0: string;
  currency1: string;
  pTokenIs0: boolean;
  sqrtPriceX96: string;
  tick: number;
  priceEth: number | null;
  fee: number;
  tickSpacing: number;
  pToken: number;
  eth: number;
  liquidity: string;
};

export function poolTvlEth(pool: LivePool) {
  const px = pool.priceEth && pool.priceEth > 0 ? pool.priceEth : 0;
  return pool.eth + pool.pToken * px;
}

export function poolTvlUsd(pool: LivePool) {
  const tvlEth = poolTvlEth(pool);
  const floorEth = pool.vault.floorEth;
  const floorUsd = pool.vault.floorUsd;
  if (!(tvlEth > 0) || !floorEth || !floorUsd || floorEth <= 0) return null;
  return tvlEth * (floorUsd / floorEth);
}

export type LivePosition = {
  tokenId: string;
  vault: string;
  id: string | null;
  name: string;
  symbol: string;
  image: string | null;
  pToken: number;
  eth: number;
  feesEth: number;
  feePToken: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  inRange: boolean;
  priceEth: number | null;
  priceLower: number | null;
  priceUpper: number | null;
  liquidity: string;
};

export function poolIdOf(key: PoolKey) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

export function weiToNum(wei: bigint) {
  return Number(wei) / 1e18;
}

export function numToWei(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.floor(n * 1e18));
}

type PoolAmounts = { pToken: number; eth: number; liquidity: string };

function emptyAmounts(): PoolAmounts {
  return { pToken: 0, eth: 0, liquidity: "0" };
}

function amountsFromWei(amount0: bigint, amount1: bigint, liquidity: bigint, pTokenIs0: boolean): PoolAmounts {
  return {
    pToken: weiToNum(pTokenIs0 ? amount0 : amount1),
    eth: weiToNum(pTokenIs0 ? amount1 : amount0),
    liquidity: liquidity.toString(),
  };
}

function compressedTick(tick: number, spacing: number) {
  let c = Math.trunc(tick / spacing);
  if (tick < 0 && tick % spacing !== 0) c -= 1;
  return c;
}

function bitmapWordRange(spacing: number) {
  const minWord = compressedTick(MIN_TICK, spacing) >> 8;
  const maxWord = compressedTick(MAX_TICK, spacing) >> 8;
  return { minWord, maxWord };
}

function ticksInBitmap(wordPos: number, bitmap: bigint, spacing: number) {
  const ticks: number[] = [];
  if (bitmap === 0n) return ticks;
  for (let bit = 0; bit < 256; bit++) {
    if (((bitmap >> BigInt(bit)) & 1n) === 0n) continue;
    ticks.push(((wordPos << 8) + bit) * spacing);
  }
  return ticks;
}

async function readPoolAmountsFromTicks(
  key: PoolKey,
  pTokenIs0: boolean,
  stateView: Address,
  sqrtPriceX96: bigint,
): Promise<PoolAmounts> {
  const id = poolIdOf(key);
  const { minWord, maxWord } = bitmapWordRange(key.tickSpacing);
  const words = Array.from({ length: maxWord - minWord + 1 }, (_, i) => minWord + i);
  const [bitmaps, active] = await Promise.all([
    Promise.all(
      words.map((wordPos) =>
        client.readContract({
          address: stateView,
          abi: STATE_VIEW_ABI,
          functionName: "getTickBitmap",
          args: [id, wordPos],
        }),
      ),
    ),
    client.readContract({
      address: stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getLiquidity",
      args: [id],
    }),
  ]);
  const ticks = words.flatMap((wordPos, i) => ticksInBitmap(wordPos, bitmaps[i], key.tickSpacing));
  ticks.sort((a, b) => a - b);
  if (ticks.length < 2) return emptyAmounts();

  const nets = await Promise.all(
    ticks.map((tick) =>
      client.readContract({
        address: stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getTickLiquidity",
        args: [id, tick],
      }),
    ),
  );

  let liquidity = 0n;
  let amount0 = 0n;
  let amount1 = 0n;
  for (let i = 0; i < ticks.length - 1; i++) {
    liquidity += nets[i][1];
    if (liquidity <= 0n) continue;
    const part = amountsForLiquidity(sqrtPriceX96, ticks[i], ticks[i + 1], liquidity);
    amount0 += part.amount0;
    amount1 += part.amount1;
  }
  return amountsFromWei(amount0, amount1, active, pTokenIs0);
}

async function readPoolAmounts(
  key: PoolKey,
  pTokenIs0: boolean,
  stateView: Address,
  poolManager: Address,
  reservesLens: Address | undefined,
  sqrtPriceX96: bigint,
): Promise<PoolAmounts> {
  if (reservesLens) {
    try {
      const tvl = await client.readContract({
        address: reservesLens,
        abi: RESERVES_LENS_ABI,
        functionName: "getPoolTVL",
        args: [poolManager, key],
      });
      const amounts = amountsFromWei(tvl.coreAmount0, tvl.coreAmount1, tvl.activeLiquidity, pTokenIs0);
      if (amounts.pToken > 0 || amounts.eth > 0 || amounts.liquidity !== "0") return amounts;
    } catch {
      /* fall through to tick scan */
    }
  }
  try {
    return await readPoolAmountsFromTicks(key, pTokenIs0, stateView, sqrtPriceX96);
  } catch {
    return emptyAmounts();
  }
}

function idlePool(vault: LiveVault, weth: string, extra?: Partial<LivePool>): LivePool {
  return {
    vault,
    exists: false,
    currency0: "",
    currency1: "",
    pTokenIs0: vault.vault.toLowerCase() < weth,
    sqrtPriceX96: "0",
    tick: 0,
    priceEth: vault.floorEth,
    fee: DRUSE_LP_FEE,
    tickSpacing: DRUSE_TICK_SPACING,
    ...emptyAmounts(),
    ...extra,
  };
}

export function encodeMint(args: {
  key: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
  owner: Address;
  weth: Address;
}) {
  const actions = encodePacked(
    ["uint8", "uint8", "uint8", "uint8", "uint8"],
    [
      Actions.MINT_POSITION,
      Actions.WRAP,
      Actions.SETTLE,
      Actions.CLOSE_CURRENCY,
      Actions.SWEEP,
    ],
  );
  const pToken =
    args.key.currency0.toLowerCase() === args.weth.toLowerCase()
      ? args.key.currency1
      : args.key.currency0;
  const mint = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { type: "int24" },
      { type: "int24" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "address" },
      { type: "bytes" },
    ],
    [
      args.key,
      args.tickLower,
      args.tickUpper,
      args.liquidity,
      args.amount0Max,
      args.amount1Max,
      args.owner,
      "0x",
    ],
  );
  const wrap = encodeAbiParameters([{ type: "uint256" }], [OPEN_DELTA]);
  const settleWeth = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
    [args.weth as Address, OPEN_DELTA, false],
  );
  const closeP = encodeAbiParameters([{ type: "address" }], [pToken]);
  const sweep = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [NATIVE, MSG_SENDER],
  );
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [mint, wrap, settleWeth, closeP, sweep]],
  );
}

export function encodeCollect(args: {
  tokenId: bigint;
  currency0: Address;
  currency1: Address;
  recipient: Address;
}) {
  const actions = encodePacked(["uint8", "uint8"], [Actions.DECREASE_LIQUIDITY, Actions.TAKE_PAIR]);
  const decrease = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [args.tokenId, 0n, 0n, 0n, "0x"],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [args.currency0, args.currency1, args.recipient],
  );
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [decrease, take]],
  );
}

export function encodeRemove(args: {
  tokenId: bigint;
  liquidity: bigint;
  currency0: Address;
  currency1: Address;
  recipient: Address;
}) {
  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [Actions.DECREASE_LIQUIDITY, Actions.TAKE_PAIR, Actions.BURN_POSITION],
  );
  const decrease = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [args.tokenId, args.liquidity, 0n, 0n, "0x"],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [args.currency0, args.currency1, args.recipient],
  );
  const burn = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [args.tokenId, 0n, 0n, "0x"],
  );
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [decrease, take, burn]],
  );
}

export function initSqrtFromFloor(floorEth: number, pToken: string, weth: string) {
  if (!Number.isFinite(floorEth) || floorEth <= 0) return 0n;
  const pTokenIs0 = pToken.toLowerCase() < weth.toLowerCase();
  const price = pTokenIs0 ? floorEth : 1 / floorEth;
  return tickToSqrtPriceX96(nearestUsableTick(priceToTick(price), DRUSE_TICK_SPACING));
}

export async function loadPools(): Promise<LivePool[]> {
  const vaults = await loadLiveVaults();
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const launcher = d.druse?.launcher as Address | undefined;
  const hook = (d.druse?.hook ?? "").toLowerCase();
  const weth = (d.uniswapV4?.weth ?? uni.weth).toLowerCase();
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as Address;
  const poolManager = uni.poolManager;
  const reservesLens = uni.reservesLens;
  if (!launcher) {
    return vaults.map((vault) => idlePool(vault, weth));
  }

  const { quotePTokenPriceEth } = await import("@/lib/quote");
  const rows = await Promise.all(
    vaults.map(async (vault) => {
      try {
        const rawKey = await client.readContract({
          address: launcher,
          abi: LAUNCHER_ABI,
          functionName: "poolKeys",
          args: [vault.vault as Address],
        });
        const key = rawKey as readonly [`0x${string}`, `0x${string}`, number, number, `0x${string}`];
        const currency0 = key[0].toLowerCase();
        const exists = currency0 !== "0x0000000000000000000000000000000000000000";
        if (!exists) return idlePool(vault, weth);
        const poolKey = drusePoolKey(vault.vault as Address, weth as Address, hook as Address);
        const pTokenIs0 = vault.vault.toLowerCase() === currency0;
        const slot0 = await client.readContract({
          address: stateView,
          abi: STATE_VIEW_ABI,
          functionName: "getSlot0",
          args: [poolIdOf(poolKey)],
        });
        const amounts = await readPoolAmounts(
          poolKey,
          pTokenIs0,
          stateView,
          poolManager,
          reservesLens,
          slot0[0],
        );
        const quoted = await quotePTokenPriceEth(vault.vault);
        return {
          vault,
          exists: true,
          currency0,
          currency1: key[1].toLowerCase(),
          pTokenIs0,
          sqrtPriceX96: slot0[0].toString(),
          tick: Number(slot0[1]),
          priceEth: quoted || pTokenPriceEth(slot0[0], pTokenIs0) || vault.floorEth,
          fee: Number(key[2]),
          tickSpacing: Number(key[3]),
          ...amounts,
        } satisfies LivePool;
      } catch {
        return idlePool(vault, weth);
      }
    }),
  );
  return rows;
}

async function positionIds(wallet: string, manager: string) {
  try {
    const res = await fetch(
      `${BLOCKSCOUT}/api/v2/addresses/${wallet}/nft?type=ERC-721`,
      { next: { revalidate: 8 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: { id?: string; token?: { address_hash?: string } }[];
    };
    return (data.items ?? [])
      .filter(
        (item) =>
          item.token?.address_hash?.toLowerCase() === manager.toLowerCase() && item.id,
      )
      .map((item) => String(item.id));
  } catch {
    return [];
  }
}

export async function loadPositions(wallet: string): Promise<LivePosition[]> {
  const pools = await loadPools();
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const hook = (d.druse?.hook ?? "").toLowerCase();
  const weth = (d.uniswapV4?.weth ?? uni.weth).toLowerCase();
  const manager = (d.uniswapV4?.positionManager ?? uni.positionManager) as Address;
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as Address;
  const byPToken = new Map(pools.map((p) => [p.vault.vault.toLowerCase(), p]));
  const ids = await positionIds(wallet, manager);
  const out: LivePosition[] = [];
  for (const id of ids) {
    try {
      const pos = await readLivePosition(id, manager, stateView, hook, weth, byPToken);
      if (pos) out.push(pos);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function loadPosition(tokenId: string): Promise<LivePosition | null> {
  const pools = await loadPools();
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const hook = (d.druse?.hook ?? "").toLowerCase();
  const weth = (d.uniswapV4?.weth ?? uni.weth).toLowerCase();
  const manager = (d.uniswapV4?.positionManager ?? uni.positionManager) as Address;
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as Address;
  const byPToken = new Map(pools.map((p) => [p.vault.vault.toLowerCase(), p]));
  try {
    return await readLivePosition(tokenId, manager, stateView, hook, weth, byPToken);
  } catch {
    return null;
  }
}

async function readLivePosition(
  tokenId: string,
  manager: Address,
  stateView: Address,
  hook: string,
  weth: string,
  byPToken: Map<string, LivePool>,
): Promise<LivePosition | null> {
  const [meta, liquidity] = await Promise.all([
    client.readContract({
      address: manager,
      abi: POSITION_MANAGER_ABI,
      functionName: "getPoolAndPositionInfo",
      args: [BigInt(tokenId)],
    }),
    client.readContract({
      address: manager,
      abi: POSITION_MANAGER_ABI,
      functionName: "getPositionLiquidity",
      args: [BigInt(tokenId)],
    }),
  ]);
  const [poolKey, info] = meta;
  if (hook && poolKey.hooks.toLowerCase() !== hook) return null;
  const pToken = [poolKey.currency0, poolKey.currency1].find((c) => c.toLowerCase() !== weth);
  if (!pToken) return null;
  const pool = byPToken.get(pToken.toLowerCase());
  if (!pool) return null;

  const { tickLower, tickUpper } = ticksFromPositionInfo(info);
  const id = poolIdOf(poolKey);
  const slot0 = await client.readContract({
    address: stateView,
    abi: STATE_VIEW_ABI,
    functionName: "getSlot0",
    args: [id],
  });
  const { amount0, amount1 } = amountsForLiquidity(slot0[0], tickLower, tickUpper, liquidity);
  const pIs0 = poolKey.currency0.toLowerCase() === pToken.toLowerCase();
  const pTokenWei = pIs0 ? amount0 : amount1;
  const ethWei = pIs0 ? amount1 : amount0;
  const currentTick = Number(slot0[1]);
  const inRange = currentTick >= tickLower && currentTick < tickUpper;
  const priceEth = pTokenPriceEth(slot0[0], pIs0);
  const priceLower = pTokenPriceEth(tickToSqrtPriceX96(pIs0 ? tickLower : tickUpper), pIs0);
  const priceUpper = pTokenPriceEth(tickToSqrtPriceX96(pIs0 ? tickUpper : tickLower), pIs0);

  let feesEth = 0;
  let feePToken = 0;
  try {
    const [growth, stored] = await Promise.all([
      client.readContract({
        address: stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getFeeGrowthInside",
        args: [id, tickLower, tickUpper],
      }),
      client.readContract({
        address: stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getPositionInfo",
        args: [id, manager, tickLower, tickUpper, pad(toHex(BigInt(tokenId)), { size: 32 })],
      }),
    ]);
    const fee0 = feesFromGrowth(liquidity, growth[0], stored[1]);
    const fee1 = feesFromGrowth(liquidity, growth[1], stored[2]);
    const feeP = pIs0 ? fee0 : fee1;
    const feeW = pIs0 ? fee1 : fee0;
    feePToken = weiToNum(feeP);
    feesEth = weiToNum(feeW) + feePToken * (priceEth || 0);
  } catch {
    feesEth = 0;
  }

  return {
    tokenId,
    vault: pool.vault.vault,
    id: pool.vault.id,
    name: pool.vault.name,
    symbol: pool.vault.symbol,
    image: pool.vault.image || pool.vault.art,
    pToken: weiToNum(pTokenWei),
    eth: weiToNum(ethWei),
    feesEth,
    feePToken,
    tickLower,
    tickUpper,
    currentTick,
    inRange,
    priceEth,
    priceLower,
    priceUpper,
    liquidity: liquidity.toString(),
  };
}

export function feeLabel(fee: number) {
  return `${(fee / 10_000).toFixed(2).replace(/\.00$/, "")}%`;
}

export { DRUSE_LP_FEE, DRUSE_TICK_SPACING };
