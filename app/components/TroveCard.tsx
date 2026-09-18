"use client";

import { useEffect, useMemo, useState } from "react";
import { type Address, type Hex } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import {
  DECIMAL_PRECISION,
  NFT_BORROW_FEE,
  NFT_MAX_LTV,
  ZERO_ADDRESS,
} from "@/lib/contracts";
import { RH_NFT_COLLECTIONS, collectionByAddress } from "@/lib/collections";
import { pretty } from "@/lib/format";
import { useProtocol } from "@/lib/protocol";
import { erc20Abi, erc721Abi, nftCdpAbi } from "@/lib/abi";
import {
  BorrowPanel,
  CollectionHeader,
  useStonkFloor,
} from "@/app/components/NftDropdown";
import {
  Card,
  PrimaryButton,
  SummaryRow,
} from "@/app/components/ui";
import { toastSuccess } from "@/app/components/ToastHost";

type Quote = {
  price: string;
  deadline: number;
  signature: Hex;
  error?: string;
};

export default function TroveCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const protocol = useProtocol();
  const { writeContractAsync, isPending } = useWriteContract();
  const addrs = protocol.addresses;
  const collections =
    addrs?.supportedCollections?.length
      ? addrs.supportedCollections
      : RH_NFT_COLLECTIONS.map((c) => c.address);

  const [collection, setCollection] = useState<Address>(
    (collections[0] as Address) || ZERO_ADDRESS,
  );
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!collections.length) return;
    const stillValid = collections.some(
      (c) => c.toLowerCase() === collection.toLowerCase(),
    );
    if (!stillValid) setCollection(collections[0] as Address);
  }, [collections, collection]);

  const { priceWad, floorUsd, floorLabel } = useStonkFloor(collection);
  const reg = collectionByAddress(collection);
  const tokenIds = addrs?.mintedTokenIds?.length
    ? addrs.mintedTokenIds
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const position = useReadContract({
    address: addrs?.nftCdp,
    abi: nftCdpAbi,
    functionName: "getPosition",
    args: [collection, BigInt(tokenId || "0")],
    chainId: protocol.chainId,
    query: {
      enabled:
        Boolean(addrs?.nftCdp) &&
        collection !== ZERO_ADDRESS &&
        Boolean(tokenId),
      refetchInterval: 8_000,
    },
  });

  const ownerOf = useReadContract({
    address: collection !== ZERO_ADDRESS ? collection : undefined,
    abi: erc721Abi,
    functionName: "ownerOf",
    args: [BigInt(tokenId || "0")],
    chainId: protocol.chainId,
    query: {
      enabled: collection !== ZERO_ADDRESS && Boolean(tokenId),
    },
  });

  const posOwner = position.data?.[0];
  const posDebt = position.data?.[1] ?? 0n;
  const hasPosition =
    !!posOwner &&
    posOwner.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    posDebt > 0n;
  const isMyPosition =
    !!protocol.address &&
    !!posOwner &&
    posOwner.toLowerCase() === protocol.address.toLowerCase();
  const ownsNft =
    !!protocol.address &&
    ownerOf.data?.toLowerCase() === protocol.address.toLowerCase();

  const feeBps = protocol.borrowFee ?? NFT_BORROW_FEE;
  // Match NFTCDP.maxBorrow: debt (borrow + fee) must stay ≤ MAX_LTV
  const borrowWei = useMemo(() => {
    if (!tokenId || !priceWad) return 0n;
    return (priceWad * NFT_MAX_LTV) / (DECIMAL_PRECISION + feeBps);
  }, [priceWad, tokenId, feeBps]);

  const fee = (borrowWei * feeBps) / DECIMAL_PRECISION;
  const totalDebt = borrowWei + fee;
  const ltvPct = Number(NFT_MAX_LTV) / 1e16;
  const loading = busy || isPending || signing;

  const run = async (fn: () => Promise<void>, success = "Transaction successful") => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        protocol.refetch(),
        position.refetch(),
        ownerOf.refetch(),
      ]);
      toastSuccess(success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user rejected|denied/i.test(msg)) setError(msg.slice(0, 280));
    } finally {
      setBusy(false);
      setSigning(false);
    }
  };

  if (!protocol.deployed || !addrs) {
    return (
      <Card title="NFT CDP" open={open} onToggle={onToggle}>
        <p className="text-sm font-medium text-[#8a8a8a]">
          No deploy for chain {protocol.chainId}.
        </p>
      </Card>
    );
  }

  const actions = !hasPosition ? (
    <PrimaryButton
      loading={loading}
      disabled={!tokenId || !ownsNft || borrowWei === 0n || !priceWad}
      onClick={() => {
        if (!open) onToggle();
        void run(async () => {
          setSigning(true);
          const res = await fetch(
            `/api/nft-price?collection=${collection}&tokenId=${tokenId}&chainId=${protocol.chainId}`,
          );
          const quote = (await res.json()) as Quote;
          if (!res.ok || quote.error) {
            throw new Error(quote.error || "Price signature failed");
          }
          setSigning(false);

          await writeContractAsync({
            address: collection,
            abi: erc721Abi,
            functionName: "approve",
            args: [addrs.nftCdp, BigInt(tokenId)],
            chainId: protocol.chainId,
          });

          await writeContractAsync({
            address: addrs.nftCdp,
            abi: nftCdpAbi,
            functionName: "open",
            args: [
              collection,
              BigInt(tokenId),
              borrowWei,
              BigInt(quote.price),
              BigInt(quote.deadline),
              quote.signature as Hex,
            ],
            chainId: protocol.chainId,
          });
        }, "Position opened");
      }}
    >
      {!tokenId
        ? "Select an NFT"
        : signing
          ? "Signing price…"
          : busy || isPending
            ? "Confirm in wallet…"
            : "Open position"}
    </PrimaryButton>
  ) : (
    <PrimaryButton
      loading={loading}
      disabled={!isMyPosition}
      onClick={() => {
        if (!open) onToggle();
        void run(async () => {
          const need = posDebt;
          if ((protocol.rusdBalance ?? 0n) < need) {
            throw new Error(
              `Need ${pretty(need)} rUSD (have ${pretty(protocol.rusdBalance)})`,
            );
          }
          if ((protocol.rusdCdpAllowance ?? 0n) < need) {
            await writeContractAsync({
              address: addrs.rusd,
              abi: erc20Abi,
              functionName: "approve",
              args: [addrs.nftCdp, need],
              chainId: protocol.chainId,
            });
          }
          await writeContractAsync({
            address: addrs.nftCdp,
            abi: nftCdpAbi,
            functionName: "close",
            args: [collection, BigInt(tokenId)],
            chainId: protocol.chainId,
          });
        }, "Position closed");
      }}
    >
      {busy || isPending ? "Confirm in wallet…" : "Repay & close"}
    </PrimaryButton>
  );

  return (
    <Card title="NFT CDP" open={open} onToggle={onToggle}>
      {collections.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {collections.map((c) => {
            const meta = collectionByAddress(c);
            const active = c.toLowerCase() === collection.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCollection(c as Address);
                  setTokenId("");
                  setError(null);
                }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "bg-[var(--input)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {meta?.name || "Collection"}
              </button>
            );
          })}
        </div>
      ) : null}

      <CollectionHeader
        name={reg?.name || "Collection"}
        address={collection}
        logoUrl={reg?.logoUrl}
      />

      {hasPosition ? (
        <>
          <div className="mb-4">
            <SummaryRow label="Debt">{pretty(posDebt)} rUSD</SummaryRow>
            <SummaryRow label="Status">
              {isMyPosition ? "Yours" : "Open"}
            </SummaryRow>
          </div>
          {actions}
        </>
      ) : (
        <>
          <BorrowPanel
            amountWei={borrowWei}
            selectedId={tokenId}
            tokenIds={tokenIds}
            floorLabel={floorLabel}
            floorUsd={floorUsd}
            ltvPct={ltvPct}
            feePct={protocol.borrowFeePct}
            onSelect={setTokenId}
            collection={collection}
            collectionName={reg?.name}
          />
          <label className="mb-3 block text-[12px] font-medium text-[var(--muted)]">
            Or enter token id
            <input
              type="text"
              inputMode="numeric"
              value={tokenId}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setTokenId(v);
              }}
              placeholder="e.g. 42"
              className="mt-1 w-full rounded-xl bg-[var(--input)] px-3 py-2.5 text-[14px] font-semibold text-white outline-none"
            />
          </label>
          {actions}
          <div className="mt-4">
            <SummaryRow label="Max LTV">{ltvPct}%</SummaryRow>
            <SummaryRow label="Borrow fee">
              {protocol.borrowFeePct}%
            </SummaryRow>
            {tokenId && priceWad ? (
              <>
                <SummaryRow label="Fee ≈">{pretty(fee)} rUSD</SummaryRow>
                <SummaryRow label="Total debt ≈">
                  {pretty(totalDebt)} rUSD
                </SummaryRow>
              </>
            ) : (
              <SummaryRow label="Preview">
                {!tokenId ? "Select an NFT" : "Fetching floor…"}
              </SummaryRow>
            )}
          </div>
          {tokenId && !ownsNft ? (
            <p className="mt-3 text-sm font-medium text-[var(--muted)]">
              Connect the wallet that holds this NFT.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-3 break-words text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
