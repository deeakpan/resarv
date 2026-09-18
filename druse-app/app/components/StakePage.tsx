"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import { useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";
import { ComingSoonCta, ConnectCta } from "./ConnectButton";
import { DEFAULT_CHAIN_ID, getDeployment } from "@/lib/druse";
import { TXS_ENABLED } from "@/lib/features";
import { STAKING_ABI } from "@/lib/staking";
import { ERC20_ABI } from "@/lib/pools";

const EXPLORER = "https://robinhoodchain.blockscout.com/address";

function formatTok(wei?: bigint) {
  if (wei == null || wei <= 0n) return "0.00";
  const whole = wei / 10n ** 18n;
  if (whole >= 10n ** 12n) return `${fmtCompact(whole, 12n)}T`;
  if (whole >= 10n ** 9n) return `${fmtCompact(whole, 9n)}B`;
  if (whole >= 10n ** 6n) return `${fmtCompact(whole, 6n)}M`;
  const raw = formatUnits(wei, 18);
  const [w, frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "");
  if (!trimmed) return w.length > 3 ? Number(w).toLocaleString("en-US") : `${w}.00`;
  const digits = Number(w) >= 1 ? 4 : 8;
  return `${w}.${trimmed.slice(0, digits)}`;
}

function fmtCompact(whole: bigint, zeros: bigint) {
  const scaled = Number(whole / 10n ** (zeros - 2n)) / 100;
  if (!Number.isFinite(scaled)) return "∞";
  return scaled.toFixed(2);
}

function sanitizeAmt(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const wholeRaw = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const frac = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 18);
  const whole = wholeRaw.slice(0, 18);
  if (dot === -1) return whole;
  return `${whole || "0"}.${frac}`;
}

function toInput(wei?: bigint) {
  if (!wei || wei <= 0n) return "";
  const raw = formatUnits(wei, 18);
  if (!raw.includes(".")) return raw;
  return raw.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function parseAmt(value: string) {
  const clean = sanitizeAmt(value);
  if (!clean || clean === ".") return 0n;
  try {
    return parseUnits(clean, 18);
  } catch {
    return 0n;
  }
}

export default function StakePage() {
  const { address, isConnected } = useAppKitAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [tab, setTab] = useState<"stake" | "withdraw">("stake");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"approve" | "stake" | "withdraw" | "reward" | null>(
    null,
  );

  useEffect(() => {
    setAmount((cur) => sanitizeAmt(cur));
  }, []);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const d = getDeployment(DEFAULT_CHAIN_ID);
  const staking = d.druse?.staking as `0x${string}` | undefined;
  const stakeToken = d.druse?.stakeToken as `0x${string}` | undefined;

  const enabled = Boolean(address && staking);
  const { data: staked, refetch: refStaked } = useReadContract({
    address: staking,
    abi: STAKING_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled },
  });
  const { data: earned, refetch: refEarned } = useReadContract({
    address: staking,
    abi: STAKING_ABI,
    functionName: "earned",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled },
  });
  const { data: total } = useReadContract({
    address: staking,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(staking) },
  });
  const { data: walletBal, refetch: refWallet } = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && stakeToken) },
  });
  const { data: allowance, refetch: refAllow } = useReadContract({
    address: stakeToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && staking
        ? [address as `0x${string}`, staking]
        : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && stakeToken && staking) },
  });

  const available = tab === "stake" ? walletBal : staked;
  const wei = parseAmt(amount);
  const nextStaked =
    tab === "stake"
      ? (staked ?? 0n) + wei
      : (staked ?? 0n) > wei
        ? (staked ?? 0n) - wei
        : 0n;
  const nextTotal =
    tab === "stake"
      ? (total ?? 0n) + wei
      : (total ?? 0n) > wei
        ? (total ?? 0n) - wei
        : 0n;
  const shareNow =
    staked && total && total > 0n && staked > 0n
      ? Number((staked * 10_000n) / total) / 100
      : 0;
  const shareNext =
    wei > 0n && nextTotal > 0n
      ? Number((nextStaked * 10_000n) / nextTotal) / 100
      : shareNow;
  const claimable = Boolean(earned && earned > 0n);
  const tooMuch = wei > 0n && available != null && wei > available;
  const needsApprove = tab === "stake" && wei > 0n && (allowance ?? 0n) < wei;
  const canSubmit = wei > 0n && !tooMuch && !busy;

  const flashSuccess = (msg: string) => {
    setFailed(false);
    setStatus(msg);
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const refresh = () => {
    void refStaked();
    void refEarned();
    void refWallet();
    void refAllow();
  };

  const switchTab = (next: "stake" | "withdraw") => {
    setTab(next);
    setStatus(null);
    setFailed(false);
  };

  const fillMax = () => {
    setAmount(toInput(available));
    setStatus(null);
    setFailed(false);
  };

  const send = async (kind: "approve" | "stake" | "withdraw" | "reward") => {
    if (!staking || !address) return;
    setBusy(kind);
    setStatus(null);
    setFailed(false);
    try {
      if (kind === "reward") {
        const hash = await writeContractAsync({
          address: staking,
          abi: STAKING_ABI,
          functionName: "getReward",
        });
        await waitForTransactionReceipt(config, { hash });
        flashSuccess("Rewards collected.");
        refresh();
        return;
      }
      if (kind === "approve") {
        if (!stakeToken) return;
        const hash = await writeContractAsync({
          address: stakeToken,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [staking, maxUint256],
        });
        await waitForTransactionReceipt(config, { hash });
        flashSuccess("Approved $DRUSE.");
        refresh();
        return;
      }
      if (wei <= 0n) return;
      if (kind === "stake") {
        const hash = await writeContractAsync({
          address: staking,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [wei],
        });
        await waitForTransactionReceipt(config, { hash });
        flashSuccess("Staked.");
      } else {
        const hash = await writeContractAsync({
          address: staking,
          abi: STAKING_ABI,
          functionName: "withdraw",
          args: [wei],
        });
        await waitForTransactionReceipt(config, { hash });
        flashSuccess("Withdrawn.");
      }
      setAmount("");
      refresh();
    } catch {
      setFailed(true);
      setStatus("Rejected or failed.");
    } finally {
      setBusy(null);
    }
  };

  const collecting = busy === "reward";
  const confirming = busy === "approve" || busy === tab;

  const actionLabel = () => {
    if (confirming) return <ButtonSpinner />;
    if (!amount) return "Enter an amount";
    if (tooMuch) return "Insufficient $DRUSE";
    if (needsApprove) return "Approve $DRUSE";
    return tab === "stake" ? "Stake" : "Withdraw";
  };

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-10 md:py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">
        {tab === "stake" ? "Stake $DRUSE" : "Withdraw $DRUSE"}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#9b9b9b]">
        {tab === "stake"
          ? "Stake $DRUSE and receive ETH from NFT pool and vault fees."
          : "Unstake $DRUSE. Claimed rewards stay in ETH."}
      </p>

      <div className="mt-8 rounded-[24px] border border-[#ffffff12] bg-[#1b1b1b] px-5 py-5 md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[16px] font-medium tracking-[-0.02em] text-white">
            {tab === "stake" ? "Stake" : "Withdraw"}
          </div>
          <div className="flex rounded-full bg-[#131313] p-0.5">
            {(["stake", "withdraw"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`rounded-full px-3 py-1 text-[13px] font-medium capitalize ${
                  tab === id
                    ? "bg-[#e8c547] text-[#1b1b1b]"
                    : "text-[#9b9b9b] hover:text-white"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-[16px] border border-[#ffffff12] bg-[#131313] px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-full object-cover" />
          <input
            value={amount}
            onChange={(e) => {
              setAmount(sanitizeAmt(e.target.value));
              setStatus(null);
              setFailed(false);
            }}
            inputMode="decimal"
            placeholder="0.00"
            className="w-0 min-w-0 flex-1 overflow-hidden bg-transparent text-[18px] font-medium text-white outline-none placeholder:text-[#5e5e5e]"
          />
          <button
            type="button"
            onClick={fillMax}
            disabled={!available || available === 0n}
            className="text-[13px] font-semibold text-white disabled:text-[#5e5e5e]"
          >
            MAX
          </button>
        </label>
        <div className="mt-2 text-[13px] text-[#5e5e5e]">
          Balance {formatTok(available)} $DRUSE
        </div>

        {!TXS_ENABLED ? (
          <ComingSoonCta className="mt-4 flex h-14 w-full cursor-not-allowed items-center justify-center rounded-[16px] bg-[#e8c547] text-[17px] font-semibold tracking-[-0.02em] text-[#1b1b1b] opacity-35" />
        ) : !isConnected ? (
          <ConnectCta className="mt-4 flex h-14 w-full items-center justify-center rounded-[16px] bg-[#e8c547] text-[17px] font-semibold tracking-[-0.02em] text-[#1b1b1b] hover:bg-[#f0d060]" />
        ) : (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void send(needsApprove ? "approve" : tab)}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-[16px] bg-[#e8c547] text-[17px] font-semibold tracking-[-0.02em] text-[#1b1b1b] hover:bg-[#f0d060] disabled:opacity-35"
          >
            {actionLabel()}
          </button>
        )}

        {status ? (
          <div className={`mt-3 text-[13px] ${failed ? "text-[#9b9b9b]" : "text-white"}`}>
            {status}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <Detail
            label="You will receive"
            value={
              tab === "stake"
                ? `${formatTok(wei)} staked $DRUSE`
                : `${formatTok(wei)} $DRUSE`
            }
          />
          <Detail label="Exchange rate" value="1 $DRUSE = 1 staked" />
          <Detail
            label="Your share after"
            value={shareNext > 0 ? `${shareNext.toFixed(shareNext < 1 ? 2 : 1)}%` : "0.00%"}
          />
          <Detail label="Rewards paid in" value="ETH from pool and vault fees" />
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-white">
          Statistics
        </h2>
        {staking ? (
          <a
            href={`${EXPLORER}/${staking}`}
            target="_blank"
            rel="noreferrer"
            className="text-[14px] text-[#9b9b9b] hover:text-white"
          >
            View on explorer
          </a>
        ) : null}
      </div>

      <div className="mt-3 rounded-[24px] border border-[#ffffff12] bg-[#1b1b1b] px-5 py-5 md:px-6 md:py-6">
        <StatRow
          label="Earned"
          value={`${formatTok(earned)} ETH`}
          accent
          action={
            <button
              type="button"
              disabled={!TXS_ENABLED || !isConnected || !claimable || collecting}
              onClick={() => void send("reward")}
              className="rounded-full bg-[#e8c547] px-3 py-1 text-[12px] font-medium text-[#1b1b1b] disabled:bg-[#ffffff12] disabled:text-[#5e5e5e]"
            >
              {!TXS_ENABLED ? "Coming soon" : collecting ? <MiniSpinner /> : "Collect"}
            </button>
          }
        />
        <StatRow label="Your stake" value={`${formatTok(staked)} $DRUSE`} />
        <StatRow
          label="Your share"
          value={shareNow > 0 ? `${shareNow.toFixed(shareNow < 1 ? 2 : 1)}%` : "0.00%"}
        />
        <StatRow label="Total staked" value={`${formatTok(total)} $DRUSE`} last />
      </div>
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

function StatRow({
  label,
  value,
  accent,
  last,
  action,
}: {
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3.5 ${
        last ? "" : "border-b border-[#ffffff12]"
      }`}
    >
      <div className="shrink-0 text-[15px] text-white">{label}</div>
      <div className="flex min-w-0 items-center gap-2">
        {action}
        <div
          className={`min-w-0 truncate text-[15px] font-medium tabular-nums ${
            accent ? "text-[#61d4a5]" : "text-white"
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[14px]">
      <div className="shrink-0 text-[#9b9b9b]">{label}</div>
      <div className="min-w-0 truncate text-right text-white">{value}</div>
    </div>
  );
}

function MiniSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ButtonSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
