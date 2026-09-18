import DEMO_ART from "./demo-art.json";

type ArtMap = Record<string, Record<string, string>>;

const ART = DEMO_ART as ArtMap;

/** Demo mock tokenId N shows real paired-collection NFT N (wraps if needed). */
export function demoNftArt(collectionId: string | null | undefined, tokenId: string | number) {
  if (!collectionId) return null;
  const map = ART[collectionId];
  if (!map) return null;
  const exact = map[String(tokenId)];
  if (exact) return exact;
  const keys = Object.keys(map)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!keys.length) return null;
  const n = Number(tokenId);
  if (!Number.isFinite(n) || n <= 0) return map[String(keys[0])] ?? null;
  return map[String(keys[(n - 1) % keys.length])] ?? null;
}
