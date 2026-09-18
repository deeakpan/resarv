import { formatUnits } from "viem";

/** Wallet pTOKEN amounts — never round a fractional NFT up to a whole 1. */
export function formatTokenBal(wei: bigint, decimals = 18): string {
  if (wei <= 0n) return "0";
  const raw = formatUnits(wei, decimals);
  const [whole, frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "");
  if (!trimmed) {
    const n = Number(whole);
    return Number.isFinite(n) && whole.length > 3 ? n.toLocaleString("en-US") : whole;
  }
  return `${whole}.${trimmed.slice(0, 8)}`;
}
