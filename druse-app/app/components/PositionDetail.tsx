"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";
import PairMark from "./PairMark";
import { ComingSoonCta } from "./ConnectButton";
import { DEFAULT_CHAIN_ID, getDeployment } from "@/lib/druse";
import { TXS_ENABLED } from "@/lib/features";
import { getUniswap } from "@/config/uniswap";
import {
  POSITION_MANAGER_ABI,
  encodeCollect,
  encodeRemove,
  type LivePosition,
} from "@/lib/pools";
import { drusePoolKey } from "@/lib/universalRouter";

function formatAmt(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(3);
}

export default function PositionDetail({ tokenId }: { tokenId: string }) {
  const { address } = useAppKitAccount();
  const config = useConfig();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pos, setPos] = useState<LivePosition | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const manager = (d.uniswapV4?.positionManager ?? uni.positionManager) as `0x${string}`;
  const hook = d.druse?.hook as `0x${string}`;
  const weth = (d.uniswapV4?.weth ?? uni.weth) as `0x${string}`;

  const load = () => {
    fetch(`/api/positions?id=${tokenId}`)
      .then((r) => r.json())
      .then((data: { position?: LivePosition | null }) => setPos(data.position ?? null))
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  const run = async (kind: "collect" | "remove") => {
    if (!pos || !address) return;
    setStatus(kind === "collect" ? "Collecting fees" : "Removing");
    try {
      const key = drusePoolKey(pos.vault as `0x${string}`, weth, hook);
      const data =
        kind === "collect"
          ? encodeCollect({
              tokenId: BigInt(pos.tokenId),
              currency0: key.currency0,
              currency1: key.currency1,
              recipient: address as `0x${string}`,
            })
          : encodeRemove({
              tokenId: BigInt(pos.tokenId),
              liquidity: BigInt(pos.liquidity),
              currency0: key.currency0,
              currency1: key.currency1,
              recipient: address as `0x${string}`,
            });
      const hash = await writeContractAsync({
        address: manager,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: [data, BigInt(Math.floor(Date.now() / 1000) + 600)],
      });
      await waitForTransactionReceipt(config, { hash });
      setStatus(kind === "collect" ? "Fees collected." : "Position closed.");
      load();
    } catch {
      setStatus("Rejected or failed.");
    }
  };

  if (!pos) {
    return (
      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-10">
        <Link href="/positions" className="text-[13px] text-white/40 hover:text-white">
          Your positions
        </Link>
        {loaded ? (
          <div className="mt-8 text-[15px] text-white/50">Position not found.</div>
        ) : (
          <div className="mt-8 h-48 animate-pulse rounded-2xl bg-[#16120b]" />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-8 md:py-12">
      <div className="text-[13px] text-white/40">
        <Link href="/positions" className="hover:text-white">
          Your positions
        </Link>
        <span className="px-1.5">/</span>
        #{pos.tokenId}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <PairMark image={pos.image} className="scale-125" />
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
            {pos.symbol} / ETH
          </h1>
          <div className={`text-[13px] ${pos.inRange ? "text-[#e8c547]" : "text-white/40"}`}>
            {pos.inRange ? "In range" : "Out of range"} · #{pos.tokenId}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#16120b] px-4 py-4">
          <div className="text-[12px] text-white/40">Current</div>
          <div className="mt-1 text-[20px] font-semibold text-white tabular-nums">
            {formatAmt(pos.priceEth)} ETH
          </div>
        </div>
        <div className="rounded-2xl bg-[#16120b] px-4 py-4">
          <div className="text-[12px] text-white/40">Unclaimed fees</div>
          <div className="mt-1 text-[20px] font-semibold text-white tabular-nums">
            {formatAmt(pos.feesEth)} ETH
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[#16120b] px-4 py-4">
        <div className="text-[12px] text-white/40">Range</div>
        <div className="mt-2 flex justify-between text-[15px] text-white tabular-nums">
          <span>{formatAmt(pos.priceLower)}</span>
          <span className="text-white/35">to</span>
          <span>{formatAmt(pos.priceUpper)}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full w-1/2 ${pos.inRange ? "bg-[#e8c547]" : "bg-white/20"}`}
            style={{ marginLeft: pos.inRange ? "25%" : "0" }}
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[#16120b] px-4 py-4">
        <div className="text-[12px] text-white/40">In position</div>
        <div className="mt-2 flex justify-between text-[15px] text-white">
          <span>{pos.symbol}</span>
          <span className="tabular-nums">{formatAmt(pos.pToken)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[15px] text-white">
          <span>ETH</span>
          <span className="tabular-nums">{formatAmt(pos.eth)}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {!TXS_ENABLED ? (
          <ComingSoonCta className="col-span-2 flex h-12 cursor-not-allowed items-center justify-center rounded-2xl bg-[#e8c547] text-[15px] font-semibold text-[#1b1b1b] opacity-35" />
        ) : (
          <>
            <button
              type="button"
              disabled={!address || isPending || pos.feesEth <= 0}
              onClick={() => void run("collect")}
              className="h-12 rounded-2xl bg-[#e8c547] text-[15px] font-semibold text-[#1b1b1b] disabled:opacity-40"
            >
              Collect fees
            </button>
            <button
              type="button"
              disabled={!address || isPending || BigInt(pos.liquidity) === 0n}
              onClick={() => void run("remove")}
              className="h-12 rounded-2xl bg-white/8 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Remove
            </button>
          </>
        )}
      </div>
      {status ? <div className="mt-3 text-center text-[13px] text-white/50">{status}</div> : null}
    </main>
  );
}
