"use client";

import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { amountInput, pretty } from "@/lib/format";
import { useProtocol } from "@/lib/protocol";
import { erc20Abi, rsrvStakingAbi } from "@/lib/abi";
import {
  Card,
  PrimaryButton,
  SummaryRow,
  Tabs,
  TokenInput,
} from "@/app/components/ui";
import { toastSuccess } from "@/app/components/ToastHost";

type Tab = "stake" | "unstake";

export default function StakingCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const protocol = useProtocol();
  const { writeContractAsync, isPending } = useWriteContract();
  const [tab, setTab] = useState<Tab>("stake");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountWei = useMemo(() => {
    try {
      if (!amount || amount === ".") return 0n;
      return parseEther(amount as `${number}`);
    } catch {
      return 0n;
    }
  }, [amount]);

  const run = async (fn: () => Promise<void>, success = "Transaction successful") => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await protocol.refetch();
      setAmount("");
      toastSuccess(success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user rejected|denied/i.test(msg)) setError(msg.slice(0, 280));
    } finally {
      setBusy(false);
    }
  };

  if (!protocol.deployed || !protocol.addresses) {
    return (
      <Card title="RSRV Staking" open={open} onToggle={onToggle}>
        <p className="text-sm font-medium text-[var(--muted)]">
          Waiting for NFT CDP deploy on this chain.
        </p>
      </Card>
    );
  }

  if (!protocol.stakingLive) {
    return (
      <Card title="RSRV Staking" open={open} onToggle={onToggle}>
        <p className="text-sm font-medium text-[var(--muted)]">
          Staking is disabled until RSRV is wired. Borrow fees currently go to
          the treasury and Stability Pool.
        </p>
      </Card>
    );
  }

  const addrs = protocol.addresses;
  const loading = busy || isPending;
  const empty = amountWei === 0n;

  const ctaLabel = loading
    ? "Confirm…"
    : empty
      ? "Enter an amount"
      : tab === "stake"
        ? "Stake"
        : "Unstake";

  const ctaDisabled =
    loading ||
    empty ||
    (tab === "unstake" && (protocol.rsrvStake ?? 0n) === 0n);

  return (
    <Card
      title="RSRV Staking"
      open={open}
      onToggle={onToggle}
      tabs={
        <Tabs
          value={tab}
          onChange={(id) => {
            setTab(id as Tab);
            setAmount("");
            setError(null);
          }}
          options={[
            { id: "stake", label: "Stake" },
            { id: "unstake", label: "Unstake" },
          ]}
        />
      }
    >
      <TokenInput
        id="stake-amount"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        unit="RSRV"
        iconSrc="/logo.png"
        error={error}
        onMax={() =>
          setAmount(
            amountInput(
              tab === "stake" ? protocol.rsrvBalance : protocol.rsrvStake,
            ),
          )
        }
        balanceLabel={
          tab === "stake"
            ? `Balance ${pretty(protocol.rsrvBalance)} RSRV`
            : `Your stake ${pretty(protocol.rsrvStake)} RSRV`
        }
      />

      <PrimaryButton
        loading={loading}
        disabled={ctaDisabled}
        onClick={() => {
          if (!open) onToggle();
          void run(async () => {
            if (tab === "stake") {
              if ((protocol.rsrvBalance ?? 0n) < amountWei) {
                throw new Error(
                  `Need RSRV in wallet (have ${pretty(protocol.rsrvBalance)})`,
                );
              }
              if ((protocol.rsrvAllowance ?? 0n) < amountWei) {
                await writeContractAsync({
                  address: addrs.rsrv,
                  abi: erc20Abi,
                  functionName: "approve",
                  args: [addrs.rsrvStaking, amountWei],
                  chainId: protocol.chainId,
                });
              }
              await writeContractAsync({
                address: addrs.rsrvStaking,
                abi: rsrvStakingAbi,
                functionName: "stake",
                args: [amountWei],
                chainId: protocol.chainId,
              });
              return;
            }
            await writeContractAsync({
              address: addrs.rsrvStaking,
              abi: rsrvStakingAbi,
              functionName: "unstake",
              args: [amountWei],
              chainId: protocol.chainId,
            });
          }, tab === "stake" ? "Stake successful" : "Unstake successful");
        }}
      >
        {ctaLabel}
      </PrimaryButton>

      <div className="mt-4">
        <SummaryRow label="Your stake">
          {pretty(protocol.rsrvStake)} RSRV
        </SummaryRow>
        <SummaryRow label="Pending fees">
          {pretty(protocol.stakePending)} rUSD
        </SummaryRow>
        <SummaryRow label="Total staked">
          {pretty(protocol.stakedRsrv)} RSRV
        </SummaryRow>
        <SummaryRow label="Rewards paid in">rUSD from borrow fees</SummaryRow>
        {(protocol.stakePending ?? 0n) > 0n ? (
          <button
            type="button"
            disabled={loading}
            className="mt-2 text-[13px] font-semibold text-[var(--cta)] hover:brightness-110 disabled:opacity-40"
            onClick={() =>
              void run(async () => {
                await writeContractAsync({
                  address: addrs.rsrvStaking,
                  abi: rsrvStakingAbi,
                  functionName: "claim",
                  args: [],
                  chainId: protocol.chainId,
                });
              }, "Fees claimed")
            }
          >
            Claim fees
          </button>
        ) : null}
      </div>
    </Card>
  );
}
