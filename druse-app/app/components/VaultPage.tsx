"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { maxUint256 } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import { useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { ComingSoonCta, HeaderConnect } from "./ConnectButton";
import CopyAddress from "./CopyAddress";
import { demoNftArt } from "@/lib/demo-art";
import {
  ERC721_ABI,
  FACTORY_ABI,
  VAULT_ABI,
  getFactoryAddress,
  type VaultDetail,
} from "@/lib/druse";
import { TXS_ENABLED } from "@/lib/features";
import { getWethAddress, swapPath } from "@/lib/swap";

function formatEth(eth: number | null) {
  if (eth == null || !Number.isFinite(eth) || eth < 0) return "-";
  if (eth === 0) return "0 ETH";
  if (eth >= 1000) return `${(eth / 1000).toFixed(1)}k ETH`;
  if (eth >= 1) return `${eth.toFixed(2)} ETH`;
  return `${eth.toPrecision(3)} ETH`;
}

function formatUsd(usd: number | null) {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

function formatFee(eth: number, count: number) {
  const total = eth * Math.max(count, 1);
  if (total <= 0) return "0 ETH";
  if (total >= 1) return `${total.toFixed(4)} ETH`;
  return `${total.toPrecision(3)} ETH`;
}

function formatPct(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatRemain(sec: number) {
  if (sec <= 0) return "Ended";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function VaultPage({ slug }: { slug: string }) {
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mint" | "redeem">("mint");
  const [picked, setPicked] = useState<string[]>([]);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemTargets, setRedeemTargets] = useState<string[]>([]);
  const [redeemValueWei, setRedeemValueWei] = useState(0n);
  const [justApproved, setJustApproved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { address, isConnected } = useAppKitAccount();
  const config = useConfig();
  const { writeContractAsync, isPending } = useWriteContract();
  const busy = isPending || confirming;

  const load = () => {
    const q = address ? `?wallet=${address}` : "";
    fetch(`/api/vaults/${slug}${q}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("not-found");
        return r.json();
      })
      .then((data: { vault?: VaultDetail; owned?: string[] }) => {
        setVault(data.vault ?? null);
        setOwned(data.owned ?? []);
        setError(data.vault ? null : "Vault not found.");
      })
      .catch((err: Error) => {
        setVault(null);
        setError(err.message === "not-found" ? "Vault not found." : "Could not read this vault.");
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, address]);

  useEffect(() => {
    setPicked([]);
    setRedeemOpen(false);
    setRedeemTargets([]);
    setRedeemValueWei(0n);
  }, [tab, slug]);

  const { data: approved } = useReadContract({
    address: vault?.asset as `0x${string}` | undefined,
    abi: ERC721_ABI,
    functionName: "isApprovedForAll",
    args: address && vault ? [address as `0x${string}`, vault.vault as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && vault) },
  });

  const { data: pTokenBal } = useReadContract({
    address: vault?.vault as `0x${string}` | undefined,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && vault) },
  });

  const { data: feeFree } = useReadContract({
    address: getFactoryAddress() as `0x${string}` | undefined,
    abi: FACTORY_ABI,
    functionName: "excludedFromFees",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  const pTokenCount = pTokenBal ? Number(pTokenBal / 10n ** 18n) : 0;
  const ids = tab === "mint" ? owned : (vault?.tokenIds ?? []);
  const waived = Boolean(feeFree);
  const feeEach = waived ? 0 : tab === "mint" ? (vault?.mintFeeEth ?? 0) : (vault?.redeemFeeEth ?? 0);
  const feeWei = waived
    ? 0n
    : BigInt(tab === "mint" ? (vault?.mintFeeWei ?? "0") : (vault?.redeemFeeWei ?? "0"));
  const canAct = tab === "mint" ? vault?.enableMint : vault?.enableRedeem;

  const toggle = (id: string) => {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const selectedCount = picked.length;
  const value = useMemo(() => feeWei * BigInt(Math.max(selectedCount, 0)), [feeWei, selectedCount]);

  const openRedeemSpecific = (next: string[]) => {
    if (!next.length) return;
    setPicked(next);
    setRedeemTargets(next);
    setRedeemOpen(true);
  };

  const flashSuccess = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const sendTx = async (
    req: {
      address: `0x${string}`;
      abi: readonly Record<string, unknown>[];
      functionName: string;
      args?: readonly unknown[];
      value?: bigint;
    },
    successMsg: string,
    after?: () => void,
  ) => {
    const hash = await writeContractAsync(req as Parameters<typeof writeContractAsync>[0]);
    setConfirming(true);
    try {
      await waitForTransactionReceipt(config, { hash });
      after?.();
      flashSuccess(successMsg);
    } finally {
      setConfirming(false);
    }
  };

  const onConfirm = async () => {
    if (!vault || !address || busy) return;
    try {
      if (tab === "mint") {
        if (!picked.length) return;
        const tokenIds = picked.map((id) => BigInt(id));
        if (!approved && !justApproved) {
          await sendTx(
            {
              address: vault.asset as `0x${string}`,
              abi: ERC721_ABI,
              functionName: "setApprovalForAll",
              args: [vault.vault as `0x${string}`, true],
            },
            "Collection approved",
            () => setJustApproved(true),
          );
          return;
        }
        await sendTx(
          {
            address: vault.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "mint",
            args: [tokenIds, [], address as `0x${string}`, address as `0x${string}`],
            value,
          },
          `Minted ${tokenIds.length} ${vault.symbol}`,
          () => {
            setPicked([]);
            load();
          },
        );
        return;
      }
      if (!redeemTargets.length) return;
      const tokenIds = redeemTargets.map((id) => BigInt(id));
      await sendTx(
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "redeem",
          args: [tokenIds, address as `0x${string}`, 0n, maxUint256, false],
          value: redeemValueWei,
        },
        `Redeemed ${tokenIds.length} NFT${tokenIds.length === 1 ? "" : "s"}`,
        () => {
          setPicked([]);
          setRedeemTargets([]);
          setRedeemOpen(false);
          load();
        },
      );
    } catch {
      setConfirming(false);
    }
  };

  if (error && !vault) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-8 md:py-16">
        <Link href="/vaults" className="text-[14px] text-white/45 hover:text-white">
          All collections
        </Link>
        <p className="mt-10 text-[15px] text-white/50">{error}</p>
      </main>
    );
  }

  if (!vault) {
    return <VaultSkeleton />;
  }

  const actionLabel =
    tab === "mint"
      ? !approved && !justApproved
        ? "Approve collection"
        : picked.length
          ? `Mint ${picked.length} ${vault.symbol}`
          : "Mint"
      : "Redeem";

  const items = vault.tokenIds.length;
  const tvlEth =
    vault.floorEth != null && Number.isFinite(vault.floorEth)
      ? items * vault.floorEth
      : null;
  const tvlUsd =
    vault.floorUsd != null && Number.isFinite(vault.floorUsd)
      ? items * vault.floorUsd
      : null;
  const volumeUsd =
    vault.floorEth && vault.volumeEth != null && vault.floorUsd
      ? vault.volumeEth * (vault.floorUsd / vault.floorEth)
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-8 md:py-16">
      <Link href="/vaults" className="text-[14px] text-white/45 hover:text-white">
        All collections
      </Link>

      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#141210]">
            {vault.art || vault.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vault.art || vault.image || ""}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <h1 className="min-w-0">
              <CopyAddress
                address={vault.asset}
                className="font-[family-name:var(--font-headline)] text-[32px] leading-[1.02] font-extrabold tracking-[-0.04em] text-white md:text-[44px]"
              >
                {vault.name}
              </CopyAddress>
            </h1>
            <CopyAddress
              address={vault.vault}
              className="mt-1 block text-[14px] text-[#c6a35a]"
            >
              {vault.symbol}
            </CopyAddress>
          </div>
        </div>
        <Link
          href={swapPath(vault.vault, getWethAddress())}
          className="h-9 shrink-0 rounded-full bg-[#e8c547] px-5 text-[13px] font-semibold leading-9 text-[#1b1b1b] hover:bg-[#f0d36a]"
        >
          Trade
        </Link>
      </div>

      {vault.description ? (
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-white/50">
          {vault.description}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-white/8 py-5 lg:grid-cols-4">
        <Stat label="TVL" value={formatEth(tvlEth)} hint={formatUsd(tvlUsd)} />
        <Stat label="In vault" value={String(items)} hint={items === 1 ? "NFT" : "NFTs"} />
        <Stat label="24h volume" value={formatEth(vault.volumeEth)} hint={formatUsd(volumeUsd)} />
        <Stat label="Floor" value={formatEth(vault.floorEth)} hint={formatUsd(vault.floorUsd)} />
      </div>

      {isConnected ? (
        <p className="mt-4 text-[13px] text-white/45">
          Your {vault.symbol} <span className="text-white/75">{pTokenCount}</span>
        </p>
      ) : null}

      <p className="mt-4 max-w-[54ch] text-[14px] leading-relaxed text-white/40">
        Deposit 1 NFT, get 1 {vault.symbol}. Redeem 1 {vault.symbol} to pull back
        NFT from the vault.
      </p>

      <div className="mt-10 flex gap-2">
        {(["mint", "redeem"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-10 rounded-full px-5 text-[14px] font-semibold capitalize ${
              tab === key ? "bg-white text-[#111]" : "bg-white/6 text-white/60 hover:text-white"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/25 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] text-white/55">
            {tab === "mint"
              ? "NFTs in this wallet"
              : "NFTs in the vault"}
          </div>
          {ids.length && tab === "mint" ? (
            <button
              type="button"
              onClick={() => setPicked(ids)}
              className="text-[13px] font-semibold text-[#c6a35a] hover:text-[#e8c547]"
            >
              Select all
            </button>
          ) : null}
        </div>

        {ids.length === 0 ? (
          <p className="mt-8 text-[15px] text-white/40">
            {tab === "mint"
              ? isConnected
                ? "No NFTs from this collection in this wallet."
                : "Connect to see NFTs you can mint."
              : "This vault is empty."}
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {ids.map((id) => {
              const on = picked.includes(id);
              const art = demoNftArt(vault.id, id) || vault.art || vault.image;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={`relative aspect-square w-full overflow-hidden rounded-xl ${
                      on ? "ring-2 ring-[#e8c547]" : "ring-1 ring-white/8 hover:ring-white/20"
                    }`}
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center bg-white/6 text-[13px] font-semibold text-white/70">
                        #{id}
                      </span>
                    )}
                    <span
                      className={`absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                        on ? "bg-[#e8c547] text-[#1b1b1b]" : "bg-black/65 text-white"
                      }`}
                    >
                      #{id}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[14px] text-white/50">
            Fee{" "}
            <span className="text-white">
              {waived ? "waived" : formatPct(tab === "mint" ? vault.mintFeePct : vault.redeemFeePct)}
            </span>
            <span className="text-white/35">
              {" "}
              · {waived ? "0 ETH" : formatFee(feeEach, picked.length)}
            </span>
            {picked.length ? (
              <span className="text-white/35"> · {picked.length} selected</span>
            ) : null}
          </div>
          {!TXS_ENABLED ? (
            <ComingSoonCta className="inline-flex h-11 min-w-[7.5rem] cursor-not-allowed items-center justify-center rounded-full bg-[#e8c547] px-6 text-[14px] font-semibold text-[#1b1b1b] opacity-35" />
          ) : !isConnected ? (
            <HeaderConnect />
          ) : (
            <button
              type="button"
              disabled={
                !canAct ||
                busy ||
                (tab === "mint" && !picked.length) ||
                (tab === "redeem" && !picked.length)
              }
              onClick={() => {
                if (tab === "redeem") {
                  openRedeemSpecific(picked);
                  return;
                }
                void onConfirm();
              }}
              aria-busy={busy && tab === "mint"}
              className="inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-full bg-[#e8c547] px-6 text-[14px] font-semibold text-[#1b1b1b] disabled:opacity-40"
            >
              {busy && tab === "mint" ? <ButtonSpinner /> : actionLabel}
            </button>
          )}
        </div>
        {tab === "redeem" && isConnected && picked.length > pTokenCount ? (
          <p className="mt-3 text-[13px] text-white/40">
            You need {picked.length} {vault.symbol}. You have {pTokenCount}.
          </p>
        ) : null}
        {canAct === false ? (
          <p className="mt-3 text-[13px] text-white/40">
            {tab === "mint" ? "Mint is off for this vault." : "Redeem is off for this vault."}
          </p>
        ) : null}
      </div>
      {redeemOpen && tab === "redeem" ? (
        <RedeemModal
          vault={vault}
          ids={redeemTargets}
          pTokenHave={pTokenCount}
          busy={busy}
          canAct={canAct !== false}
          feeFree={waived}
          onQuote={setRedeemValueWei}
          onCancel={() => {
            if (busy) return;
            setRedeemOpen(false);
          }}
          onConfirm={() => void onConfirm()}
        />
      ) : null}
      {notice ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500/15 px-4 py-2 text-[13px] font-semibold text-emerald-400 ring-1 ring-emerald-400/30"
        >
          {notice}
        </div>
      ) : null}
    </main>
  );
}

function RedeemModal({
  vault,
  ids,
  pTokenHave,
  busy,
  canAct,
  feeFree,
  onQuote,
  onCancel,
  onConfirm,
}: {
  vault: VaultDetail;
  ids: string[];
  pTokenHave: number;
  busy: boolean;
  canAct: boolean;
  feeFree: boolean;
  onQuote: (wei: bigint) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const factory = getFactoryAddress();
  const count = BigInt(Math.max(ids.length, 1));
  const pTokenNeeded = ids.length || 1;
  const short = pTokenHave < pTokenNeeded;
  const previewId = ids[0] ?? null;
  const previewArt = previewId
    ? demoNftArt(vault.id, previewId) || vault.art || vault.image
    : vault.art || vault.image;

  const { data: fees, isLoading: feesLoading } = useReadContract({
    address: vault.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "vaultFees",
  });

  const redeemFeeP = fees?.[1] ?? 0n;
  const vaultFeeP = redeemFeeP * count;

  const { data: premiumRows, isLoading: premiumLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "getPTokenPremium721" as const,
      args: [BigInt(vault.vaultId), BigInt(id)] as const,
    })),
    query: { enabled: Boolean(factory && ids.length) },
  });

  const premiumP = (premiumRows ?? []).reduce((sum, row) => {
    if (row.status !== "success") return sum;
    return sum + row.result[0];
  }, 0n);

  const { data: feeEthWei, isLoading: feeEthLoading } = useReadContract({
    address: vault.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "pTokenToETH",
    args: [vaultFeeP],
    query: { enabled: vaultFeeP > 0n },
  });

  const { data: premiumEthWei, isLoading: premiumEthLoading } = useReadContract({
    address: vault.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "pTokenToETH",
    args: [premiumP],
    query: { enabled: premiumP > 0n },
  });

  const { data: totalEthWei } = useReadContract({
    address: vault.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "pTokenToETH",
    args: [vaultFeeP + premiumP],
    query: { enabled: vaultFeeP + premiumP > 0n },
  });

  const { data: premiumDuration } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: FACTORY_ABI,
    functionName: "premiumDuration",
    query: { enabled: Boolean(factory) },
  });

  const { data: depositRows, isLoading: depositLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: vault.vault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "tokenDepositInfo" as const,
      args: [BigInt(id)] as const,
    })),
    query: { enabled: Boolean(ids.length) },
  });

  const depositedAt = (depositRows ?? []).reduce((latest, row) => {
    if (row.status !== "success") return latest;
    const ts = Number(row.result[0]);
    return ts > latest ? ts : latest;
  }, 0);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const feeEth = feeFree ? 0n : (feeEthWei ?? 0n);
  const premiumEth = feeFree ? 0n : (premiumEthWei ?? 0n);
  const totalEth = feeFree ? 0n : (totalEthWei ?? feeEth + premiumEth);
  const sendEth = feeFree ? 0n : totalEth + (totalEth * 2n) / 100n;
  const quoting = feeFree ? false : feesLoading || premiumLoading || feeEthLoading || premiumEthLoading;
  const showSnipe = !feeFree && premiumP > 0n;
  const noPool =
    !feeFree &&
    !quoting &&
    ((vaultFeeP > 0n && feeEth === 0n) || (premiumP > 0n && premiumEth === 0n));
  const snipePct = Number(premiumP) / 1e16;
  const remainSec =
    depositedAt > 0 && premiumDuration
      ? Number(premiumDuration) - (now - depositedAt)
      : 0;

  useEffect(() => {
    onQuote(sendEth);
  }, [onQuote, sendEth]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onCancel]);

  const snipeRemain = depositLoading
    ? "…"
    : remainSec > 0
      ? `Ends in ${formatRemain(remainSec)}`
      : depositedAt > 0
        ? "Premium ended"
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-4">
      <button
        type="button"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="redeem-title"
        className="redeem-sheet relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#131313] md:h-auto md:max-h-[min(720px,84vh)] md:max-w-[420px] md:rounded-[20px] md:border md:border-[#ffffff12]"
      >
        <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-1 md:pt-5">
          <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Redeem</div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[22px] leading-none text-[#9b9b9b] hover:bg-[#1b1b1b] hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="cool-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          <div className="flex items-start gap-4">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[16px] bg-[#1b1b1b]">
              {previewArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewArt} alt="" className="h-full w-full object-cover" />
              ) : null}
              {previewId ? (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  #{previewId}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="redeem-title" className="text-[20px] font-semibold tracking-[-0.02em] text-white">
                {previewId ? `${vault.name} #${previewId}` : vault.name}
              </h2>
              <p className="mt-1.5 text-[14px] leading-5 text-[#9b9b9b]">
                Pull this NFT. Burn {pTokenNeeded} {vault.symbol}.
              </p>
            </div>
          </div>

          {ids.length > 1 ? (
            <ul className="mt-4 flex gap-2 overflow-x-auto">
              {ids.slice(1).map((id) => {
                const art = demoNftArt(vault.id, id) || vault.art || vault.image;
                return (
                  <li key={id} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[#1b1b1b]">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <span className="absolute bottom-0.5 left-0.5 text-[9px] font-semibold text-white">
                      #{id}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-5 rounded-[16px] border border-[#ffffff12] bg-[#1b1b1b] px-4 py-4">
            <Row label={`Burn ${vault.symbol}`} value={`${pTokenNeeded} ${vault.symbol}`} />
            <Row
              label="Redeem fee"
              value={feeFree ? "0 ETH" : quoting ? "…" : `${formatEth(Number(feeEth) / 1e18)}`}
              hint={feeFree ? "Whitelist · no fee" : vault.redeemFeePct > 0
                  ? noPool
                    ? `${formatPct(vault.redeemFeePct)} of floor price · 0 ETH, no pool`
                    : `${formatPct(vault.redeemFeePct)} of floor price`
                  : "On-chain"}
            />
            {showSnipe ? (
              <Row
                label="Snipe premium"
                value={quoting ? "…" : `${formatEth(Number(premiumEth) / 1e18)}`}
                hint={
                  noPool
                    ? `${formatPct(snipePct)} of floor · 0 ETH, no pool`
                    : `${formatPct(snipePct)} of floor price`
                }
              />
            ) : null}
            <div className="mt-3 flex items-end justify-between border-t border-[#ffffff12] pt-3">
              <div className="text-[14px] text-[#9b9b9b]">ETH due</div>
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                {quoting ? "…" : formatEth(Number(totalEth) / 1e18)}
              </div>
            </div>
          </div>

          {showSnipe && snipeRemain ? (
            <p className="mt-3 text-[14px] text-[#9b9b9b]">{snipeRemain}</p>
          ) : null}

          {short ? (
            <p className="mt-3 text-[14px] text-[#9b9b9b]">
              You need {pTokenNeeded} {vault.symbol}. You have {pTokenHave}.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-14 rounded-[16px] bg-[#1b1b1b] text-[16px] font-semibold text-white hover:bg-[#222] disabled:opacity-35"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!TXS_ENABLED || busy || short || !canAct || quoting}
            onClick={onConfirm}
            aria-busy={busy}
            className="inline-flex h-14 items-center justify-center rounded-[16px] bg-white text-[16px] font-semibold tracking-[-0.02em] text-black hover:bg-[#f2f2f2] disabled:opacity-35"
          >
            {!TXS_ENABLED ? "Coming soon" : busy ? <ButtonSpinner /> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="text-[14px] text-[#9b9b9b]">{label}</div>
      <div className="text-right">
        <div className="text-[14px] font-medium text-white">{value}</div>
        {hint ? <div className="mt-0.5 text-[12px] text-[#5e5e5e]">{hint}</div> : null}
      </div>
    </div>
  );
}

function ButtonSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path
        d="M17 10a7 7 0 0 0-7-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div>
      <div className="text-[12px] text-white/40">{label}</div>
      <div className="mt-1 text-[16px] font-medium tracking-[-0.02em] text-white/75">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[12px] text-white/35">{hint}</div> : null}
    </div>
  );
}

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/8 ${className}`} />;
}

export function VaultSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-8 md:py-16">
      <Bone className="h-4 w-28" />
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Bone className="h-20 w-20 rounded-2xl" />
          <div>
            <Bone className="h-9 w-48 md:h-11 md:w-64" />
            <Bone className="mt-2 h-4 w-20" />
          </div>
        </div>
        <Bone className="h-9 w-20 rounded-full" />
      </div>
      <Bone className="mt-5 h-4 w-full max-w-[62ch]" />
      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-white/8 py-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <Bone className="h-3 w-14" />
            <Bone className="mt-2 h-4 w-20" />
          </div>
        ))}
      </div>
      <Bone className="mt-6 h-4 w-full max-w-[54ch]" />
      <Bone className="mt-2 h-4 w-2/3 max-w-[40ch]" />
      <div className="mt-10 flex gap-2">
        <Bone className="h-10 w-20 rounded-full" />
        <Bone className="h-10 w-24 rounded-full" />
      </div>
      <div className="mt-6 rounded-2xl border border-white/8 bg-black/25 p-5">
        <Bone className="h-4 w-40" />
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-5">
          <Bone className="h-4 w-28" />
          <Bone className="h-11 w-36 rounded-full" />
        </div>
      </div>
    </main>
  );
}
