"use client";

import { useEffect, useMemo, useState } from "react";
import type { FloorCollection } from "@/lib/floors";

function formatEth(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(3);
}

function formatUsd(n: number) {
  if (!n) return "$0";
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function EthIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 4v8.87l7.5 3.35z" />
      <path fill="#fff" d="M16.5 4 9 16.22l7.5-3.35z" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 21.97v6.03L24 17.62z" />
      <path fill="#fff" d="M16.5 28v-6.03L9 17.62z" />
      <path fill="#fff" fillOpacity="0.2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" />
      <path fill="#fff" fillOpacity="0.6" d="m9 16.22 7.5 4.35v-7.7z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
      <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TokenModal({
  open,
  onClose,
  collections,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  collections: FloorCollection[];
  onPick: (c: FloorCollection) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = collections.filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s)
    );
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-[min(540px,92vw)] overflow-hidden rounded-3xl border border-white/10 bg-[#161410]">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold text-white">Select A Token</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-white/40 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 rounded-2xl bg-white/6 px-3 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/35">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20 16.5 16.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Robinhood NFTs"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>
        <div className="no-scrollbar flex flex-wrap gap-2 px-4 py-4">
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                onClose();
              }}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/6 px-2 py-1.5 hover:bg-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="h-7 w-7 rounded-full object-cover" />
              <span className="text-[10px] text-white/80">{c.symbol}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar max-h-[min(360px,46vh)] overflow-y-auto border-t border-white/8 px-2 pb-3">
          <div className="px-3 py-2 text-xs font-medium text-white/35">
            Robinhood Chain
          </div>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/6"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{c.name}</div>
                <div className="text-sm text-white/45">
                  {c.symbol} · floor {formatEth(c.floorEth)} ETH
                </div>
              </div>
              <div
                className={`text-sm font-medium ${
                  c.change24h == null
                    ? "text-white/35"
                    : c.change24h >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {c.change24h == null
                  ? "—"
                  : `${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(2)}%`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TokenPill({
  image,
  label,
  onClick,
  accent,
}: {
  image?: string;
  label: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const inner = (
    <>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : label === "ETH" ? (
        <EthIcon className="h-6 w-6" />
      ) : null}
      <span className="whitespace-nowrap text-[15px] font-semibold sm:text-[18px]">
        {label}
      </span>
      <Chevron />
    </>
  );

  const cls = accent
    ? "flex shrink-0 items-center gap-2 rounded-full bg-[#e8c547] py-[6px] pr-3 pl-3 text-[#1a1a1a] hover:bg-[#f0d060]"
    : "flex shrink-0 items-center gap-2 rounded-full bg-white/10 py-[6px] pr-3 pl-1.5 text-white hover:bg-white/14";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export default function SwapWidget({
  collections,
}: {
  collections: FloorCollection[];
}) {
  const [nft, setNft] = useState<FloorCollection | null>(null);
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [ethIsSell, setEthIsSell] = useState(true);

  useEffect(() => {
    setNft((current) => {
      if (!current) return null;
      return collections.find((c) => c.id === current.id) ?? current;
    });
  }, [collections]);

  const qty = Number(amount) || 0;
  const quote = useMemo(() => {
    if (!nft || qty <= 0) return { raw: 0, capped: 0, usd: 0 };
    if (ethIsSell) {
      const nftsOut = Math.min(qty / nft.floorEth, nft.liquidityCapEth / nft.floorEth);
      return {
        raw: qty / nft.floorEth,
        capped: nftsOut,
        usd: qty * (nft.floorUsd / (nft.floorEth || 1)),
      };
    }
    const raw = qty * nft.floorEth;
    const capped = Math.min(raw, nft.liquidityCapEth);
    return {
      raw,
      capped,
      usd: capped * (nft.floorUsd / (nft.floorEth || 1)),
    };
  }, [nft, qty, ethIsSell]);

  const sellUsd = ethIsSell
    ? qty * (nft ? nft.floorUsd / (nft.floorEth || 1) : 0)
    : quote.usd;

  return (
    <>
      <div className="w-full">
        <div className="relative">
          <div className="rounded-[20px] border border-white/8 bg-white/6 px-4 pt-[14px] pb-3">
            <div className="mb-1 text-[15px] text-white/45">Sell</div>
            <div className="flex items-center justify-between gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-0 min-w-0 flex-1 bg-transparent text-[28px] font-medium tracking-tight text-white outline-none placeholder:text-white/25 sm:text-[36px]"
              />
              {ethIsSell ? (
                <TokenPill label="ETH" />
              ) : (
                <TokenPill
                  image={nft?.image}
                  label={nft?.symbol ?? "Select Token"}
                  onClick={() => setOpen(true)}
                  accent={!nft}
                />
              )}
            </div>
            <div className="mt-1 text-[14px] text-white/40">
              {qty > 0 && nft ? formatUsd(sellUsd) : "$0.00"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEthIsSell((v) => !v)}
            className="absolute left-1/2 top-full z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] border-4 border-[#100f0c] bg-[#1c1a16] text-white hover:bg-[#26231d]"
            aria-label="Switch tokens"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 3.5 3 5.5l2 2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.2 5.5h8.3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M11 12.5 13 10.5l-2-2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.8 10.5H4.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-[2px] rounded-[20px] border border-white/8 bg-white/6 px-4 pt-[14px] pb-3">
          <div className="mb-1 text-[15px] text-white/45">Buy</div>
          <div className="flex items-center justify-between gap-3">
            <div
              className={`min-w-0 text-[28px] font-medium tracking-tight sm:text-[36px] ${
                qty > 0 && nft ? "text-white" : "text-white/25"
              }`}
            >
              {qty > 0 && nft ? formatEth(quote.capped) : "0.00"}
            </div>
            {ethIsSell ? (
              <div className="flex items-center gap-2">
                {!nft ? (
                  <div className="hidden items-center sm:flex">
                    {collections.slice(0, 5).map((c, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.id}
                        src={c.image}
                        alt=""
                        className="h-6 w-6 rounded-full border-2 border-[#1a1814] object-cover"
                        style={{ marginLeft: i === 0 ? 0 : -8 }}
                      />
                    ))}
                  </div>
                ) : null}
                <TokenPill
                  image={nft?.image}
                  label={nft ? nft.symbol : "Select Token"}
                  onClick={() => setOpen(true)}
                  accent={!nft}
                />
              </div>
            ) : (
              <TokenPill label="ETH" />
            )}
          </div>
        </div>

        <a
          href="/vaults"
          className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[20px] bg-[#e8c547] text-[17px] font-semibold tracking-tight text-[#1b1b1b] transition-colors hover:bg-[#f0d060]"
        >
          Get started
        </a>
      </div>

      <TokenModal
        open={open}
        onClose={() => setOpen(false)}
        collections={collections}
        onPick={setNft}
      />
    </>
  );
}
