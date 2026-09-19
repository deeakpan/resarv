"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type Address } from "viem";
import { COLLECTION_IMAGE, NFT_IMAGE } from "@/lib/demo";
import { collectionByAddress, type RhNftCollection } from "@/lib/collections";
import { pretty, shortAddress } from "@/lib/format";
import { type OwnedNft } from "@/lib/owned-nfts";

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
  fallback = NFT_IMAGE,
}: {
  src: string;
  size: number;
  round?: "full" | "xl" | "lg";
  alt?: string;
  fallback?: string;
}) {
  const [current, setCurrent] = useState(src || fallback);
  useEffect(() => {
    setCurrent(src || fallback);
  }, [src, fallback]);

  const radius =
    round === "full" ? "9999px" : round === "lg" ? "10px" : "12px";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

export function useStonkFloor(collection?: string) {
  const [priceWad, setPriceWad] = useState<bigint | null>(null);
  const [floorUsd, setFloorUsd] = useState<number | null>(null);
  const [floorLabel, setFloorLabel] = useState("…");

  useEffect(() => {
    let cancelled = false;
    if (!collection) {
      setPriceWad(null);
      setFloorUsd(null);
      setFloorLabel("—");
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(
          `/api/nft-floor?collection=${encodeURIComponent(collection)}`,
        );
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

/** Images keyed as `collection:tokenId` to avoid cross-collection flicker. */
export function useOwnedNftImages(nfts: OwnedNft[]) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (!nfts.length) return;

    const byCollection = new Map<string, number[]>();
    for (const n of nfts) {
      const key = n.collection.toLowerCase();
      const list = byCollection.get(key) || [];
      list.push(n.tokenId);
      byCollection.set(key, list);
    }

    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        [...byCollection.entries()].map(async ([collection, ids]) => {
          try {
            const res = await fetch(
              `/api/nft-meta?collection=${encodeURIComponent(collection)}&ids=${encodeURIComponent(ids.join(","))}`,
            );
            const data = (await res.json()) as {
              tokens?: { tokenId: number; image: string }[];
            };
            if (!data.tokens) return;
            for (const t of data.tokens) {
              next[`${collection}:${t.tokenId}`] = t.image;
            }
          } catch {
            /* keep prior / fallback */
          }
        }),
      );
      if (!cancelled) {
        setImages((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    nfts
      .map((n) => `${n.collection.toLowerCase()}:${n.tokenId}`)
      .sort()
      .join("|"),
  ]);

  return images;
}

/** @deprecated Prefer useOwnedNftImages — kept for Positions / Risky Troves */
export function useStonkImages(tokenIds: number[], collection?: string) {
  const [images, setImages] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const key = tokenIds.join(",");
    if (!key || !collection) return;
    void fetch(
      `/api/nft-meta?collection=${encodeURIComponent(collection)}&ids=${encodeURIComponent(key)}`,
    )
      .then((r) => r.json())
      .then((data: { tokens?: { tokenId: number; image: string }[] }) => {
        if (cancelled || !data.tokens) return;
        const next: Record<number, string> = {};
        for (const t of data.tokens) next[t.tokenId] = t.image;
        setImages((prev) => ({ ...prev, ...next }));
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
      <NftThumb
        src={logoUrl || COLLECTION_IMAGE}
        fallback={COLLECTION_IMAGE}
        size={36}
      />
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

export type NftPick = { collection: Address; tokenId: string };

/** Desktop: centered modal. Mobile: bottom sheet. */
function NftSelectModal({
  open,
  onClose,
  selected,
  collections,
  owned,
  images,
  floors,
  loading,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: NftPick | null;
  collections: RhNftCollection[];
  owned: OwnedNft[];
  images: Record<string, string>;
  floors: Record<string, string>;
  loading: boolean;
  onSelect: (pick: NftPick) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeCollection, setActiveCollection] = useState<Address | "all">(
    "all",
  );

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
    if (!open) {
      setQuery("");
      setActiveCollection("all");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().replace(/^#/, "").toLowerCase();
    return owned.filter((n) => {
      if (
        activeCollection !== "all" &&
        n.collection.toLowerCase() !== activeCollection.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(n.tokenId).includes(q) ||
        n.collectionName.toLowerCase().includes(q)
      );
    });
  }, [owned, query, activeCollection]);

  const grouped = useMemo(() => {
    const map = new Map<string, OwnedNft[]>();
    for (const n of filtered) {
      const key = n.collection.toLowerCase();
      const list = map.get(key) || [];
      list.push(n);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

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

        <div className="px-4 pb-2">
          <div className="resarv-scroll flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCollection("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                activeCollection === "all"
                  ? "bg-white text-black"
                  : "bg-[var(--input)] text-[var(--muted)] hover:text-white"
              }`}
            >
              All
            </button>
            {collections.map((c) => {
              const active =
                activeCollection !== "all" &&
                c.address.toLowerCase() === activeCollection.toLowerCase();
              return (
                <button
                  key={c.address}
                  type="button"
                  onClick={() => setActiveCollection(c.address)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    active
                      ? "bg-white text-black"
                      : "bg-[var(--input)] text-[var(--muted)] hover:text-white"
                  }`}
                >
                  <NftThumb
                    src={c.logoUrl}
                    fallback={COLLECTION_IMAGE}
                    size={16}
                    round="full"
                    alt=""
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-3">
          <label className="flex items-center gap-2 rounded-2xl bg-[var(--input)] px-3 py-2.5">
            <span className="text-[var(--muted)]">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collection or id"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-[var(--muted-2)]"
              autoFocus
            />
          </label>
        </div>

        <div className="resarv-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm font-medium text-[#8a8a8a]">
              Loading your NFTs…
            </p>
          ) : null}

          {!loading && grouped.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm font-medium text-[#8a8a8a]">
              No supported NFTs in this wallet.
            </p>
          ) : null}

          {grouped.map(([colKey, items]) => {
            const name =
              items[0]?.collectionName ||
              collectionByAddress(colKey)?.name ||
              "Collection";
            return (
              <div key={colKey} className="mb-3">
                <p className="px-2 pb-2 text-[12px] font-medium text-[#6b6b6b]">
                  {name}
                </p>
                <ul>
                  {items.map((n) => {
                    const imgKey = `${n.collection.toLowerCase()}:${n.tokenId}`;
                    const active =
                      selected?.collection.toLowerCase() ===
                        n.collection.toLowerCase() &&
                      selected?.tokenId === String(n.tokenId);
                    const floor =
                      floors[n.collection.toLowerCase()] || "—";
                    return (
                      <li key={imgKey}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect({
                              collection: n.collection,
                              tokenId: String(n.tokenId),
                            });
                            onClose();
                          }}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                            active
                              ? "bg-[var(--input)]"
                              : "hover:bg-[#151515]"
                          }`}
                        >
                          <NftThumb
                            src={
                              images[imgKey] || n.logoUrl || NFT_IMAGE
                            }
                            fallback={n.logoUrl || NFT_IMAGE}
                            size={40}
                            round="full"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">
                              #{n.tokenId}
                            </p>
                            <p className="text-xs font-medium text-[#8a8a8a]">
                              {n.collectionName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {floor}
                            </p>
                            <p className="text-[11px] font-medium text-[#6b6b6b]">
                              floor
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NftSelectTrigger({
  selected,
  collections,
  owned,
  images,
  floors,
  loading,
  onSelect,
}: {
  selected: NftPick | null;
  collections: RhNftCollection[];
  owned: OwnedNft[];
  images: Record<string, string>;
  floors: Record<string, string>;
  loading: boolean;
  onSelect: (pick: NftPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const reg = selected
    ? collectionByAddress(selected.collection)
    : undefined;
  const imgKey = selected
    ? `${selected.collection.toLowerCase()}:${selected.tokenId}`
    : "";
  const thumbSrc = selected
    ? images[imgKey] || reg?.logoUrl || NFT_IMAGE
    : COLLECTION_IMAGE;
  const label = selected
    ? `${reg?.name || "NFT"} #${selected.tokenId}`
    : "Select NFT";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-[180px] items-center gap-2 rounded-full bg-[var(--surface)] py-1.5 pl-1.5 pr-3 hover:bg-[#111]"
      >
        <NftThumb
          src={thumbSrc}
          fallback={reg?.logoUrl || COLLECTION_IMAGE}
          size={28}
          round="full"
        />
        <span className="truncate font-semibold text-white">{label}</span>
        <span className="text-xs text-[#8a8a8a]">▾</span>
      </button>

      <NftSelectModal
        open={open}
        onClose={() => setOpen(false)}
        selected={selected}
        collections={collections}
        owned={owned}
        images={images}
        floors={floors}
        loading={loading}
        onSelect={onSelect}
      />
    </>
  );
}

/** Uniswap-style borrow panel: amount left, NFT selector right. */
export function BorrowPanel({
  amountWei,
  selected,
  collections,
  owned,
  floors,
  loadingOwned,
  floorUsd,
  ltvPct,
  onSelect,
}: {
  amountWei: bigint;
  selected: NftPick | null;
  collections: RhNftCollection[];
  owned: OwnedNft[];
  floors: Record<string, string>;
  loadingOwned: boolean;
  floorUsd: number | null;
  ltvPct: number;
  feePct?: number;
  onSelect: (pick: NftPick) => void;
}) {
  const images = useOwnedNftImages(owned);
  const hasSelection = Boolean(selected);
  const amountLabel =
    hasSelection && amountWei > 0n ? pretty(amountWei) : "0";
  const usdHint =
    hasSelection && floorUsd != null
      ? (floorUsd * (ltvPct / 100)).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "$0";
  const reg = selected
    ? collectionByAddress(selected.collection)
    : undefined;

  return (
    <div className="mb-4 rounded-2xl bg-[var(--input)] px-4 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--muted)]">
          Borrow
        </span>
        <span className="truncate text-[12px] font-medium text-[var(--muted-2)]">
          {reg?.name || "Pick an NFT"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[36px] font-semibold leading-none tracking-tight tabular-nums ${
              hasSelection ? "text-white" : "text-[#3a3a3a]"
            }`}
          >
            {amountLabel}
          </p>
        </div>
        <NftSelectTrigger
          selected={selected}
          collections={collections}
          owned={owned}
          images={images}
          floors={floors}
          loading={loadingOwned}
          onSelect={onSelect}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--muted)]">
          {usdHint}
        </span>
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
