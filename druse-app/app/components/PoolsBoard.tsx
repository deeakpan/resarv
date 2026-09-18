"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PairMark from "./PairMark";
import EmptyScene from "./EmptyScene";
import { poolPath } from "@/lib/druse";
import { feeLabel, poolTvlEth, poolTvlUsd, type LivePool } from "@/lib/pools";
import { readJson } from "@/lib/rpc";

function formatEth(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k ETH`;
  if (n >= 1) return `${n.toFixed(2)} ETH`;
  return `${n.toPrecision(3)} ETH`;
}

function formatUsd(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatAmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toPrecision(3);
}

export default function PoolsBoard() {
  const [pools, setPools] = useState<LivePool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pools")
      .then((r) => readJson<{ pools?: LivePool[] }>(r, { pools: [] }))
      .then((data) => setPools(data.pools ?? []))
      .finally(() => setLoading(false));
  }, []);

  const live = useMemo(() => pools.filter((p) => p.exists), [pools]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Pools</h1>
        <Link
          href="/pools/new"
          className="inline-flex h-10 items-center rounded-full bg-[#e8c547] px-4 text-[14px] font-semibold text-[#1b1b1b] hover:bg-[#f0d060]"
        >
          New position
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[#16120b]" />
      ) : live.length === 0 ? (
        <EmptyScene
          title="No pools"
          body="No Druse pools are live yet."
          action={
            <Link
              href="/pools/new"
              className="inline-flex h-10 items-center rounded-full bg-[#e8c547] px-4 text-[14px] font-semibold text-[#1b1b1b]"
            >
              New position
            </Link>
          }
        />
      ) : (
        <>
          <ul className="mt-8 space-y-3 md:hidden">
            {live.map((p) => {
              const tvlEth = poolTvlEth(p);
              const tvlUsd = formatUsd(poolTvlUsd(p));
              return (
                <li key={p.vault.vault}>
                  <Link
                    href={poolPath(p.vault)}
                    className="block rounded-2xl bg-[#16120b] px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <PairMark image={p.vault.image || p.vault.art} />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap text-[15px] font-semibold text-white">
                          {p.vault.symbol} / ETH
                        </div>
                        <div className="text-[12px] text-white/40">v4 · {feeLabel(p.fee)}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <div className="text-[12px] text-white/40">TVL</div>
                        <div className="mt-0.5 text-[15px] font-semibold text-white tabular-nums">
                          {formatEth(tvlEth)}
                        </div>
                        {tvlUsd ? (
                          <div className="text-[12px] text-white/40 tabular-nums">{tvlUsd}</div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] text-white/40">Price</div>
                        <div className="mt-0.5 text-[15px] font-semibold text-white tabular-nums">
                          {formatEth(p.priceEth)}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[12px] text-white/40">Liquidity</div>
                        <div className="mt-0.5 text-[13px] text-white tabular-nums">
                          {formatAmt(p.pToken)} {p.vault.symbol}
                          <span className="text-white/45"> · {formatAmt(p.eth)} ETH</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 hidden md:block">
            <div className="grid grid-cols-[minmax(240px,1.6fr)_1fr_1.3fr_1fr] items-center px-4 py-3 text-[12px] text-white/40">
              <div>Pool</div>
              <div className="text-right">TVL</div>
              <div className="text-right">Liquidity</div>
              <div className="text-right">Price</div>
            </div>
            <ul>
              {live.map((p) => {
                const tvlEth = poolTvlEth(p);
                const tvlUsd = formatUsd(poolTvlUsd(p));
                return (
                  <li key={p.vault.vault}>
                    <Link
                      href={poolPath(p.vault)}
                      className="grid grid-cols-[minmax(240px,1.6fr)_1fr_1.3fr_1fr] items-center rounded-xl px-4 py-4 transition-colors hover:bg-white/4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <PairMark image={p.vault.image || p.vault.art} />
                        <div className="min-w-0">
                          <div className="whitespace-nowrap text-[15px] font-semibold text-white">
                            {p.vault.symbol} / ETH
                          </div>
                          <div className="text-[12px] text-white/40">
                            v4 · {feeLabel(p.fee)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-semibold text-white tabular-nums">
                          {formatEth(tvlEth)}
                        </div>
                        {tvlUsd ? (
                          <div className="text-[12px] text-white/40 tabular-nums">{tvlUsd}</div>
                        ) : null}
                      </div>
                      <div className="text-right text-[13px] text-white tabular-nums">
                        <div>
                          {formatAmt(p.pToken)} {p.vault.symbol}
                        </div>
                        <div className="text-white/45">{formatAmt(p.eth)} ETH</div>
                      </div>
                      <div className="text-right text-[15px] font-semibold text-white tabular-nums">
                        {formatEth(p.priceEth)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}
