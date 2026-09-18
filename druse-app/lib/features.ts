/** Chain writes are paused until mainnet contracts are live. */
export const TXS_ENABLED = true;

/**
 * Demo NFT / vault addresses from the RH deploy. Hidden from UI lists and detail.
 * Lowercase for comparisons.
 */
export const UI_BLACKLIST = new Set(
  [
    // Robinhood Chain demo mocks (4663)
    "0x7f7592857f708e9fc414ed7ec559d47963a403d0",
    "0x8fc6f0e691cdb7f50b80bf65e8536b7a3d9122f3",
    "0xd21717397cd83e67d7a1545d53900a1d446d27d2",
    "0xa486939887977291b867970f062238581b261774",
    "0x2f3462e625ee5f264fa5b80885085f0b7f48ca0a",
  ].map((a) => a.toLowerCase()),
);

export function isUiBlacklisted(address?: string | null) {
  if (!address) return false;
  return UI_BLACKLIST.has(address.toLowerCase());
}

