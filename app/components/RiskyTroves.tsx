"use client";

import { useState } from "react";
import { type Address, type Hex } from "viem";
import { useWriteContract } from "wagmi";
import {
  DECIMAL_PRECISION,
  NFT_LIQ_THRESHOLD,
} from "@/lib/contracts";
import { collectionByAddress } from "@/lib/collections";
import { pretty, shortAddress } from "@/lib/format";
import { useOpenTroves, type OpenTrove } from "@/lib/open-troves";
import { useProtocol } from "@/lib/protocol";
import { erc20Abi, nftCdpAbi } from "@/lib/abi";
import AppShell from "@/app/components/AppShell";
import {
  NftThumb,
  useStonkFloor,
  useStonkImages,
} from "@/app/components/NftDropdown";
import { Card, PrimaryButton } from "@/app/components/ui";
import { toastSuccess } from "@/app/components/ToastHost";

type Quote = {
  price: string;
  deadline: number;
  signature: Hex;
  error?: string;
};

function ltvRatio(debt: bigint, price: bigint) {
  if (price === 0n) return 0n;
  return (debt * DECIMAL_PRECISION) / price;
}

function ltvPct(debt: bigint, price: bigint | null) {
  if (!price || price === 0n) return null;
  return Number((debt * 10_000n) / price) / 100;
}

function TrovesRow({
  trove,
  busy,
  disabled,
  spCovers,
  onLiquidate,
}: {
  trove: OpenTrove;
  busy: boolean;
  disabled: boolean;
  spCovers: boolean;
  onLiquidate: (collection: Address, tokenId: number, debt: bigint) => void;
}) {
  const reg = collectionByAddress(trove.collection);
  const { priceWad, floorLabel } = useStonkFloor(trove.collection);
  const images = useStonkImages([trove.tokenId], trove.collection);
  const name = reg?.name || "NFT";
  const ltv = ltvPct(trove.debt, priceWad);
  const liquidatable = priceWad
    ? ltvRatio(trove.debt, priceWad) >= NFT_LIQ_THRESHOLD
    : false;

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl bg-[var(--input)] px-4 py-3">
      <NftThumb
        src={images[trove.tokenId] || reg?.logoUrl || "/nfts/stonk.svg"}
        size={48}
        round="lg"
        alt={`${name} #${trove.tokenId}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">
          {name} #{trove.tokenId}
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-[var(--muted)]">
          Debt {pretty(trove.debt)} rUSD · LTV{" "}
          {ltv != null ? `${ltv.toFixed(1)}%` : "—"} · Floor {floorLabel}
          {liquidatable ? (
            <span className="text-[var(--danger)]"> · At risk</span>
          ) : priceWad ? (
            <span className="text-[var(--resarv-green)]"> · Healthy</span>
          ) : null}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-2)]">
          {shortAddress(trove.owner)}
          {liquidatable
            ? spCovers
              ? " · SP covers debt"
              : " · Liquidator pays debt"
            : null}
        </p>
      </div>
      {liquidatable ? (
        <div className="w-full sm:w-auto sm:min-w-[168px]">
          <PrimaryButton
            loading={busy}
            disabled={!priceWad || disabled}
            onClick={() =>
              onLiquidate(trove.collection, trove.tokenId, trove.debt)
            }
          >
            {busy ? "Confirm…" : "Liquidate"}
          </PrimaryButton>
        </div>
      ) : null}
    </li>
  );
}

export default function RiskyTroves() {
  const protocol = useProtocol();
  const { writeContractAsync, isPending } = useWriteContract();
  const { troves, refetchAll } = useOpenTroves();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spCovers = (debt: bigint) => (protocol.rusdInSp ?? 0n) >= debt;

  const liquidate = async (
    collection: Address,
    tokenId: number,
    debt: bigint,
  ) => {
    const addrs = protocol.addresses;
    if (!addrs) return;
    const key = `${collection}:${tokenId}`;
    setError(null);
    setBusyKey(key);
    try {
      const res = await fetch(
        `/api/nft-price?collection=${collection}&tokenId=${tokenId}&chainId=${protocol.chainId}`,
      );
      const quote = (await res.json()) as Quote;
      if (!res.ok || quote.error) {
        throw new Error(quote.error || "Price signature failed");
      }

      if (!spCovers(debt)) {
        if ((protocol.rusdBalance ?? 0n) < debt) {
          throw new Error(
            `Need ${pretty(debt)} rUSD (have ${pretty(protocol.rusdBalance)})`,
          );
        }
        if ((protocol.rusdCdpAllowance ?? 0n) < debt) {
          await writeContractAsync({
            address: addrs.rusd,
            abi: erc20Abi,
            functionName: "approve",
            args: [addrs.nftCdp, debt],
            chainId: protocol.chainId,
          });
        }
      }

      await writeContractAsync({
        address: addrs.nftCdp,
        abi: nftCdpAbi,
        functionName: "liquidate",
        args: [
          collection,
          BigInt(tokenId),
          BigInt(quote.price),
          BigInt(quote.deadline),
          quote.signature,
        ],
        chainId: protocol.chainId,
      });
      await Promise.all([protocol.refetch(), refetchAll()]);
      toastSuccess("Position liquidated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user rejected|denied/i.test(msg)) setError(msg.slice(0, 280));
    } finally {
      setBusyKey(null);
    }
  };

  if (!protocol.deployed || !protocol.addresses) {
    return (
      <AppShell>
        <Card title="Risky Troves">
          <p className="text-sm font-medium text-[var(--muted)]">
            No deploy for chain {protocol.chainId}.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Card title="Risky Troves">
        <p className="mb-4 text-[13px] font-medium text-[var(--muted)]">
          Liquidatable at ≥50% LTV. OpenSea floor per collection.
        </p>

        {troves.length === 0 ? (
          <p className="text-sm font-medium text-[var(--muted)]">
            No open positions.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {troves.map((t) => {
              const key = `${t.collection}:${t.tokenId}`;
              return (
                <TrovesRow
                  key={key}
                  trove={t}
                  busy={busyKey === key && isPending}
                  disabled={busyKey !== null && busyKey !== key}
                  spCovers={spCovers(t.debt)}
                  onLiquidate={liquidate}
                />
              );
            })}
          </ul>
        )}

        {error ? (
          <p className="mt-3 break-words text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
