import { formatEther, parseEther } from "viem";

export function pretty(value?: bigint | null, digits = 2) {
  if (value == null) return "—";
  const n = Number(formatEther(value));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return (0).toFixed(Math.min(digits, 2));
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  return n.toFixed(digits);
}

/** Plain decimal string for inputs / parseEther (no commas). */
export function amountInput(value?: bigint | null, digits = 6) {
  if (value == null || value === 0n) return "0";
  const n = Number(formatEther(value));
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits).replace(/\.?0+$/, "") || "0";
}

export function prettyUsd(value?: bigint | null) {
  if (value == null) return "—";
  const n = Number(formatEther(value));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function parseAmount(input: string) {
  const trimmed = input.trim();
  if (!trimmed || trimmed === ".") return 0n;
  return parseEther(trimmed as `${number}`);
}

export function ratioPct(coll?: bigint | null, debt?: bigint | null, price?: bigint | null) {
  if (!coll || !debt || !price || debt === 0n) return null;
  return Number((coll * price * 10000n) / debt / 10n ** 18n) / 100;
}

export function formatPct(pct: number | null | undefined, digits = 1) {
  if (pct == null || !Number.isFinite(pct)) return "N/A";
  return `${pct.toFixed(digits)}%`;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ratioColor(pct: number | null) {
  if (pct == null) return "var(--muted-text)";
  if (pct >= 150) return "#28c081";
  if (pct >= 110) return "#fd9d28";
  return "#dc2c10";
}
