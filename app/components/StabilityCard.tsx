"use client";

import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { amountInput, pretty } from "@/lib/format";
import { useProtocol } from "@/lib/protocol";
import { erc20Abi, stabilityPoolAbi } from "@/lib/abi";
import {
  Card,
  PrimaryButton,
  SummaryRow,
  Tabs,
  TokenInput,
} from "@/app/components/ui";
import { toastSuccess } from "@/app/components/ToastHost";

type Tab = "deposit" | "withdraw";

export default function StabilityCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const protocol = useProtocol();
  const { writeContractAsync, isPending } = useWriteContract();
  const [tab, setTab] = useState<Tab>("deposit");
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
      <Card title="Stability Pool" open={open} onToggle={onToggle}>
        <p className="text-sm font-medium text-[var(--muted)]">
          Waiting for NFT CDP deploy on this chain.
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
      : tab === "deposit"
        ? "Deposit"
        : "Withdraw";

  const ctaDisabled =
    loading ||
    empty ||
    (tab === "withdraw" && (protocol.spDeposit ?? 0n) === 0n);

  return (
    <Card
      title="Stability Pool"
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
            { id: "deposit", label: "Deposit" },
            { id: "withdraw", label: "Withdraw" },
          ]}
        />
      }
    >
      <TokenInput
        id="stability-amount"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        unit="rUSD"
        iconSrc="/rusd.png"
        error={error}
        onMax={() =>
          setAmount(
            amountInput(
              tab === "deposit" ? protocol.rusdBalance : protocol.spDeposit,
            ),
          )
        }
        balanceLabel={
          tab === "deposit"
            ? `Balance ${pretty(protocol.rusdBalance)} rUSD`
            : `Your deposit ${pretty(protocol.spDeposit)} rUSD`
        }
      />

      <PrimaryButton
        loading={loading}
        disabled={ctaDisabled}
        onClick={() => {
          if (!open) onToggle();
          void run(async () => {
            if (tab === "deposit") {
              if ((protocol.rusdSpAllowance ?? 0n) < amountWei) {
                await writeContractAsync({
                  address: addrs.rusd,
                  abi: erc20Abi,
                  functionName: "approve",
                  args: [addrs.stabilityPool, amountWei],
                  chainId: protocol.chainId,
                });
              }
              await writeContractAsync({
                address: addrs.stabilityPool,
                abi: stabilityPoolAbi,
                functionName: "provide",
                args: [amountWei],
                chainId: protocol.chainId,
              });
              return;
            }
            await writeContractAsync({
              address: addrs.stabilityPool,
              abi: stabilityPoolAbi,
              functionName: "withdraw",
              args: [amountWei],
              chainId: protocol.chainId,
            });
          }, tab === "deposit" ? "Deposit successful" : "Withdraw successful");
        }}
      >
        {ctaLabel}
      </PrimaryButton>

      <div className="mt-4">
        <SummaryRow label="Your deposit">
          {pretty(protocol.spDeposit)} rUSD
        </SummaryRow>
        <SummaryRow label="Pending fees">
          {pretty(protocol.spPending)} rUSD
        </SummaryRow>
        <SummaryRow label="Pool total">
          {pretty(protocol.rusdInSp)} rUSD
        </SummaryRow>
        {(protocol.spPending ?? 0n) > 0n ? (
          <button
            type="button"
            disabled={loading}
            className="mt-2 text-[13px] font-semibold text-[var(--cta)] hover:brightness-110 disabled:opacity-40"
            onClick={() =>
              void run(async () => {
                await writeContractAsync({
                  address: addrs.stabilityPool,
                  abi: stabilityPoolAbi,
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
