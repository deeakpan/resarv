import { type Address, type Hex, parseUnits, formatUnits } from "viem";
import { getPublicClient } from "@/lib/client";
import { ADDRESSES, USDG_DECIMALS } from "@/lib/addresses";
import { stateViewAbi, v4QuoterAbi } from "@/lib/abi";

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export type QuoteResult = {
  amountIn: string;
  amountOut: string;
  rate: number;
  zeroForOne: boolean;
  poolKey: PoolKey;
  deviationFromPeg: number;
};

const ZERO_HOOKS = "0x0000000000000000000000000000000000000000" as Address;

/** Build a sorted PoolKey (currency0 < currency1) */
export function makePoolKey(
  tokenA: Address,
  tokenB: Address,
  fee = 500,
  tickSpacing = 10,
  hooks: Address = ZERO_HOOKS,
): PoolKey {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  const [currency0, currency1] =
    a < b ? [tokenA, tokenB] : [tokenB, tokenA];
  return { currency0, currency1, fee, tickSpacing, hooks };
}

export async function readSlot0(poolId: Hex) {
  const client = getPublicClient();
  try {
    return await client.readContract({
      address: ADDRESSES.stateView,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [poolId],
    });
  } catch {
    return null;
  }
}

/**
 * Quote exact-in on a Uniswap v4 pool via Quoter.
 * Note: Quoter is often non-view (simulates); viem call works with account impersonation-free eth_call in many deployments.
 */
export async function quoteExactIn(params: {
  poolKey: PoolKey;
  tokenIn: Address;
  amountIn: bigint;
}): Promise<{ amountOut: bigint; zeroForOne: boolean } | null> {
  const { poolKey, tokenIn, amountIn } = params;
  const zeroForOne =
    tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();

  const client = getPublicClient();
  try {
    const result = await client.simulateContract({
      address: ADDRESSES.quoter,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey,
          zeroForOne,
          exactAmount: amountIn,
          hookData: "0x" as Hex,
        },
      ],
    });
    const [amountOut] = result.result;
    return { amountOut, zeroForOne };
  } catch {
    return null;
  }
}

/**
 * Measure how far a USDG ↔ pegToken pool is from 1:1.
 * rate = pegOut / usdgIn (normalized). Ideal = 1.
 */
export async function quotePegRate(opts?: {
  pegToken?: Address;
  pegDecimals?: number;
  fee?: number;
  tickSpacing?: number;
  sizeUsdg?: number;
}): Promise<QuoteResult | { error: string }> {
  const pegToken = (opts?.pegToken ||
    process.env.PEG_TOKEN_ADDRESS ||
    "") as Address;
  if (!pegToken) {
    return {
      error:
        "Set PEG_TOKEN_ADDRESS to the USD-stable paired with USDG (e.g. U or rUSD bridge). Without a 1:1 pool the bot can only list USDG pools.",
    };
  }

  const pegDecimals = opts?.pegDecimals ?? Number(process.env.PEG_TOKEN_DECIMALS || 6);
  const fee = opts?.fee ?? 100; // 0.01% stable default; override per pool
  const tickSpacing = opts?.tickSpacing ?? 1;
  const size = opts?.sizeUsdg ?? Number(process.env.TRADE_SIZE_USDG || 1000);

  const amountIn = parseUnits(String(size), USDG_DECIMALS);
  const poolKey = makePoolKey(ADDRESSES.usdg, pegToken, fee, tickSpacing);

  const quoted = await quoteExactIn({
    poolKey,
    tokenIn: ADDRESSES.usdg,
    amountIn,
  });

  if (!quoted) {
    // try common stable fee tiers
    for (const [f, ts] of [
      [500, 10],
      [100, 1],
      [3000, 60],
    ] as const) {
      const key = makePoolKey(ADDRESSES.usdg, pegToken, f, ts);
      const q = await quoteExactIn({
        poolKey: key,
        tokenIn: ADDRESSES.usdg,
        amountIn,
      });
      if (q) {
        const out = Number(formatUnits(q.amountOut, pegDecimals));
        const inn = Number(formatUnits(amountIn, USDG_DECIMALS));
        const rate = out / inn;
        return {
          amountIn: formatUnits(amountIn, USDG_DECIMALS),
          amountOut: formatUnits(q.amountOut, pegDecimals),
          rate,
          zeroForOne: q.zeroForOne,
          poolKey: key,
          deviationFromPeg: Math.abs(rate - 1),
        };
      }
    }
    return {
      error:
        "No Uniswap v4 quote for USDG/PEG — check pool exists, fee tier, and Quoter on RH.",
    };
  }

  const out = Number(formatUnits(quoted.amountOut, pegDecimals));
  const inn = Number(formatUnits(amountIn, USDG_DECIMALS));
  const rate = out / inn;

  return {
    amountIn: formatUnits(amountIn, USDG_DECIMALS),
    amountOut: formatUnits(quoted.amountOut, pegDecimals),
    rate,
    zeroForOne: quoted.zeroForOne,
    poolKey,
    deviationFromPeg: Math.abs(rate - 1),
  };
}
