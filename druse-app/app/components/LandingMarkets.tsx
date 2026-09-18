import type { FloorCollection } from "@/lib/floors";

function formatEth(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n >= 1) return `${n.toFixed(3)} ETH`;
  return `${n.toPrecision(3)} ETH`;
}

export default function LandingMarkets({
  collections,
}: {
  collections: FloorCollection[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8 md:pb-24">
      <h2 className="scroll-rise max-w-2xl font-[family-name:var(--font-logo)] text-[28px] leading-tight font-bold tracking-[-0.03em] text-white md:text-[44px]">
        A token behind every collection.
      </h2>
      <div className="scroll-stagger mt-10 overflow-hidden rounded-2xl border border-white/8 bg-black/20">
        <div className="hidden grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.8fr] px-5 py-3 text-[11px] tracking-[0.14em] text-white/35 uppercase md:grid">
          <span>Collection</span>
          <span>Token</span>
          <span>Floor</span>
          <span>24h change</span>
          <span>Liquidity cap</span>
        </div>
        {collections.map((c) => (
          <a
            key={c.id}
            href="/vaults"
            className="grid grid-cols-2 items-center gap-2 border-t border-white/6 px-5 py-3.5 hover:bg-white/4 md:grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.8fr]"
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
              <span className="truncate font-medium text-white">{c.name}</span>
            </div>
            <div className="text-right font-medium text-[#c6a35a] md:text-left">
              {c.symbol}
            </div>
            <div className="hidden font-[family-name:var(--font-plex)] text-[14px] text-white/80 md:block">
              {formatEth(c.floorEth)}
            </div>
            <div className="hidden md:block">
              <span
                className={`text-[13px] ${
                  (c.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {(c.change24h ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(c.change24h ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="hidden font-[family-name:var(--font-plex)] text-[14px] text-white/80 md:block">
              {formatEth(c.liquidityCapEth)}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
