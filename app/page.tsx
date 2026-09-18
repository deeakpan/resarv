import type { Metadata } from "next";
import Landing from "@/app/components/Landing";

export const metadata: Metadata = {
  title: { absolute: "Resarv | Borrow rUSD against NFTs" },
  description:
    "Mint rUSD against NFT floor price and rarity on Somnia. Stake RSRV, swap USDG in the Stability Pool, and earn protocol fees.",
};

export default function Home() {
  return <Landing />;
}
