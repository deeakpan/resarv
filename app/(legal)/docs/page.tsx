import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Resarv documentation for borrowing rUSD, staking RSRV, and the Stability Pool.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16 md:px-8">
      <h1 className="text-2xl font-semibold text-white">Docs</h1>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#8a8a8a]">
        Full documentation is coming soon. Meanwhile, open the{" "}
        <Link href="/dashboard" className="text-white hover:underline">
          dashboard
        </Link>{" "}
        to borrow rUSD against NFT floor price and rarity, stake RSRV, or use
        the Stability Pool.
      </p>
    </main>
  );
}
