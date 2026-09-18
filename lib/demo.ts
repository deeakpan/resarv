import type { Address } from "viem";
import { STONK_BROKERS_COLLECTION as STONK_CA } from "@/lib/stonk-price";

/** StonkBrokers on Robinhood — pricing reference only when DEMO=1. */
export const STONK_BROKERS_COLLECTION = STONK_CA as Address;

export const COLLECTION_IMAGE =
  "https://i2c.seadn.io/collection/stonkbrokers-434284142/image_type_logo/d2dfd6700b856a0efa032fe803488f/96d2dfd6700b856a0efa032fe803488f.png";
export const NFT_IMAGE = "/nfts/stonk.svg";

export function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO === "1" ||
    process.env.DEMO === "1" ||
    process.env.DEMO === "true"
  );
}

export type StonkMeta = {
  tokenId: number;
  stonkId: string;
  image: string;
};

export const DEMO_STONK_META: StonkMeta[] = [1, 2, 3, 4, 5].map((tokenId) => ({
  tokenId,
  stonkId: `SB${String(tokenId).padStart(4, "0")}`,
  image: NFT_IMAGE,
}));

export function getDemoMeta(tokenId: number): StonkMeta | undefined {
  return DEMO_STONK_META.find((m) => m.tokenId === tokenId);
}
