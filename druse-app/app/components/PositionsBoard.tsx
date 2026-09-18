"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppKitAccount } from "@reown/appkit/react";
import { HeaderConnect } from "./ConnectButton";
import EmptyScene from "./EmptyScene";
import type { LivePosition } from "@/lib/pools";
import type { BoardPosition, BoardSnapshot } from "@/lib/board";
import { vaultPath, type LiveVault } from "@/lib/druse";

function formatAmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toFixed(3);
  return n.toPrecision(3);
}

export default function PositionsBoard() {
  const { address, isConnected } = useAppKitAccount();
  const [tab, setTab] = useState<"v4" | "ptoken">("v4");
  const [v4, setV4] = useState<LivePosition[]>([]);
  const [tokens, setTokens] = useState<BoardPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setV4([]);
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/positions?wallet=${address}`).then((r) => r.json()),
      fetch(`/api/board?wallet=${address}`).then((r) => r.json()),
    ])
      .then(([posData, board]: [{ positions?: LivePosition[] }, BoardSnapshot]) => {
        setV4(posData.positions ?? []);
        setTokens((board.positions ?? []).filter((p) => p.kind === "wallet"));
      })
      .finally(() => setLoading(false));
  }, [address]);

  const rows = tab === "v4" ? v4 : tokens;
  const empty = useMemo(
    () =>
      tab === "v4"
        ? {
            title: "No positions",
            body: "Add liquidity to a Druse pool to mint a v4 position.",
          }
        : {
            title: "No pTOKENs",
            body: "Deposit an NFT into a vault to hold pTOKEN.",
          },
    [tab],
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Your positions</h1>
        <Link
          href="/pools/new"
          className="inline-flex h-10 items-center rounded-full bg-[#e8c547] px-4 text-[14px] font-semibold text-[#1b1b1b] hover:bg-[#f0d060]"
        >
          New position
        </Link>
      </div>

      <div className="mt-6 inline-flex rounded-full bg-white/6 p-1">
        <button
          type="button"
          onClick={() => setTab("v4")}
          className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${
            tab === "v4" ? "bg-[#e8c547] text-[#1b1b1b]" : "text-white/50"
          }`}
        >
          v4
        </button>
        <button
          type="button"
          onClick={() => setTab("ptoken")}
          className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${
            tab === "ptoken" ? "bg-[#e8c547] text-[#1b1b1b]" : "text-white/50"
          }`}
        >
          pTOKEN
        </button>
      </div>

      {!isConnected ? (
        <div className="mt-10 flex justify-center rounded-2xl bg-[#16120b] py-16">
          <HeaderConnect />
        </div>
      ) : loading ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[#16120b]" />
      ) : rows.length === 0 ? (
        <EmptyScene
          title={empty.title}
          body={empty.body}
          action={
            <Link
              href={tab === "v4" ? "/pools/new" : "/vaults"}
              className="inline-flex h-10 items-center rounded-full bg-[#e8c547] px-4 text-[14px] font-semibold text-[#1b1b1b]"
            >
              {tab === "v4" ? "New position" : "View vaults"}
            </Link>
          }
        />
      ) : tab === "v4" ? (
        <ul className="mt-8 overflow-hidden rounded-2xl bg-[#16120b]">
          {(rows as LivePosition[]).map((p) => (
            <li key={p.tokenId}>
              <Link
                href={`/positions/${p.tokenId}`}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/4"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[#141210]">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-white">{p.name}</div>
                  <div className="text-[12px] text-white/40">
                    #{p.tokenId} · {p.inRange ? "In range" : "Out of range"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold text-white tabular-nums">
                    {formatAmt(p.pToken)} {p.symbol}
                  </div>
                  <div className="text-[12px] text-white/40 tabular-nums">
                    {p.feesEth > 0 ? `${formatAmt(p.feesEth)} ETH fees` : `${formatAmt(p.eth)} ETH`}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-2xl bg-[#16120b]">
          {(rows as BoardPosition[]).map((p) => (
            <li key={p.tokenId}>
              <Link
                href={vaultPath({ vault: p.vault, id: p.id, symbol: p.symbol } as LiveVault)}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/4"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[#141210]">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-white">{p.name}</div>
                  <div className="text-[12px] text-white/40">{p.symbol}</div>
                </div>
                <div className="text-right text-[15px] font-semibold text-white tabular-nums">
                  {formatAmt(p.pToken)} {p.symbol}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
