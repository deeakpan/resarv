import { type Address, type Hex, parseUnits, formatUnits } from "viem";
import { ADDRESSES, USDG_DECIMALS } from "@/lib/addresses";
import { pegArbFlashAbi } from "@/lib/abi";
import { getPublicClient, getWalletClient } from "@/lib/client";
import { discoverUsdgPools } from "@/lib/pools";
import { quotePegRate, type QuoteResult } from "@/lib/quoter";

export type ArbScan = {
  at: string;
  dryRun: boolean;
  thresholdBps: number;
  pools: Awaited<ReturnType<typeof discoverUsdgPools>>;
  pegQuote: QuoteResult | { error: string };
  opportunity: null | {
    direction: "sell_usdg" | "buy_usdg";
    rate: number;
    deviationBps: number;
    sizeUsdg: string;
    estimatedEdge: string;
    useFlashloan: boolean;
  };
  note: string;
};

function threshold() {
  return Number(process.env.ARB_THRESHOLD_BPS || 20) / 10_000;
}

/**
 * Scan USDG pools + peg deviation.
 * If USDG buys less than 1 peg → buy cheap USDG (or sell peg).
 * If USDG buys more than 1 peg → sell USDG into the rich side.
 * Flashloan USDG when wallet inventory is insufficient / DRY_RUN off + executor set.
 */
export async function scanArb(): Promise<ArbScan> {
  const pools = await discoverUsdgPools();
  const pegQuote = await quotePegRate();
  const dryRun = process.env.DRY_RUN !== "0";
  const thr = threshold();
  const sizeUsdg = String(process.env.TRADE_SIZE_USDG || 1000);

  let opportunity: ArbScan["opportunity"] = null;

  if (!("error" in pegQuote)) {
    const deviationBps = pegQuote.deviationFromPeg * 10_000;
    if (pegQuote.deviationFromPeg >= thr) {
      const direction: "sell_usdg" | "buy_usdg" =
        pegQuote.rate > 1 ? "sell_usdg" : "buy_usdg";
      const edge =
        Math.abs(pegQuote.rate - 1) * Number(sizeUsdg);
      opportunity = {
        direction,
        rate: pegQuote.rate,
        deviationBps,
        sizeUsdg,
        estimatedEdge: edge.toFixed(4),
        useFlashloan: true,
      };
    }
  }

  return {
    at: new Date().toISOString(),
    dryRun,
    thresholdBps: Number(process.env.ARB_THRESHOLD_BPS || 20),
    pools,
    pegQuote,
    opportunity,
    note:
      "Target peg is 1 USDG = 1 PEG. Bot quotes Uniswap v4, flash-borrows USDG when needed, swaps the path, and repays — keeping inventory-neutral while restoring 1:1.",
  };
}

export async function executeArb(opts?: {
  force?: boolean;
}): Promise<{
  ok: boolean;
  dryRun: boolean;
  txHash?: Hex;
  message: string;
  scan: ArbScan;
}> {
  const scan = await scanArb();
  const dryRun = process.env.DRY_RUN !== "0";

  if (!scan.opportunity && !opts?.force) {
    return {
      ok: false,
      dryRun,
      message: "No peg deviation above threshold — nothing to execute.",
      scan,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      message:
        "DRY_RUN=1 — would flashloan USDG and swap Uniswap v4 path to restore 1:1. Set DRY_RUN=0 and PEG_ARB_EXECUTOR to send txs.",
      scan,
    };
  }

  const executor = process.env.PEG_ARB_EXECUTOR as Address | undefined;
  if (!executor) {
    return {
      ok: false,
      dryRun: false,
      message:
        "Deploy contracts/PegArbFlash.sol and set PEG_ARB_EXECUTOR before live execution.",
      scan,
    };
  }

  if (!("rate" in scan.pegQuote) || "error" in scan.pegQuote) {
    return {
      ok: false,
      dryRun: false,
      message: "Cannot execute without a valid peg quote.",
      scan,
    };
  }

  const amount = parseUnits(
    scan.opportunity?.sizeUsdg || process.env.TRADE_SIZE_USDG || "1000",
    USDG_DECIMALS,
  );

  // Path placeholder: encode pool key + direction for the executor
  const path = encodeArbPath(scan.pegQuote) as Hex;

  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await wallet.writeContract({
    address: executor,
    abi: pegArbFlashAbi,
    functionName: "executeArb",
    args: [ADDRESSES.usdg, amount, path, BigInt(0)],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return {
    ok: true,
    dryRun: false,
    txHash: hash,
    message: `Executed peg arb. USDG flash + v4 path. tx=${hash}`,
    scan,
  };
}

function encodeArbPath(quote: QuoteResult): Hex {
  // ABI-encode poolKey fields + zeroForOne for the flash callback
  const { poolKey, zeroForOne } = quote;
  const packed = [
    poolKey.currency0.slice(2).padStart(40, "0"),
    poolKey.currency1.slice(2).padStart(40, "0"),
    poolKey.fee.toString(16).padStart(6, "0"),
    (poolKey.tickSpacing >>> 0).toString(16).padStart(6, "0"),
    poolKey.hooks.slice(2).padStart(40, "0"),
    zeroForOne ? "01" : "00",
  ].join("");
  return `0x${packed}`;
}

export function formatScanSummary(scan: ArbScan) {
  const peg =
    "error" in scan.pegQuote
      ? scan.pegQuote.error
      : `rate=${scan.pegQuote.rate.toFixed(6)} (dev ${ (scan.pegQuote.deviationFromPeg * 1e4).toFixed(1)} bps)`;
  return {
    pools: scan.pools.length,
    peg,
    opportunity: scan.opportunity,
    dryRun: scan.dryRun,
  };
}
