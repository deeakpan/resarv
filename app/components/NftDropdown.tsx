"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { COLLECTION_IMAGE, NFT_IMAGE } from "@/lib/demo";
import { pretty, shortAddress } from "@/lib/format";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NftThumb({
  src,
  size,
  round = "xl",
  alt = "NFT",
}: {
  src: string;
  size: number;
  round?: "full" | "xl" | "lg";
  alt?: string;
}) {
  const radius =
    round === "full" ? "9999px" : round === "lg" ? "10px" : "12px";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

export function useStonkFloor(collection?: string) {
  const [priceWad, setPriceWad] = useState<bigint | null>(null);
  const [floorUsd, setFloorUsd] = useState<number | null>(null);
  const [floorLabel, setFloorLabel] = useState("…");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const q = collection
          ? `?collection=${encodeURIComponent(collection)}`
          : "";
        const res = await fetch(`/api/nft-floor${q}`);
        const data = (await res.json()) as {
          priceWad?: string;
          floorUsd?: number;
        };
        if (cancelled || !res.ok || !data.priceWad) {
          if (!cancelled) setFloorLabel("—");
          return;
        }
        setPriceWad(BigInt(data.priceWad));
        setFloorUsd(typeof data.floorUsd === "number" ? data.floorUsd : null);
        setFloorLabel(
          typeof data.floorUsd === "number"
            ? data.floorUsd.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              })
            : "—",
        );
      } catch {
        if (!cancelled) setFloorLabel("—");
      }
    };
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [collection]);

  return { priceWad, floorUsd, floorLabel };
}

export function useStonkImages(tokenIds: number[], collection?: string) {
  const [images, setImages] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const key = tokenIds.join(",");
    if (!key) return;
    const col = collection
      ? `&collection=${encodeURIComponent(collection)}`
      : "";
    void fetch(`/api/nft-meta?ids=${encodeURIComponent(key)}${col}`)
      .then((r) => r.json())
      .then((data: { tokens?: { tokenId: number; image: string }[] }) => {
        if (cancelled || !data.tokens) return;
        const next: Record<number, string> = {};
        for (const t of data.tokens) next[t.tokenId] = t.image;
        setImages(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tokenIds.join(","), collection]);

  return images;
}

export function CollectionHeader({
  name,
  address,
  logoUrl,
}: {
  name: string;
  address: string;
  logoUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group mb-3 flex items-center gap-3">
      <NftThumb src={logoUrl || COLLECTION_IMAGE} size={36} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold tracking-tight text-white">{name}</p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-[#8a8a8a] hover:text-white"
          onClick={() => {
            void navigator.clipboard.writeText(address).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          <span>{shortAddress(address)}</span>
          <CopyIcon className="opacity-0 transition group-hover:opacity-100" />
          {copied ? <span className="text-[#3dd68c]">Copied</span> : null}
        </button>
      </div>
    </div>
  );
}

/** Desktop: centered modal. Mobile: bottom sheet. */
function NftSelectModal({
  open,
  onClose,
  selectedId,
  tokenIds,
  images,
  floorLabel,
  onSelect,
  collectionName = "NFT",
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  tokenIds: number[];
  images: Record<number, string>;
  floorLabel: string;
  onSelect: (id: string) => void;
  collectionName?: string;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().replace(/^#/, "");
    if (!q) return tokenIds;
    return tokenIds.filter((id) => String(id).includes(q));
  }, [tokenIds, query]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="resarv-sheet relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--surface)] shadow-2xl md:max-h-[560px] md:w-[420px] md:rounded-[24px]"
      >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#333] md:hidden" />

        <header className="flex items-center justify-between px-4 pb-2 pt-3 md:pt-4">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Select NFT
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--input)] hover:text-white"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="px-4 pb-3">
          <label className="flex items-center gap-2 rounded-2xl bg-[var(--input)] px-3 py-2.5">
            <span className="text-[var(--muted)]">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by id"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-[var(--muted-2)]"
              autoFocus
            />
          </label>
        </div>

        <div className="resarv-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <p className="px-2 pb-2 text-[12px] font-medium text-[#6b6b6b]">
            {collectionName}
          </p>
          <ul>
            {filtered.map((id) => {
              const active = String(id) === selectedId;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(String(id));
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      active ? "bg-[var(--input)]" : "hover:bg-[#151515]"
                    }`}
                  >
                    <NftThumb
                      src={images[id] || NFT_IMAGE}
                      size={40}
                      round="full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">#{id}</p>
                      <p className="text-xs font-medium text-[#8a8a8a]">
                        {collectionName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {floorLabel}
                      </p>
                      <p className="text-[11px] font-medium text-[#6b6b6b]">
                        floor
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm font-medium text-[#8a8a8a]">
                No NFTs match
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NftSelectTrigger({
  selectedId,
  tokenIds,
  images,
  floorLabel,
  onSelect,
  collectionName,
}: {
  selectedId: string;
  tokenIds: number[];
  images: Record<number, string>;
  floorLabel: string;
  onSelect: (id: string) => void;
  collectionName?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasSelection = Boolean(selectedId);
  const selectedNum = Number(selectedId);
  const thumbSrc = hasSelection
    ? images[selectedNum] || NFT_IMAGE
    : COLLECTION_IMAGE;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-[var(--input)] py-1.5 pl-1.5 pr-3 hover:bg-[#111]"
      >
        <NftThumb src={thumbSrc} size={28} round="full" />
        <span className="font-semibold text-white">
          {hasSelection ? `#${selectedId}` : "NFT"}
        </span>
        <span className="text-xs text-[#8a8a8a]">▾</span>
      </button>

      <NftSelectModal
        open={open}
        onClose={() => setOpen(false)}
        selectedId={selectedId}
        tokenIds={tokenIds}
        images={images}
        floorLabel={floorLabel}
        onSelect={onSelect}
        collectionName={collectionName}
      />
    </>
  );
}

/** Uniswap-style borrow panel: amount left, NFT selector right. */
export function BorrowPanel({
  amountWei,
  selectedId,
  tokenIds,
  floorLabel,
  floorUsd,
  ltvPct,
  onSelect,
  collection,
  collectionName = "NFT",
}: {
  amountWei: bigint;
  selectedId: string;
  tokenIds: number[];
  floorLabel: string;
  floorUsd: number | null;
  ltvPct: number;
  feePct?: number;
  onSelect: (id: string) => void;
  collection?: string;
  collectionName?: string;
}) {
  const images = useStonkImages(tokenIds, collection);
  const selected = Boolean(selectedId);
  const amountLabel = selected && amountWei > 0n ? pretty(amountWei) : "0";
  const usdHint =
    selected && floorUsd != null
      ? (floorUsd * (ltvPct / 100)).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "$0";

  return (
    <div className="mb-4 rounded-2xl bg-[var(--input)] px-4 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--muted)]">Borrow</span>
        <span className="text-[12px] font-medium text-[var(--muted-2)]">
          {collectionName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[36px] font-semibold leading-none tracking-tight tabular-nums ${
              selected ? "text-white" : "text-[#3a3a3a]"
            }`}
          >
            {amountLabel}
          </p>
        </div>
        <NftSelectTrigger
          selectedId={selectedId}
          tokenIds={tokenIds}
          images={images}
          floorLabel={floorLabel}
          onSelect={onSelect}
          collectionName={collectionName}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--muted)]">{usdHint}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/rusd.png"
            alt="rUSD"
            width={16}
            height={16}
            className="h-4 w-4 rounded-full object-cover"
          />
          rUSD
        </span>
      </div>
    </div>
  );
}

export default CollectionHeader;
