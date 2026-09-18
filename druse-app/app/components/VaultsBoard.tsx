"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppKitAccount } from "@reown/appkit/react";
import { useReadContracts, useWriteContract } from "wagmi";
import { TXS_ENABLED } from "@/lib/features";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";
import { DEFAULT_CHAIN_ID, VAULT_ABI, vaultPath, type LiveVault } from "@/lib/druse";
import type { BoardPosition, BoardSnapshot } from "@/lib/board";
import CopyAddress from "./CopyAddress";
import EmptyScene from "./EmptyScene";

const STAKING_REWARD_ABI = [
  {
    type: "function",
    name: "getReward",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

function formatEth(eth: number | null) {
  if (eth == null || !Number.isFinite(eth) || eth <= 0) return "-";
  if (eth >= 1000) return `${(eth / 1000).toFixed(1)}k ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  return `${eth.toPrecision(3)} ETH`;
}

function formatStatEth(eth: number) {
  if (!Number.isFinite(eth) || eth <= 0) return "0 ETH";
  if (eth >= 1000) return `${(eth / 1000).toFixed(1)}k ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  return `${eth.toPrecision(3)} ETH`;
}

function formatUsd(usd: number) {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

function formatPToken(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toFixed(8).replace(/\.?0+$/, "");
}

function formatChange(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default function VaultsBoard() {
  const [vaults, setVaults] = useState<LiveVault[]>([]);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAppKitAccount();
  const config = useConfig();
  const { writeContractAsync, isPending } = useWriteContract();
  const lastPositions = useRef<BoardPosition[]>([]);

  const { data: tokenBals } = useReadContracts({
    contracts: vaults.map((v) => ({
      address: v.vault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "balanceOf" as const,
      args: [address as `0x${string}`],
      chainId: DEFAULT_CHAIN_ID,
    })),
    query: { enabled: Boolean(address && vaults.length) },
  });

  const load = (wallet?: string | null) => {
    const q = wallet ? `?wallet=${wallet}` : "";
    return Promise.all([
      fetch("/api/vaults").then((r) => r.json()),
      fetch(`/api/board${q}`).then((r) => r.json()),
    ]);
  };

  useEffect(() => {
    let alive = true;
    const wallet = address ?? null;
    load(wallet)
      .then(([vaultData, boardData]: [{ vaults?: LiveVault[] }, BoardSnapshot]) => {
        if (!alive) return;
        setVaults(vaultData.vaults ?? []);
        setBoard((prev) => {
          if (!wallet && prev) {
            return {
              ...boardData,
              positions: prev.positions,
              feesEth: prev.feesEth,
              rewardsEth: prev.rewardsEth,
            };
          }
          return boardData;
        });
        setError(null);
      })
      .catch(() => {
        if (alive) setError("Could not read the factory.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [address]);

  const collectRewards = async () => {
    if (!board?.staking || !address || (board.rewardsEth ?? 0) <= 0) return;
    try {
      const hash = await writeContractAsync({
        address: board.staking as `0x${string}`,
        abi: STAKING_REWARD_ABI,
        functionName: "getReward",
      });
      await waitForTransactionReceipt(config, { hash });
      const [, boardData] = await load(address);
      setBoard(boardData);
    } catch {
      /* wallet reject */
    }
  };

  const sorted = useMemo(
    () => [...vaults].sort((a, b) => (b.floorEth ?? 0) - (a.floorEth ?? 0)),
    [vaults],
  );

  const wagmiReady = Boolean(tokenBals?.some((row) => row.status === "success"));
  const walletFromChain = useMemo<BoardPosition[]>(() => {
    if (!address || !wagmiReady || !tokenBals) return [];
    return vaults.flatMap((vault, i) => {
      const raw = tokenBals[i]?.result;
      const amount = typeof raw === "bigint" ? Number(raw) / 1e18 : 0;
      if (amount <= 0) return [];
      return [
        {
          tokenId: `wallet:${vault.vault}`,
          kind: "wallet" as const,
          vault: vault.vault,
          id: vault.id,
          name: vault.name,
          symbol: vault.symbol,
          image: vault.image || vault.art,
          pToken: amount,
          feesEth: 0,
        },
      ];
    });
  }, [address, wagmiReady, tokenBals, vaults]);

  const positions = useMemo(() => {
    const fromApi = board?.positions ?? [];
    const lp = fromApi.filter((p) => p.kind === "lp");
    const wallet = wagmiReady
      ? walletFromChain
      : fromApi.filter((p) => p.kind !== "lp");
    return [...wallet, ...lp];
  }, [board?.positions, wagmiReady, walletFromChain]);

  if (positions.length) lastPositions.current = positions;
  const shown =
    positions.length || !isConnected
      ? positions
      : lastPositions.current;
  const waiting = Boolean(isConnected && !shown.length && (loading || (address && vaults.length && !wagmiReady)));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-white md:text-[22px]">
        Our collections
      </h1>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-white/50">
        Each collection has its own token, vault, and liquidity market. Buy,
        sell, swap, and earn. All in one place.
      </p>

      <div className="no-scrollbar mt-8 -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex flex-nowrap gap-3 lg:grid lg:grid-cols-4">
          <StatCard label="Collections" value={String(board?.collections ?? 0)} />
          <StatCard
            label="TVL"
            value={formatStatEth(board?.tvlEth ?? 0)}
            hint={formatUsd(board?.tvlUsd ?? 0)}
          />
          <StatCard
            label="Total fees"
            value={formatStatEth(isConnected ? board?.feesEth ?? 0 : 0)}
            collect
            collectEnabled={Boolean(isConnected && (board?.feesEth ?? 0) > 0)}
            collectHref="/positions"
            collectLabel="View"
          />
          <StatCard
            label="Rewards"
            value={formatStatEth(isConnected ? board?.rewardsEth ?? 0 : 0)}
            collect
            collectEnabled={
              TXS_ENABLED && Boolean(isConnected && board?.staking && (board?.rewardsEth ?? 0) > 0)
            }
            collecting={isPending}
            onCollect={() => void collectRewards()}
            collectLabel={TXS_ENABLED ? undefined : "Coming soon"}
          />
        </div>
      </div>

      {shown.length ? (
        <PositionsList positions={shown} />
      ) : waiting ? (
        <div className="mt-8 h-[168px] animate-pulse rounded-2xl bg-[#16120b]" />
      ) : (
        <EmptyPositions />
      )}

      {error ? <p className="mt-10 text-[15px] text-white/50">{error}</p> : null}

      <section id="collections" className="mt-12 scroll-mt-24">
        {loading ? (
          <CollectionsSkeleton />
        ) : !error && vaults.length === 0 ? (
          <p className="text-[15px] text-white/45">No live vaults yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[36px_minmax(240px,1.5fr)_1fr_1fr_1fr_88px] items-center rounded-xl bg-white/6 px-4 py-3 text-[12px] text-white/40">
                <div>#</div>
                <div>Collection</div>
                <div className="text-right">Floor</div>
                <div className="text-right">In vault</div>
                <div className="text-right">1D vol</div>
                <div className="text-right">24h</div>
              </div>
              <ul>
                {sorted.map((v, i) => (
                  <li key={v.vault}>
                    <Link
                      href={vaultPath(v)}
                      className="grid grid-cols-[36px_minmax(240px,1.5fr)_1fr_1fr_1fr_88px] items-center rounded-xl px-4 py-4 transition-colors hover:bg-white/4"
                    >
                      <div className="text-[15px] font-semibold text-white">{i + 1}</div>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#141210]">
                          {v.image || v.art ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.image || v.art || ""}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <CopyAddress
                            address={v.asset}
                            className="truncate text-[15px] font-semibold text-white"
                          >
                            {v.name}
                          </CopyAddress>
                          <CopyAddress
                            address={v.vault}
                            className="truncate text-[12px] text-white/40"
                          >
                            {v.symbol}
                          </CopyAddress>
                        </div>
                      </div>
                      <div className="text-right text-[15px] text-white tabular-nums">
                        {formatEth(v.floorEth)}
                      </div>
                      <div className="text-right text-[15px] text-white tabular-nums">
                        {v.holdings}
                      </div>
                      <div className="text-right text-[15px] text-white tabular-nums">
                        {formatEth(v.volumeEth)}
                      </div>
                      <div
                        className={`text-right text-[15px] tabular-nums ${
                          (v.change24h ?? 0) >= 0 ? "text-[#c6a35a]" : "text-white/45"
                        }`}
                      >
                        {formatChange(v.change24h)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function CollectionsSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[36px_minmax(240px,1.5fr)_1fr_1fr_1fr_88px] items-center rounded-xl bg-white/6 px-4 py-3 text-[12px] text-white/40">
          <div>#</div>
          <div>Collection</div>
          <div className="text-right">Floor</div>
          <div className="text-right">In vault</div>
          <div className="text-right">1D vol</div>
          <div className="text-right">24h</div>
        </div>
        <ul>
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="grid grid-cols-[36px_minmax(240px,1.5fr)_1fr_1fr_1fr_88px] items-center px-4 py-4"
            >
              <div className="h-4 w-4 animate-pulse rounded bg-white/8" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/8" />
                <div className="min-w-0">
                  <div className="h-4 w-36 animate-pulse rounded bg-white/8" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-white/6" />
                </div>
              </div>
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-white/8" />
              <div className="ml-auto h-4 w-8 animate-pulse rounded bg-white/8" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-white/8" />
              <div className="ml-auto h-4 w-12 animate-pulse rounded bg-white/8" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PositionsList({ positions }: { positions: BoardPosition[] }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl bg-[#16120b]">
      <div className="px-5 py-4 text-[13px] text-white/45">Positions</div>
      <ul>
        {positions.map((p) => (
          <li key={p.tokenId}>
            <Link
              href={
                p.kind === "lp"
                  ? `/positions/${p.tokenId}`
                  : vaultPath({
                      vault: p.vault,
                      id: p.id,
                      symbol: p.symbol,
                    } as LiveVault)
              }
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/4"
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
                  {p.kind === "lp" ? `LP · ${p.symbol}` : p.symbol}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-white tabular-nums">
                  {formatPToken(p.pToken)} {p.symbol}
                </div>
                <div className="text-[12px] text-white/40">
                  {p.kind === "lp" ? "in pool" : "in wallet"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyPositions() {
  return (
    <EmptyScene
      title="No positions"
      body="You do not have any vault or liquidity positions. Deposit an NFT or add liquidity to start earning fees and rewards."
      action={
        <Link
          href="/pools/new"
          className="inline-flex h-10 items-center rounded-full bg-[#e8c547] px-4 text-[14px] font-semibold text-[#1b1b1b]"
        >
          Add liquidity
        </Link>
      }
    />
  );
}

function StatCard({
  label,
  value,
  hint,
  collect,
  collectEnabled,
  collecting,
  onCollect,
  collectHref,
  collectLabel,
}: {
  label: string;
  value: string;
  hint?: string | null;
  collect?: boolean;
  collectEnabled?: boolean;
  collecting?: boolean;
  onCollect?: () => void;
  collectHref?: string;
  collectLabel?: string;
}) {
  return (
    <div className="flex h-[118px] w-[220px] shrink-0 flex-col justify-between rounded-2xl bg-[#181714] px-5 py-4 lg:h-auto lg:min-h-[118px] lg:w-auto lg:shrink">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] text-white/45">{label}</div>
        {collect && collectHref ? (
          <Link
            href={collectHref}
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              collectEnabled
                ? "bg-[#e8c547]/15 text-[#e8c547]"
                : "bg-white/6 text-white/30"
            }`}
          >
            {collectLabel ?? "View"}
          </Link>
        ) : collect ? (
          <button
            type="button"
            disabled={!collectEnabled || collecting}
            onClick={onCollect}
            className="rounded-full bg-white/6 px-3 py-1 text-[12px] font-medium text-white/30 disabled:opacity-40 enabled:bg-[#e8c547]/15 enabled:text-[#e8c547]"
          >
            {collecting ? "…" : collectLabel ?? "Collect"}
          </button>
        ) : null}
      </div>
      <div>
        <div className="text-[28px] font-semibold tracking-[-0.03em] text-white">
          {value}
        </div>
        {hint ? <div className="mt-1 text-[13px] text-white/40">{hint}</div> : null}
      </div>
    </div>
  );
}
