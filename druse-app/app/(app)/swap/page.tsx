import type { Metadata } from "next";
import { Suspense } from "react";
import AppSwap from "../../components/AppSwap";
import { isWeth, tokenFromCa } from "@/lib/swap";
import { loadLiveVaults } from "@/lib/live-vaults";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ in?: string; out?: string }>;
}): Promise<Metadata> {
  const q = await searchParams;
  try {
    const vaults = await loadLiveVaults();
    const featured =
      tokenFromCa(q.out, vaults) && q.out && !isWeth(q.out)
        ? vaults.find(
            (v) =>
              v.vault.toLowerCase() === q.out!.toLowerCase() ||
              v.asset.toLowerCase() === q.out!.toLowerCase(),
          )
        : q.in && !isWeth(q.in)
          ? vaults.find(
              (v) =>
                v.vault.toLowerCase() === q.in!.toLowerCase() ||
                v.asset.toLowerCase() === q.in!.toLowerCase(),
            )
          : null;
    if (!featured) return { title: "Trade" };
    return {
      title: featured.name,
      description:
        featured.description?.trim() || `Sell, buy, and hop ${featured.symbol} at floor.`,
    };
  } catch {
    return { title: "Trade" };
  }
}

export default function SwapPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-16">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/8" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/6" />
          <div className="mt-8 h-28 animate-pulse rounded-[20px] bg-white/6" />
          <div className="mt-1 h-28 animate-pulse rounded-[20px] bg-white/6" />
        </main>
      }
    >
      <AppSwap />
    </Suspense>
  );
}
