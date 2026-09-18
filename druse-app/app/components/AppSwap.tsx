"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import { useAccount, useBalance, useConfig, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { ComingSoonCta, ConnectCta } from "./ConnectButton";
import { TXS_ENABLED } from "@/lib/features";
import { TokenModal, TokenPill } from "./TokenPicker";
import { DEFAULT_CHAIN_ID, getDeployment, type LiveVault } from "@/lib/druse";
import { ERC20_ABI } from "@/lib/pools";
import { readJson } from "@/lib/rpc";
import { coverError, estimateTxCost, nativeHave } from "@/lib/tx-funds";
import { invalidateWalletReads } from "@/lib/wallet-cache";
import { toastError } from "./ToastHost";
import SwapReview, { formatQuoteRate } from "./SwapReview";
import {
  ETH_TOKEN,
  addLiqPath,
  isWeth,
  swapPath,
  tokenFromCa,
  type SwapToken,
} from "@/lib/swap";
import { getUniswap, DRUSE_LP_FEE } from "@/config/uniswap";
import {
  PERMIT2_ABI,
  UNIVERSAL_ROUTER_ABI,
  buildExactInSwap,
  deadlineSeconds,
  type PathHop,
} from "@/lib/universalRouter";
import type { QuoteResult } from "@/lib/quote";

const AUTO_SLIP = 0.5;

function formatOut(wei: bigint) {
  const n = Number(formatUnits(wei, 18));
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toPrecision(4);
}

function formatUsd(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  if (n >= 1_000_000_000_000) return ">$1T";
  if (n >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

function weiToInput(wei: bigint) {
  if (wei <= 0n) return "";
  const raw = formatUnits(wei, 18);
  if (!raw.includes(".")) return raw;
  const [whole, frac] = raw.split(".");
  const trimmed = frac.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

const WALLET_PCTS = [
  { label: "10%", bps: 1_000 },
  { label: "25%", bps: 2_500 },
  { label: "50%", bps: 5_000 },
  { label: "Max", bps: 10_000 },
] as const;

function sanitizeAmt(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const wholeRaw = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const frac = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 8);
  const whole = wholeRaw.slice(0, 12);
  if (dot === -1) return whole;
  return `${whole || "0"}.${frac}`;
}

function sanitizeUsd(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const wholeRaw = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const frac = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  const whole = wholeRaw.slice(0, 10);
  if (dot === -1) return whole;
  return `${whole || "0"}.${frac}`;
}

function usdPerToken(token: SwapToken, vaults: LiveVault[], other?: SwapToken | null) {
  if (isWeth(token.address)) {
    const priced =
      other && !isWeth(other.address) && other.floorEth && other.floorUsd
        ? other
        : vaults.find((v) => v.floorEth && v.floorUsd);
    if (!priced?.floorEth || !priced.floorUsd) return 0;
    return priced.floorUsd / priced.floorEth;
  }
  return token.floorUsd ?? 0;
}

function tokenAmtFromUsd(usdRaw: string, usdPer: number) {
  const usd = Number(usdRaw);
  if (!Number.isFinite(usd) || usd <= 0 || usdPer <= 0) return "";
  const tokens = usd / usdPer;
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  return sanitizeAmt(tokens.toFixed(8)).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}

function usdDraftFromToken(tokenAmt: string, usdPer: number) {
  const qty = Number(tokenAmt);
  if (!Number.isFinite(qty) || qty <= 0 || usdPer <= 0) return "";
  const usd = qty * usdPer;
  if (!Number.isFinite(usd) || usd <= 0) return "";
  return usd.toFixed(2);
}

function parseAmt(raw: string) {
  try {
    const clean = sanitizeAmt(raw);
    if (!clean || clean === "." || clean === "0.") return 0n;
    return parseUnits(clean, 18);
  } catch {
    return 0n;
  }
}

function slipMin(amountOut: bigint, pct: number) {
  const bps = BigInt(Math.round(Math.max(pct, 0) * 100));
  return amountOut - (amountOut * bps) / 10_000n;
}

export default function AppSwap() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAccount();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [vaults, setVaults] = useState<LiveVault[]>([]);
  const [vaultsReady, setVaultsReady] = useState(false);
  const [amount, setAmount] = useState("");
  const [inUsd, setInUsd] = useState(false);
  const [usdDraft, setUsdDraft] = useState("");
  const [openSide, setOpenSide] = useState<"in" | "out" | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [sell, setSell] = useState<SwapToken>(ETH_TOKEN);
  const [buy, setBuy] = useState<SwapToken | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [slipAuto, setSlipAuto] = useState(true);
  const [slipRaw, setSlipRaw] = useState("0.50");
  const [deadlineMin, setDeadlineMin] = useState("30");
  const [status, setStatus] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [rateFlip, setRateFlip] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapDone, setSwapDone] = useState<{
    sell: SwapToken;
    buy: SwapToken;
    amountIn: bigint;
    amountOut: bigint;
    sellUsd: number;
    buyUsd: number;
    hash: `0x${string}`;
  } | null>(null);
  const quoteAt = useRef(0);
  const settingsRef = useRef<HTMLDivElement>(null);

  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const weth = (d.uniswapV4?.weth ?? uni.weth) as `0x${string}`;
  const hook = (d.druse?.hook ?? "") as `0x${string}`;
  const routerAddr = uni.universalRouter as `0x${string}`;
  const permit2 = uni.permit2;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vaults")
      .then((r) => r.json())
      .then((data: { vaults?: LiveVault[] }) => {
        if (!cancelled) setVaults(data.vaults ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setVaultsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!vaults.length) return;
    const nextSell = tokenFromCa(params.get("in"), vaults) ?? ETH_TOKEN;
    const nextBuy = tokenFromCa(params.get("out"), vaults);
    setSell(nextSell);
    setBuy(nextBuy);
  }, [vaults, params]);

  useEffect(() => {
    if (!settings) return;
    const onDoc = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setSettings(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settings]);

  const writeIntent = (nextSell: SwapToken, nextBuy: SwapToken | null) => {
    setSell(nextSell);
    setBuy(nextBuy);
    if (nextBuy) router.replace(swapPath(nextSell.address, nextBuy.address), { scroll: false });
  };

  const flip = () => {
    if (!buy) return;
    writeIntent(buy, sell);
  };

  const pick = (token: SwapToken) => {
    if (openSide === "in") {
      const nextBuy = buy && buy.address === token.address ? sell : buy;
      writeIntent(token, nextBuy);
    } else if (openSide === "out") {
      const nextSell = sell.address === token.address ? buy ?? ETH_TOKEN : sell;
      writeIntent(nextSell, token);
    }
    setOpenSide(null);
  };

  const qty = Number(amount);
  const amountIn = parseAmt(amount);
  const slipPct = slipAuto ? AUTO_SLIP : Number(slipRaw) || AUTO_SLIP;
  const usdPer = usdPerToken(sell, vaults, buy);

  useEffect(() => {
    if (!buy || amountIn <= 0n) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const id = ++quoteAt.current;
    setQuoting(true);
    const t = window.setTimeout(() => {
      const q = new URLSearchParams({
        in: sell.address,
        out: buy.address,
        amount,
      });
      fetch(`/api/quote?${q}`)
        .then((r) => readJson<QuoteResult>(r, { ok: false, reason: "no_route" }))
        .then((data) => {
          if (id === quoteAt.current) setQuote(data);
        })
        .catch(() => {
          if (id === quoteAt.current) setQuote({ ok: false, reason: "no_route" });
        })
        .finally(() => {
          if (id === quoteAt.current) setQuoting(false);
        });
    }, 280);
    return () => window.clearTimeout(t);
  }, [amount, amountIn, sell.address, buy]);

  const { data: ethBal } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: tokenBal } = useReadContract({
    address: sell.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && !isWeth(sell.address)) },
  });

  const { data: tokenAllow } = useReadContract({
    address: sell.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address as `0x${string}`, permit2] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && !isWeth(sell.address)) },
  });

  const { data: p2Allow } = useReadContract({
    address: permit2,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: address
      ? [address as `0x${string}`, sell.address as `0x${string}`, routerAddr]
      : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && !isWeth(sell.address)) },
  });

  const have = isWeth(sell.address) ? ethBal?.value ?? 0n : tokenBal ?? 0n;
  const ethHave = ethBal?.value ?? 0n;
  const [gasCost, setGasCost] = useState(0n);
  const needApprove =
    !isWeth(sell.address) &&
    amountIn > 0n &&
    ((tokenAllow ?? 0n) < amountIn ||
      !p2Allow ||
      p2Allow[0] < amountIn ||
      Number(p2Allow[1]) < Math.floor(Date.now() / 1000) + 60);

  const amountOut = quote?.ok ? BigInt(quote.amountOut) : 0n;
  const hops: PathHop[] = quote?.ok ? quote.hops : [];
  const ethSpend = isWeth(sell.address) ? amountIn : 0n;

  useEffect(() => {
    if (!address || !buy || !quote?.ok || amountIn <= 0n) {
      setGasCost(0n);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      const call = buildExactInSwap({
        tokenIn: (isWeth(sell.address) ? weth : sell.address) as `0x${string}`,
        tokenOut: (isWeth(buy.address) ? weth : buy.address) as `0x${string}`,
        amountIn,
        amountOutMin: slipMin(amountOut, slipPct),
        weth,
        hook,
        hops,
        nativeIn: isWeth(sell.address),
        nativeOut: isWeth(buy.address),
      });
      const mins = Math.max(1, Number(deadlineMin) || 30);
      void estimateTxCost({
        account: address as `0x${string}`,
        to: routerAddr,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [call.commands, call.inputs, deadlineSeconds(mins * 60)],
        value: call.value,
        fallbackGas: 350_000n,
      })
        .then((cost) => {
          if (live) setGasCost(cost);
        })
        .catch(() => {
          if (live) setGasCost(0n);
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [
    address,
    buy,
    quote,
    amountIn,
    amountOut,
    slipPct,
    deadlineMin,
    sell.address,
    weth,
    hook,
    routerAddr,
  ]);

  const gasBlock = coverError(ethHave, ethSpend + gasCost, "gas");
  const sellUsd =
    Number.isFinite(qty) && qty > 0 && qty < 1_000_000_000 && usdPer > 0 ? qty * usdPer : 0;

  useEffect(() => {
    if (!inUsd) return;
    if (usdPer <= 0) {
      setInUsd(false);
      return;
    }
    setAmount(tokenAmtFromUsd(usdDraft, usdPer));
    // Keep the typed dollar amount; only retarget the token size when price changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdPer, sell.address, inUsd]);

  const fillFromWallet = (bps: number) => {
    let wei = (have * BigInt(bps)) / 10_000n;
    if (bps === 10_000 && isWeth(sell.address)) {
      const buffer = gasCost > 0n ? gasCost : parseUnits("0.001", 18);
      wei = wei > buffer ? wei - buffer : 0n;
    }
    const next = weiToInput(wei);
    setAmount(next);
    if (inUsd && usdPer > 0) setUsdDraft(usdDraftFromToken(next, usdPer));
  };

  const toggleSellUnit = () => {
    if (usdPer <= 0) return;
    if (inUsd) {
      setInUsd(false);
    } else {
      setUsdDraft(usdDraftFromToken(amount, usdPer));
      setInUsd(true);
    }
    window.requestAnimationFrame(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    });
  };

  const reason = !buy
    ? "Select a token"
    : amountIn <= 0n
      ? "Enter an amount"
      : quoting
        ? "Fetching quote"
        : quote && !quote.ok
          ? quote.reason === "no_pool"
            ? "Cannot swap"
            : quote.reason === "no_route"
              ? "No route"
              : quote.reason === "no_liquidity"
                ? "Insufficient liquidity"
                : "Enter an amount"
          : amountIn > have
            ? "Insufficient balance"
            : gasBlock
              ? gasBlock
              : "Review";

  const readyToReview = Boolean(
    isConnected &&
      buy &&
      amountIn > 0n &&
      quote?.ok &&
      amountIn <= have &&
      !gasBlock &&
      !quoting,
  );

  const buyUsdPer = buy ? usdPerToken(buy, vaults, sell) : 0;
  const buyUsd =
    amountOut > 0n && buyUsdPer > 0 ? Number(formatUnits(amountOut, 18)) * buyUsdPer : 0;
  const ethUsd = usdPerToken(ETH_TOKEN, vaults, buy);
  const gasUsd =
    gasCost > 0n && ethUsd > 0 ? Number(formatUnits(gasCost, 18)) * ethUsd : 0;
  const minOut = amountOut > 0n ? slipMin(amountOut, slipPct) : 0n;
  const feeLabel = `${(DRUSE_LP_FEE / 10_000).toFixed(2).replace(/\.?0+$/, "")}%`;

  useEffect(() => {
    if (!review || isPending || swapBusy || swapDone) return;
    if (!buy || amountIn <= 0n || !quote?.ok || amountIn > have || Boolean(gasBlock)) {
      setReview(false);
    }
  }, [review, isPending, swapBusy, swapDone, buy, amountIn, quote, have, gasBlock]);

  const closeReview = () => {
    if (swapBusy) return;
    setReview(false);
    setSwapDone(null);
    setStatus(null);
  };

  const swap = async () => {
    if (!address || !buy || !quote?.ok || swapBusy) return;
    if (amountIn > have) {
      setStatus("Insufficient balance");
      return;
    }
    setSwapBusy(true);
    setStatus(null);
    try {
      if (chainId !== DEFAULT_CHAIN_ID) {
        await switchChainAsync({ chainId: DEFAULT_CHAIN_ID });
      }
      const minOut = slipMin(amountOut, slipPct);
      const call = buildExactInSwap({
        tokenIn: (isWeth(sell.address) ? weth : sell.address) as `0x${string}`,
        tokenOut: (isWeth(buy.address) ? weth : buy.address) as `0x${string}`,
        amountIn,
        amountOutMin: minOut,
        weth,
        hook,
        hops,
        nativeIn: isWeth(sell.address),
        nativeOut: isWeth(buy.address),
      });
      const mins = Math.max(1, Number(deadlineMin) || 30);
      const gas = await estimateTxCost({
        account: address as `0x${string}`,
        to: routerAddr,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [call.commands, call.inputs, deadlineSeconds(mins * 60)],
        value: call.value,
        fallbackGas: 350_000n,
      });
      const haveEth = await nativeHave(address as `0x${string}`);
      if (haveEth < call.value + gas) {
        setStatus("Not enough ETH for gas");
        return;
      }
      if (needApprove) {
        const max = maxUint256;
        const allow = await writeContractAsync({
          address: sell.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [permit2, max],
          chainId: DEFAULT_CHAIN_ID,
        });
        await waitForTransactionReceipt(config, { hash: allow, chainId: DEFAULT_CHAIN_ID });
        const exp = Number(BigInt("0xffffffffffff"));
        const cap = amountIn > 2n ** 160n - 1n ? 2n ** 160n - 1n : amountIn;
        const p2 = await writeContractAsync({
          address: permit2,
          abi: PERMIT2_ABI,
          functionName: "approve",
          args: [sell.address as `0x${string}`, routerAddr, cap, exp],
          chainId: DEFAULT_CHAIN_ID,
        });
        await waitForTransactionReceipt(config, { hash: p2, chainId: DEFAULT_CHAIN_ID });
      }

      const hash = await writeContractAsync({
        address: routerAddr,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [call.commands, call.inputs, deadlineSeconds(mins * 60)],
        value: call.value,
        chainId: DEFAULT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash, chainId: DEFAULT_CHAIN_ID });
      await invalidateWalletReads(queryClient);
      setSwapDone({
        sell,
        buy,
        amountIn,
        amountOut,
        sellUsd,
        buyUsd,
        hash,
      });
      setAmount("");
      setUsdDraft("");
      setQuote(null);
      setStatus(null);
    } catch {
      setStatus("Rejected or failed.");
      toastError("Swap failed", { detail: "Rejected or failed." });
    } finally {
      setSwapBusy(false);
    }
  };

  const featured =
    (buy && !isWeth(buy.address)
      ? vaults.find((v) => v.vault.toLowerCase() === buy.address.toLowerCase())
      : null) ??
    (!isWeth(sell.address)
      ? vaults.find((v) => v.vault.toLowerCase() === sell.address.toLowerCase())
      : null);
  const waitingFeatured =
    !vaultsReady && Boolean(params.get("out") || (params.get("in") && !isWeth(params.get("in") ?? "")));
  const pageTitle = featured?.name ?? "Floor, in motion.";
  const pageBlurb =
    featured?.description?.trim() || "Sell, buy, and hop collections at floor.";

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-12 md:py-16">
      <div className="mb-6 text-left">
        {waitingFeatured ? (
          <>
            <div className="h-8 w-48 animate-pulse rounded-lg bg-white/8 md:h-9" />
            <div className="mt-3 h-4 w-full max-w-[360px] animate-pulse rounded bg-white/6" />
          </>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-logo)] text-[28px] font-bold tracking-[-0.03em] text-white md:text-[32px]">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-[400px] text-[15px] leading-relaxed text-white/50">
              {pageBlurb}
            </p>
          </>
        )}
      </div>

      <div className="relative mb-3 flex items-center justify-between" ref={settingsRef}>
        <Link
          href={addLiqPath(buy && !isWeth(buy.address) ? buy.address : null)}
          className="text-[15px] font-medium text-white/50 hover:text-white"
        >
          Add liquidity
        </Link>
        <button
          type="button"
          onClick={() => setSettings((v) => !v)}
          className={`p-1 ${settings ? "text-white" : "text-white/45 hover:text-white"}`}
          aria-label="Swap settings"
          aria-expanded={settings}
        >
          <GearIcon />
        </button>
        {settings ? (
          <SettingsCard
            slipAuto={slipAuto}
            slipRaw={slipRaw}
            deadlineMin={deadlineMin}
            onAuto={() => {
              setSlipAuto(true);
              setSlipRaw("0.50");
            }}
            onSlip={(v) => {
              setSlipAuto(false);
              setSlipRaw(v);
            }}
            onDeadline={setDeadlineMin}
          />
        ) : null}
      </div>

      <div className="relative">
        <div className="group rounded-[20px] border border-[#ffffff12] bg-[#131313] px-4 pt-[14px] pb-3 transition-colors duration-200 hover:bg-[#1b1b1b]">
          <div className="relative mb-1 min-h-[20px]">
            <div className="text-[15px] text-[#9b9b9b]">Sell</div>
            <div className="pointer-events-none absolute top-0 right-0 flex translate-y-1 items-center gap-2 text-[13px] font-medium text-white/40 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {WALLET_PCTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={!address || have <= 0n}
                  onClick={() => fillFromWallet(p.bps)}
                  className="hover:text-white disabled:opacity-35"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            {inUsd ? (
              <label className="flex min-w-0 flex-1 items-baseline gap-0.5">
                <span
                  className={`shrink-0 text-[28px] font-medium tracking-tight sm:text-[36px] ${
                    usdDraft ? "text-white" : "text-[#5e5e5e]"
                  }`}
                >
                  $
                </span>
                <input
                  ref={amountRef}
                  value={usdDraft}
                  onChange={(e) => {
                    const next = sanitizeUsd(e.target.value);
                    setUsdDraft(next);
                    setAmount(tokenAmtFromUsd(next, usdPer));
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-label="Sell amount in USD"
                  className="w-0 min-w-0 flex-1 bg-transparent text-[28px] font-medium tracking-tight text-white outline-none placeholder:text-[#5e5e5e] sm:text-[36px]"
                />
              </label>
            ) : (
              <input
                ref={amountRef}
                value={amount}
                onChange={(e) => setAmount(sanitizeAmt(e.target.value))}
                placeholder="0.00"
                inputMode="decimal"
                aria-label="Sell amount"
                className="w-0 min-w-0 flex-1 bg-transparent text-[28px] font-medium tracking-tight text-white outline-none placeholder:text-[#5e5e5e] sm:text-[36px]"
              />
            )}
            <TokenPill token={sell} onClick={() => setOpenSide("in")} />
          </div>
          <button
            type="button"
            disabled={usdPer <= 0}
            onClick={toggleSellUnit}
            className="mt-1 max-w-full truncate text-left text-[14px] text-[#5e5e5e] hover:text-white/70 disabled:cursor-default disabled:hover:text-[#5e5e5e]"
            aria-label={inUsd ? "Enter amount in tokens" : "Enter amount in USD"}
          >
            {inUsd
              ? amountIn > 0n
                ? `${formatOut(amountIn)} ${sell.symbol}`
                : `0.00 ${sell.symbol}`
              : sellUsd > 0
                ? formatUsd(sellUsd)
                : "$0.00"}
          </button>
        </div>

        <button
          type="button"
          onClick={flip}
          className="absolute top-full left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] border-4 border-[#100f0c] bg-[#1b1b1b] text-white hover:bg-[#222]"
          aria-label="Switch tokens"
        >
          <FlipIcon />
        </button>
      </div>

      <div className="mt-[2px] rounded-[20px] border border-[#ffffff12] bg-[#131313] px-4 pt-[14px] pb-3 transition-colors duration-200 hover:bg-[#1b1b1b]">
        <div className="mb-1 text-[15px] text-[#9b9b9b]">Buy</div>
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 text-[28px] font-medium tracking-tight sm:text-[36px] ${
              amountOut > 0n ? "text-white" : "text-[#5e5e5e]"
            }`}
          >
            {quoting && amountIn > 0n ? "…" : amountOut > 0n ? formatOut(amountOut) : "0.00"}
          </div>
          <TokenPill
            token={buy}
            placeholder="Select token"
            accent={!buy}
            onClick={() => setOpenSide("out")}
          />
        </div>
        {quote && !quote.ok && amountIn > 0n && buy ? (
          <div className="mt-2 text-[13px] text-[#9b9b9b]">
            {quote.reason === "no_pool"
              ? "Cannot swap. This vault has no pool."
              : quote.reason === "no_route"
                ? "No route for this pair."
                : quote.reason === "no_liquidity"
                  ? "Not enough liquidity for this size."
                  : null}
          </div>
        ) : null}
      </div>

      {!TXS_ENABLED ? (
        <ComingSoonCta className="mt-2 flex h-[52px] w-full cursor-not-allowed items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black opacity-35" />
      ) : !isConnected ? (
        <ConnectCta className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black transition-colors hover:bg-[#f2f2f2]" />
      ) : (
        <button
          type="button"
          disabled={!readyToReview || isPending || swapBusy}
          onClick={() => {
            setStatus(null);
            setReview(true);
          }}
          className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black transition-colors hover:bg-[#f2f2f2] disabled:opacity-35"
        >
          {reason}
        </button>
      )}

      {quote?.ok && buy && amountOut > 0n ? (
        <div className="mt-3 flex items-start justify-between gap-3 text-[13px] leading-snug text-white/45">
          <button
            type="button"
            onClick={() => setRateFlip((v) => !v)}
            className="min-w-0 text-left hover:text-white/75"
          >
            {formatQuoteRate(amountIn, amountOut, sell, buy, usdPer, buyUsdPer, rateFlip)}
          </button>
          {gasUsd > 0 ? (
            <span className="shrink-0 tabular-nums text-white/45">{formatUsd(gasUsd)}</span>
          ) : null}
        </div>
      ) : null}

      {(review && buy) || swapDone ? (
        <SwapReview
          sell={swapDone?.sell ?? sell}
          buy={swapDone?.buy ?? buy!}
          amountIn={swapDone?.amountIn ?? amountIn}
          amountOut={swapDone?.amountOut ?? amountOut}
          minOut={minOut}
          sellUsd={swapDone?.sellUsd ?? sellUsd}
          buyUsd={swapDone?.buyUsd ?? buyUsd}
          sellUsdPer={usdPer}
          buyUsdPer={buyUsdPer}
          slipPct={slipPct}
          slipAuto={slipAuto}
          feeLabel={feeLabel}
          gasUsd={gasUsd}
          pending={swapBusy}
          status={status}
          txHash={swapDone?.hash ?? null}
          done={Boolean(swapDone)}
          onClose={closeReview}
          onConfirm={() => void swap()}
        />
      ) : null}

      {openSide ? (
        <TokenModal
          vaults={vaults}
          loading={!vaultsReady}
          onClose={() => setOpenSide(null)}
          onPick={pick}
        />
      ) : null}
    </main>
  );
}

function SettingsCard({
  slipAuto,
  slipRaw,
  deadlineMin,
  onAuto,
  onSlip,
  onDeadline,
}: {
  slipAuto: boolean;
  slipRaw: string;
  deadlineMin: string;
  onAuto: () => void;
  onSlip: (v: string) => void;
  onDeadline: (v: string) => void;
}) {
  return (
    <div className="absolute top-[calc(100%+10px)] right-0 z-30 w-[min(340px,calc(100vw-2rem))] rounded-[20px] border border-white/10 bg-[#1b1b1b] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between gap-3 py-2.5">
        <Hint
          label="Max slippage"
          text="Your swap reverts if the execution price moves more than this."
        />
        <div className="flex items-center gap-1 rounded-full bg-black/35 py-1 pr-3 pl-1">
          <button
            type="button"
            onClick={onAuto}
            className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
              slipAuto ? "text-[#e8c547]" : "text-white/40 hover:text-white"
            }`}
          >
            Auto
          </button>
          <input
            value={slipRaw}
            onChange={(e) => onSlip(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="w-10 bg-transparent text-right text-[14px] text-white outline-none tabular-nums"
          />
          <span className="text-[14px] text-white">%</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 py-2.5">
        <Hint
          label="Swap deadline"
          text="How long the swap can sit in the mempool before it expires."
        />
        <label className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[14px] text-white">
          <input
            value={deadlineMin}
            onChange={(e) => onDeadline(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-8 bg-transparent text-right outline-none tabular-nums"
          />
          minutes
        </label>
      </div>
    </div>
  );
}

function Hint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const hide = useRef(0);

  const show = () => {
    window.clearTimeout(hide.current);
    setOpen(true);
  };
  const later = () => {
    window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => () => window.clearTimeout(hide.current), []);

  return (
    <span className="relative inline-flex max-w-[60%]" onMouseEnter={show} onMouseLeave={later}>
      <button
        type="button"
        onFocus={show}
        onBlur={later}
        className="cursor-help border-b border-dotted border-white/40 pb-px text-left text-[14px] text-white/70"
      >
        {label}
      </button>
      {open ? (
        <>
          <span className="absolute inset-x-0 -top-2.5 h-3" aria-hidden />
          <span
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={later}
            className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[min(260px,70vw)] rounded-[12px] bg-[#2a2a2a] px-3 py-2.5 text-[13px] leading-snug text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
          >
            {text}
            <span className="absolute top-full left-4 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-[#2a2a2a]" />
          </span>
        </>
      ) : null}
    </span>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.4 1.7h3.2l.4 1.5a5 5 0 0 1 1.3.8l1.5-.4 1.6 2.8-1.2 1c.1.4.1.8 0 1.2l1.2 1-1.6 2.8-1.5-.4a5 5 0 0 1-1.3.8l-.4 1.5H6.4l-.4-1.5a5 5 0 0 1-1.3-.8l-1.5.4L1.6 9.5l1.2-1a4 4 0 0 1 0-1.2l-1.2-1 1.6-2.8 1.5.4a5 5 0 0 1 1.3-.8l.4-1.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M5 3.5 3 5.5l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 5.5h8.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 12.5 13 10.5l-2-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.8 10.5H4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
