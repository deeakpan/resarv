"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import PairMark from "./PairMark";
import CopyAddress from "./CopyAddress";
import { vaultMatchesSlug } from "@/lib/druse";
import { addLiqPath, getWethAddress, shortAddress, swapPath } from "@/lib/swap";
import { feeLabel, poolTvlEth, poolTvlUsd, type LivePool } from "@/lib/pools";

const TABS = ["Price", "Volume", "Liquidity", "Depth"] as const;
type Tab = (typeof TABS)[number];

function formatEth(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k ETH`;
  if (n >= 1) return `${n.toFixed(4)} ETH`;
  return `${n.toPrecision(3)} ETH`;
}

function formatUsd(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "-";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatAmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toPrecision(3);
}

function formatPx(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "-";
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toPrecision(4);
}

export default function PoolDetail({ slug }: { slug: string }) {
  const [pools, setPools] = useState<LivePool[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("Price");

  useEffect(() => {
    fetch("/api/pools")
      .then((r) => r.json())
      .then((data: { pools?: LivePool[] }) => setPools(data.pools ?? []))
      .finally(() => setLoaded(true));
  }, []);

  const pool = pools.find((p) => vaultMatchesSlug(p.vault, slug));
  const vault = pool?.vault;

  if (!pool || !vault || !pool.exists) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
        <Link href="/pools" className="text-[13px] text-white/40 hover:text-white">
          Pools
        </Link>
        <div className="mt-8 text-[15px] text-white/50">
          {loaded ? "No pool" : <div className="h-40 animate-pulse rounded-2xl bg-[#16120b]" />}
        </div>
      </main>
    );
  }

  const pair = `${vault.symbol} / ETH`;
  const price = pool.priceEth;
  const inv = price && price > 0 ? 1 / price : null;
  const tvlEth = poolTvlEth(pool);
  const tvlUsd = poolTvlUsd(pool);
  const usdEach =
    vault.floorEth && vault.floorUsd && vault.floorEth > 0
      ? vault.floorUsd / vault.floorEth
      : null;
  const priceUsd = price && usdEach ? price * usdEach : null;
  const seeded = tvlEth > 0;
  const pShare = tvlEth > 0 ? (pool.pToken * (price || 0)) / tvlEth : 0.5;
  const ethShare = 1 - pShare;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <div className="text-[13px] text-white/40">
        <Link href="/pools" className="hover:text-white">
          Pools
        </Link>
        <span className="px-1.5">/</span>
        {pair}
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <PairMark image={vault.image || vault.art} className="origin-left scale-110 sm:scale-125" />
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] break-words text-white md:text-[32px]">
                {vault.name}
              </h1>
              <div className="mt-0.5 whitespace-nowrap text-[15px] text-white/50">{pair}</div>
            </div>
            <Link
              href={swapPath(getWethAddress(), vault.vault)}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/45 hover:bg-white/6 hover:text-white sm:flex"
              aria-label="Swap"
            >
              <SwapIcon />
            </Link>
          </div>
          {vault.description ? (
            <p className="mt-3 max-w-[54ch] text-[14px] leading-relaxed text-white/45">
              {vault.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag>Robinhood Chain</Tag>
            <Tag>v4</Tag>
            <Tag>{feeLabel(pool.fee)}</Tag>
            <CopyAddress address={vault.vault} className="text-[13px] text-white/50">
              <span className="rounded-md bg-white/6 px-2 py-1">{shortAddress(vault.vault)}</span>
            </CopyAddress>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Link
            href={swapPath(getWethAddress(), vault.vault)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/8 px-4 text-[14px] font-semibold text-[#e8c547] hover:bg-white/12 sm:flex-none"
          >
            <SwapIcon />
            Swap
          </Link>
          <Link
            href={addLiqPath(vault.id ?? vault.vault)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/8 px-4 text-[14px] font-semibold text-[#e8c547] hover:bg-white/12 sm:flex-none"
          >
            <span className="text-[18px] leading-none">+</span>
            Add liquidity
          </Link>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_320px]">
        <section>
          <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-white/8 text-[15px]">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px shrink-0 pb-3 ${
                  id === tab
                    ? "border-b-2 border-white font-semibold text-white"
                    : "border-b-2 border-transparent text-white/40 hover:text-white"
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "Price" ? (
              <>
                <div className="text-[22px] font-semibold tracking-[-0.03em] text-white md:text-[32px]">
                  1 {vault.symbol} = {formatPx(price)} ETH
                  {priceUsd ? (
                    <span className="ml-2 text-[16px] font-medium text-white/40 md:text-[18px]">
                      ({formatUsd(priceUsd)})
                    </span>
                  ) : null}
                </div>
                <ChartFrame yLabels={priceAxis(price)}>
                  <PriceLine />
                </ChartFrame>
              </>
            ) : null}

            {tab === "Volume" ? (
              <>
                <div className="text-[36px] font-semibold tracking-[-0.03em] text-white">-</div>
                <div className="mt-1 text-[14px] text-white/40">Past day</div>
                <ChartFrame yLabels={["$1", "$0.50", "$0"]} empty emptyLabel="No volume yet" />
              </>
            ) : null}

            {tab === "Liquidity" ? (
              <>
                <div className="text-[18px] font-semibold text-white md:text-[22px]">
                  1 {vault.symbol} = {formatPx(price)} ETH
                </div>
                <div className="mt-1 text-[15px] text-white/45">
                  1 ETH = {formatPx(inv)} {vault.symbol}
                </div>
                <ChartFrame
                  yLabels={seeded ? ["High", "", "Low"] : ["", "", ""]}
                  empty={!seeded}
                  emptyLabel="No liquidity yet"
                >
                  {seeded ? <LiquidityBars /> : null}
                </ChartFrame>
              </>
            ) : null}

            {tab === "Depth" ? (
              <>
                <div className="text-[22px] font-semibold tracking-[-0.03em] text-white md:text-[32px]">
                  1 {vault.symbol} = {formatPx(price)} ETH
                </div>
                <ChartFrame
                  yLabels={priceAxis(price)}
                  empty={!seeded}
                  emptyLabel="No depth until liquidity is added"
                >
                  {seeded ? <DepthShape /> : null}
                </ChartFrame>
              </>
            ) : null}
          </div>
        </section>

        <aside className="rounded-2xl bg-[#16120b] px-5 py-5">
          <div className="text-[15px] font-semibold text-white">Stats</div>
          <div className="mt-5">
            <div className="text-[13px] text-white/40">Pool balances</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <div className="text-[18px] font-semibold text-white tabular-nums">
                  {formatAmt(pool.pToken)} {vault.symbol}
                </div>
                <div className="mt-1 text-[18px] font-semibold text-white tabular-nums">
                  {formatAmt(pool.eth)} ETH
                </div>
              </div>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full bg-[#e8c547]" style={{ width: `${Math.round(pShare * 100)}%` }} />
              <div className="h-full bg-[#627eea]" style={{ width: `${Math.round(ethShare * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/35">
              <span>{vault.symbol}</span>
              <span>ETH</span>
            </div>
          </div>
          <StatRow label="TVL" value={formatEth(tvlEth)} hint={tvlUsd ? formatUsd(tvlUsd) : null} />
          <StatRow label="24H volume" value="-" />
          <StatRow label="24H fees" value="-" />
        </aside>
      </div>
    </main>
  );
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <div className="text-[13px] text-white/40">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-white tabular-nums">
        {value}
      </div>
      {hint && hint !== "-" ? (
        <div className="mt-0.5 text-[13px] text-white/40 tabular-nums">{hint}</div>
      ) : null}
    </div>
  );
}

function priceAxis(price: number | null) {
  if (!price || !(price > 0)) return ["-", "", "-"];
  const pad = Math.max(price * 0.004, 0.0001);
  return [formatPx(price + pad), formatPx(price), formatPx(price - pad)];
}

function ChartFrame({
  yLabels,
  empty,
  emptyLabel,
  children,
}: {
  yLabels: string[];
  empty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative mt-6 h-[260px] md:h-[320px]">
      <div className="absolute inset-0 flex flex-col justify-between py-3">
        {yLabels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex items-center gap-3">
            <div className="h-px flex-1 border-t border-dotted border-white/12" />
            <div className="w-[52px] shrink-0 text-right text-[11px] text-white/35 tabular-nums md:w-[72px]">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 right-[64px] md:right-[84px]">{children}</div>
      {empty ? (
        <div className="absolute inset-0 flex items-center justify-center pr-[64px] md:pr-[84px]">
          <div className="text-[13px] text-white/35">{emptyLabel}</div>
        </div>
      ) : null}
    </div>
  );
}

function PriceLine() {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
      <line x1="0" y1="20" x2="100" y2="20" stroke="#e8c547" strokeWidth="0.6" />
    </svg>
  );
}

function LiquidityBars() {
  const bars = [18, 22, 28, 40, 55, 72, 88, 100, 92, 76, 58, 42, 30, 24, 20, 16];
  return (
    <div className="flex h-full items-end gap-[3px] px-1 pb-4 pt-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-white/25"
          style={{ height: `${h * 0.7}%` }}
        />
      ))}
    </div>
  );
}

function DepthShape() {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
      <polygon points="0,40 50,8 50,40" fill="rgba(52, 211, 153, 0.22)" />
      <polygon points="50,8 100,40 50,40" fill="rgba(248, 113, 113, 0.22)" />
      <polyline points="0,40 50,8 100,40" fill="none" stroke="#e8c547" strokeWidth="0.5" />
    </svg>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-white/6 px-2 py-1 text-[13px] font-medium text-white/70">
      {children}
    </span>
  );
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5 3.5 3 5.5l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 5.5h8.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 12.5 13 10.5l-2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.8 10.5H4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
