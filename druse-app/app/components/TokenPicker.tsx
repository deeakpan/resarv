"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { formatUnits } from "viem";
import { useBalance, useReadContracts } from "wagmi";
import { DEFAULT_CHAIN_ID, VAULT_ABI, type LiveVault } from "@/lib/druse";
import { formatTokenBal } from "@/lib/format-token";
import { ETH_TOKEN, isWeth, shortAddress, vaultToken, type SwapToken } from "@/lib/swap";

function formatFiat(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function TokenPill({
  token,
  onClick,
  placeholder,
  accent,
}: {
  token: SwapToken | null;
  onClick: () => void;
  placeholder?: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
      accent
        ? "flex shrink-0 items-center gap-2 rounded-full bg-[#e8c547] py-[6px] pr-3 pl-3 text-[#1a1a1a] hover:bg-[#f0d060]"
        : "flex shrink-0 items-center gap-2 rounded-full bg-white/10 py-[6px] pr-3 pl-1.5 text-white hover:bg-white/14"
    }
    >
      {token?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : null}
      <span className="whitespace-nowrap text-[15px] font-semibold sm:text-[18px]">
        {token?.symbol ?? placeholder ?? "Select token"}
      </span>
      <Chevron />
    </button>
  );
}

export function TokenModal({
  vaults,
  onClose,
  onPick,
  ethOnly,
  tokensOnly,
  loading,
}: {
  vaults: LiveVault[];
  onClose: () => void;
  onPick: (token: SwapToken) => void;
  ethOnly?: boolean;
  tokensOnly?: boolean;
  loading?: boolean;
}) {
  const { address } = useAppKitAccount();
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [fresh, setFresh] = useState(!address);

  const tokens = useMemo(() => {
    const list = [
      ...(tokensOnly ? [] : [ETH_TOKEN]),
      ...(ethOnly ? [] : vaults.map(vaultToken)),
    ];
    return list;
  }, [vaults, ethOnly, tokensOnly]);

  const { data: ethBal, isLoading: ethLoading, refetch: refetchEth } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: {
      enabled: Boolean(address),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
    },
  });

  const {
    data: tokenBals,
    isLoading: tokenBalsLoading,
    refetch: refetchTok,
  } = useReadContracts({
    contracts: vaults.map((v) => ({
      address: v.vault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "balanceOf" as const,
      args: [address as `0x${string}`],
      chainId: DEFAULT_CHAIN_ID,
    })),
    query: {
      enabled: Boolean(address && vaults.length),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
    },
  });

  const ethUsd = useMemo(() => {
    const priced = vaults.find((v) => v.floorEth && v.floorUsd);
    if (!priced?.floorEth || !priced.floorUsd) return 0;
    return priced.floorUsd / priced.floorEth;
  }, [vaults]);

  const rows = useMemo(() => {
    return tokens.map((t) => {
      let wei = 0n;
      if (isWeth(t.address)) {
        wei = ethBal?.value ?? 0n;
      } else {
        const idx = vaults.findIndex((v) => v.vault.toLowerCase() === t.address);
        const raw = idx >= 0 ? tokenBals?.[idx]?.result : undefined;
        wei = typeof raw === "bigint" ? raw : 0n;
      }
      const amount = Number(formatUnits(wei, 18));
      const usd = isWeth(t.address) ? amount * ethUsd : amount * (t.floorUsd ?? 0);
      return { token: t, wei, amount, usd };
    });
  }, [tokens, vaults, ethBal, tokenBals, ethUsd]);

  const filtered = rows
    .filter(({ token: t }) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return (
        t.name.toLowerCase().includes(s) ||
        t.symbol.toLowerCase().includes(s) ||
        t.address.includes(s)
      );
    })
    .sort((a, b) => b.amount - a.amount || b.usd - a.usd);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, 220);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    let live = true;
    if (address) {
      setFresh(false);
      void Promise.all([refetchEth(), refetchTok()]).finally(() => {
        if (live) setFresh(true);
      });
    } else {
      setFresh(true);
    }
    return () => {
      live = false;
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (el && el.contains(e.target as Node) && el.scrollTop > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
    else setDragY(0);
  };

  const onTouchEnd = () => {
    if (dragY > 88) dismiss();
    else setDragY(0);
    startY.current = null;
  };

  const open = ready && !leaving;
  const sheetY = open ? Math.max(0, dragY) : 420;
  const dim = open ? Math.max(0.28, 0.62 - dragY / 520) : 0;
  const waitingBals =
    Boolean(address) &&
    (!fresh || ethLoading || (vaults.length > 0 && tokenBalsLoading));
  const showSkeleton = Boolean(loading) || waitingBals;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:pb-5">
      <button
        type="button"
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: dim }}
        onClick={dismiss}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="token-picker-title"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[#131211] shadow-[0_-16px_60px_rgba(0,0,0,0.45)] md:max-h-[min(720px,84vh)] md:w-[420px] md:rounded-[24px] md:border md:border-white/10"
        style={{
          transform: `translateY(${sheetY}px)`,
          transition: dragY ? "none" : "transform 220ms ease",
        }}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/22" />
        </div>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 md:pt-5">
          <h2 id="token-picker-title" className="text-[20px] font-semibold tracking-[-0.02em] text-white">
            Select a token
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[22px] leading-none text-white/50 hover:bg-white/6 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-4 pt-3">
          <label className="flex items-center gap-2.5 rounded-[20px] bg-[#0c0b0a] px-3.5 py-3 ring-1 ring-white/6">
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tokens"
              className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        {!q.trim() ? (
          showSkeleton ? (
            <TokenChipSkeleton />
          ) : (
            <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto px-4 pt-4">
              {tokens.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => onPick(t)}
                  className="flex min-w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-[18px] bg-white/6 px-3 py-2.5 hover:bg-white/10"
                >
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-white/8" />
                  )}
                  <span className="whitespace-nowrap text-[12px] font-medium text-white">{t.symbol}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        <div className="mt-3 flex items-center gap-1.5 px-5 text-[13px] text-white/40">
          <CoinsIcon />
          Your tokens
        </div>

        <div
          ref={scrollRef}
          className="no-scrollbar mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-[max(16px,env(safe-area-inset-bottom))]"
        >
          {showSkeleton ? (
            <TokenListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-[14px] text-white/40">No tokens match</div>
          ) : (
            filtered.map(({ token: t, wei, usd }) => (
              <button
                key={t.address}
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/6"
              >
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-white/8" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold text-white">{t.name}</div>
                  <div className="flex items-center gap-1.5 text-[13px] text-white/40">
                    <span className="whitespace-nowrap">{t.symbol}</span>
                    <span className="truncate">{shortAddress(t.address)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-white tabular-nums">{formatFiat(usd)}</div>
                  <div className="text-[13px] text-white/40 tabular-nums">{formatTokenBal(wei)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TokenChipSkeleton() {
  return (
    <div className="flex flex-nowrap gap-2 overflow-hidden px-4 pt-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex min-w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-[18px] bg-white/6 px-3 py-2.5"
        >
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
          <div className="h-3 w-10 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function TokenListSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/8" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 animate-pulse rounded bg-white/8" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/6" />
          </div>
          <div className="flex flex-col items-end">
            <div className="h-4 w-12 animate-pulse rounded bg-white/8" />
            <div className="mt-2 h-3 w-8 animate-pulse rounded bg-white/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
      <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/35" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20 16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white/40" aria-hidden>
      <ellipse cx="8" cy="4.2" rx="5.2" ry="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 4.2v3.6c0 1.2 2.3 2.2 5.2 2.2s5.2-1 5.2-2.2V4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 7.8v3.4c0 1.2 2.3 2.2 5.2 2.2s5.2-1 5.2-2.2V7.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
