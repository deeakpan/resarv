"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type Address } from "viem";
import { useWriteContract } from "wagmi";
import { DECIMAL_PRECISION, NFT_LIQ_THRESHOLD } from "@/lib/contracts";
import { collectionByAddress } from "@/lib/collections";
import { pretty } from "@/lib/format";
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

function ltvPct(debt: bigint, price: bigint | null) {
  if (!price || price === 0n) return null;
  return Number((debt * 10_000n) / price) / 100;
}

/** Floor where this debt hits the liq threshold. */
function liqPrice(debt: bigint) {
  return (debt * DECIMAL_PRECISION) / NFT_LIQ_THRESHOLD;
}

function PositionRow({
  trove,
  busy,
  disabled,
  onRepay,
}: {
  trove: OpenTrove;
  busy: boolean;
  disabled: boolean;
  onRepay: (collection: Address, tokenId: number, debt: bigint) => void;
}) {
  const reg = collectionByAddress(trove.collection);
  const { priceWad, floorLabel } = useStonkFloor(trove.collection);
  const images = useStonkImages([trove.tokenId], trove.collection);
  const ltv = ltvPct(trove.debt, priceWad);
  const atRisk = priceWad
    ? (trove.debt * DECIMAL_PRECISION) / priceWad >= NFT_LIQ_THRESHOLD
    : false;
  const name = reg?.name || "NFT";

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
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/rusd.png"
            alt="rUSD"
            width={14}
            height={14}
            className="h-3.5 w-3.5 rounded-full object-cover"
          />
          Debt {pretty(trove.debt)} rUSD
        </p>
        <p className="mt-1 text-[13px] font-medium text-[var(--muted)]">
          Floor {floorLabel}
          {" · "}
          LTV {ltv != null ? `${ltv.toFixed(1)}%` : "—"}
          {" · "}
          Liq @ {pretty(liqPrice(trove.debt))}
          {atRisk ? (
            <span className="text-[var(--danger)]"> · At risk</span>
          ) : null}
        </p>
      </div>
      <div className="w-full sm:w-auto sm:min-w-[168px]">
        <PrimaryButton
          loading={busy}
          disabled={disabled}
          onClick={() =>
            onRepay(trove.collection, trove.tokenId, trove.debt)
          }
        >
          {busy ? "Confirm…" : "Repay & close"}
        </PrimaryButton>
      </div>
    </li>
  );
}

export default function Positions() {
  const protocol = useProtocol();
  const { writeContractAsync, isPending } = useWriteContract();
  const { troves, refetchAll } = useOpenTroves();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => {
    if (!protocol.address) return [];
    const me = protocol.address.toLowerCase();
    return troves.filter((t) => t.owner.toLowerCase() === me);
  }, [troves, protocol.address]);

  const repay = async (
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
      await writeContractAsync({
        address: addrs.nftCdp,
        abi: nftCdpAbi,
        functionName: "close",
        args: [collection, BigInt(tokenId)],
        chainId: protocol.chainId,
      });
      await Promise.all([protocol.refetch(), refetchAll()]);
      toastSuccess("Debt repaid. NFT returned");
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
        <Card title="Positions">
          <p className="text-sm font-medium text-[var(--muted)]">
            No deploy for chain {protocol.chainId}.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Card title="Your positions">
        {mine.length === 0 ? (
          <p className="text-sm font-medium text-[var(--muted)]">
            No open troves.{" "}
            <Link href="/dashboard" className="text-white hover:underline">
              Open one on the dashboard
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.map((t) => {
              const key = `${t.collection}:${t.tokenId}`;
              return (
                <PositionRow
                  key={key}
                  trove={t}
                  busy={busyKey === key && isPending}
                  disabled={busyKey !== null && busyKey !== key}
                  onRepay={repay}
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
