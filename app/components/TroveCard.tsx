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
import { useOwnedNfts } from "@/lib/owned-nfts";
import { erc20Abi, erc721Abi, nftCdpAbi } from "@/lib/abi";
import {
  BorrowPanel,
  CollectionHeader,
  type NftPick,
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
  const collectionAddrs = useMemo(
    () =>
      (addrs?.supportedCollections?.length
        ? addrs.supportedCollections
        : RH_NFT_COLLECTIONS.map((c) => c.address)) as Address[],
    [addrs?.supportedCollections],
  );

  const registryCollections = useMemo(
    () =>
      collectionAddrs
        .map((a) => collectionByAddress(a))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [collectionAddrs],
  );

  const [pick, setPick] = useState<NftPick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [floors, setFloors] = useState<Record<string, string>>({});

  const collection = (pick?.collection as Address) || ZERO_ADDRESS;
  const tokenId = pick?.tokenId || "";

  const { nfts: owned, loading: loadingOwned } = useOwnedNfts(
    collectionAddrs,
    protocol.address,
    protocol.chainId,
  );

  const { priceWad, floorUsd, floorLabel } = useStonkFloor(
    collection !== ZERO_ADDRESS ? collection : undefined,
  );
  const reg = collectionByAddress(collection);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        collectionAddrs.map(async (c) => {
          try {
            const res = await fetch(
              `/api/nft-floor?collection=${encodeURIComponent(c)}`,
            );
            const data = (await res.json()) as { floorUsd?: number };
            if (typeof data.floorUsd === "number") {
              next[c.toLowerCase()] = data.floorUsd.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              });
            }
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setFloors(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionAddrs]);

  // Drop selection if wallet no longer owns it
  useEffect(() => {
    if (!pick || !protocol.address) return;
    const still = owned.some(
      (n) =>
        n.collection.toLowerCase() === pick.collection.toLowerCase() &&
        String(n.tokenId) === pick.tokenId,
    );
    if (!loadingOwned && owned.length > 0 && !still) {
      setPick(null);
    }
  }, [owned, pick, loadingOwned, protocol.address]);

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
  const borrowWei = useMemo(() => {
    if (!tokenId || !priceWad) return 0n;
    return (priceWad * NFT_MAX_LTV) / (DECIMAL_PRECISION + feeBps);
  }, [priceWad, tokenId, feeBps]);

  const fee = (borrowWei * feeBps) / DECIMAL_PRECISION;
  const totalDebt = borrowWei + fee;
  const ltvPct = Number(NFT_MAX_LTV) / 1e16;
  const loading = busy || isPending || signing;

  const run = async (
    fn: () => Promise<void>,
    success = "Transaction successful",
  ) => {
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
      {pick && reg ? (
        <CollectionHeader
          name={reg.name}
          address={collection}
          logoUrl={reg.logoUrl}
        />
      ) : null}

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
            selected={pick}
            collections={registryCollections}
            owned={owned}
            floors={floors}
            loadingOwned={loadingOwned}
            floorUsd={floorUsd}
            ltvPct={ltvPct}
            feePct={protocol.borrowFeePct}
            onSelect={(next) => {
              setPick(next);
              setError(null);
            }}
          />
          {actions}
          <div className="mt-4">
            <SummaryRow label="Max LTV">{ltvPct}%</SummaryRow>
            <SummaryRow label="Borrow fee">
              {protocol.borrowFeePct}%
            </SummaryRow>
            {tokenId && priceWad ? (
              <>
                <SummaryRow label="Floor">{floorLabel}</SummaryRow>
                <SummaryRow label="Fee ≈">{pretty(fee)} rUSD</SummaryRow>
                <SummaryRow label="Total debt ≈">
                  {pretty(totalDebt)} rUSD
                </SummaryRow>
              </>
            ) : (
              <SummaryRow label="Preview">
                {!tokenId ? "Select an NFT you own" : "Fetching floor…"}
              </SummaryRow>
            )}
          </div>
          {!protocol.address ? (
            <p className="mt-3 text-sm font-medium text-[var(--muted)]">
              Connect a wallet to see your NFTs.
            </p>
          ) : null}
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
