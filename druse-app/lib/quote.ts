import { parseUnits, formatUnits, type Address } from "viem";
import { DEFAULT_CHAIN_ID, getDeployment } from "@/lib/druse";
import { publicClient } from "@/lib/rpc";
import { LAUNCHER_ABI, STATE_VIEW_ABI, poolIdOf } from "@/lib/pools";
import { getUniswap, DRUSE_LP_FEE, DRUSE_TICK_SPACING } from "@/config/uniswap";
import { drusePoolKey, type PathHop } from "@/lib/universalRouter";
import { getWethAddress, isWeth } from "@/lib/swap";

export const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
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
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "exactCurrency", type: "address" },
          {
            name: "path",
            type: "tuple[]",
            components: [
              { name: "intermediateCurrency", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
              { name: "hookData", type: "bytes" },
            ],
          },
          { name: "exactAmount", type: "uint128" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export type QuoteReason = "no_pool" | "no_route" | "no_liquidity" | "invalid";

export type QuoteOk = {
  ok: true;
  amountOut: string;
  hops: PathHop[];
};

export type QuoteErr = {
  ok: false;
  reason: QuoteReason;
};

export type QuoteResult = QuoteOk | QuoteErr;

const ZERO = "0x0000000000000000000000000000000000000000";

function hop(to: Address, hook: Address): PathHop {
  return {
    intermediateCurrency: to,
    fee: DRUSE_LP_FEE,
    tickSpacing: DRUSE_TICK_SPACING,
    hooks: hook,
    hookData: "0x",
  };
}

async function poolLive(pToken: Address, weth: Address, hook: Address) {
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const launcher = d.druse?.launcher as Address | undefined;
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as Address;
  if (!launcher) return { exists: false, liquidity: 0n };

  try {
    const rawKey = await publicClient.readContract({
      address: launcher,
      abi: LAUNCHER_ABI,
      functionName: "poolKeys",
      args: [pToken],
    });
    const key = rawKey as readonly [`0x${string}`, `0x${string}`, number, number, `0x${string}`];
    if (key[0].toLowerCase() === ZERO) return { exists: false, liquidity: 0n };
    try {
      const poolKey = drusePoolKey(pToken, weth, hook);
      const liquidity = await publicClient.readContract({
        address: stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getLiquidity",
        args: [poolIdOf(poolKey)],
      });
      return { exists: true, liquidity };
    } catch {
      return { exists: true, liquidity: 1n };
    }
  } catch {
    return { exists: false, liquidity: 0n };
  }
}

async function quoteSingle(args: {
  pToken: Address;
  tokenIn: Address;
  amountIn: bigint;
  weth: Address;
  hook: Address;
  quoter: Address;
}): Promise<bigint | null> {
  const key = drusePoolKey(args.pToken, args.weth, args.hook);
  const zeroForOne = args.tokenIn.toLowerCase() === key.currency0.toLowerCase();
  try {
    const sim = await publicClient.simulateContract({
      address: args.quoter,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: key,
          zeroForOne,
          exactAmount: args.amountIn,
          hookData: "0x",
        },
      ],
    });
    return sim.result[0];
  } catch {
    return null;
  }
}

async function quotePath(args: {
  tokenIn: Address;
  hops: PathHop[];
  amountIn: bigint;
  quoter: Address;
}): Promise<bigint | null> {
  try {
    const sim = await publicClient.simulateContract({
      address: args.quoter,
      abi: QUOTER_ABI,
      functionName: "quoteExactInput",
      args: [
        {
          exactCurrency: args.tokenIn,
          path: args.hops.map((h) => ({
            intermediateCurrency: h.intermediateCurrency,
            fee: h.fee,
            tickSpacing: h.tickSpacing,
            hooks: h.hooks,
            hookData: h.hookData ?? "0x",
          })),
          exactAmount: args.amountIn,
        },
      ],
    });
    return sim.result[0];
  } catch {
    return null;
  }
}

export function parseAmount(raw: string): bigint | null {
  const s = raw.trim();
  if (!s || s === "." || s === "0." || s === "0") return s === "0" || s === "0." ? 0n : null;
  try {
    return parseUnits(s, 18);
  } catch {
    return null;
  }
}

export async function quoteSwap(tokenIn: string, tokenOut: string, amountRaw: string): Promise<QuoteResult> {
  const amountIn = parseAmount(amountRaw);
  if (amountIn == null) return { ok: false, reason: "invalid" };
  if (amountIn === 0n) return { ok: false, reason: "invalid" };

  const weth = getWethAddress() as Address;
  const inAddr = (isWeth(tokenIn) ? weth : tokenIn).toLowerCase() as Address;
  const outAddr = (isWeth(tokenOut) ? weth : tokenOut).toLowerCase() as Address;
  if (inAddr === outAddr) return { ok: false, reason: "invalid" };

  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const hook = (d.druse?.hook ?? "") as Address;
  const quoter = uni.quoter as Address;
  if (!hook) return { ok: false, reason: "no_route" };

  const sellEth = isWeth(tokenIn);
  const buyEth = isWeth(tokenOut);

  if (sellEth || buyEth) {
    const pToken = (sellEth ? outAddr : inAddr) as Address;
    const live = await poolLive(pToken, weth, hook);
    if (!live.exists) return { ok: false, reason: "no_pool" };
    if (live.liquidity === 0n) return { ok: false, reason: "no_liquidity" };
    const amountOut = await quoteSingle({
      pToken,
      tokenIn: inAddr,
      amountIn,
      weth,
      hook,
      quoter,
    });
    if (amountOut == null || amountOut === 0n) return { ok: false, reason: "no_liquidity" };
    return { ok: true, amountOut: amountOut.toString(), hops: [] };
  }

  const [a, b] = await Promise.all([
    poolLive(inAddr, weth, hook),
    poolLive(outAddr, weth, hook),
  ]);
  if (!a.exists || !b.exists) return { ok: false, reason: "no_route" };
  if (a.liquidity === 0n || b.liquidity === 0n) return { ok: false, reason: "no_liquidity" };

  const hops = [hop(weth, hook), hop(outAddr, hook)];
  const amountOut = await quotePath({ tokenIn: inAddr, hops, amountIn, quoter });
  if (amountOut == null || amountOut === 0n) return { ok: false, reason: "no_liquidity" };
  return { ok: true, amountOut: amountOut.toString(), hops };
}

const PRICE_SIZES = ["0.00001", "0.0001", "0.001", "0.01", "1"] as const;

/** ETH per 1 pTOKEN from the Uniswap quoter (same path as swap). */
export async function quotePTokenPriceEth(pToken: string): Promise<number | null> {
  const weth = getWethAddress() as Address;
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const hook = (d.druse?.hook ?? "") as Address;
  const quoter = uni.quoter as Address;
  if (!hook) return null;
  const token = pToken.toLowerCase() as Address;

  for (const size of PRICE_SIZES) {
    const amountIn = parseUnits(size, 18);
    const amountOut = await quoteSingle({
      pToken: token,
      tokenIn: token,
      amountIn,
      weth,
      hook,
      quoter,
    });
    if (amountOut == null || amountOut === 0n) continue;
    const inNum = Number(formatUnits(amountIn, 18));
    const outNum = Number(formatUnits(amountOut, 18));
    if (!(inNum > 0) || !(outNum > 0) || !Number.isFinite(outNum / inNum)) continue;
    return outNum / inNum;
  }
  return null;
}
