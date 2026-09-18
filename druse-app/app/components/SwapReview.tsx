"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import type { SwapToken } from "@/lib/swap";
import { TXS_ENABLED } from "@/lib/features";
import { ComingSoonCta } from "./ConnectButton";

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
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

function formatRate(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 0.00001) return "<0.00001";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toPrecision(4);
}

export function formatQuoteRate(
  amountIn: bigint,
  amountOut: bigint,
  sell: SwapToken,
  buy: SwapToken,
  sellUsdPer: number,
  buyUsdPer: number,
  flip: boolean,
) {
  const inNum = Number(formatUnits(amountIn, 18));
  const outNum = Number(formatUnits(amountOut, 18));
  const buyPerSell = inNum > 0 ? outNum / inNum : 0;
  const sellPerBuy = outNum > 0 ? inNum / outNum : 0;
  const left = flip ? buy : sell;
  const right = flip ? sell : buy;
  const rate = flip ? sellPerBuy : buyPerSell;
  const usd = flip ? buyUsdPer : sellUsdPer;
  const usdBit = usd > 0 ? ` (${formatUsd(usd)})` : "";
  return `1 ${left.symbol} = ${formatRate(rate)} ${right.symbol}${usdBit}`;
}

export default function SwapReview({
  sell,
  buy,
  amountIn,
  amountOut,
  minOut,
  sellUsd,
  buyUsd,
  sellUsdPer,
  buyUsdPer,
  slipPct,
  slipAuto,
  feeLabel,
  gasUsd,
  pending,
  status,
  txHash,
  done,
  onClose,
  onConfirm,
}: {
  sell: SwapToken;
  buy: SwapToken;
  amountIn: bigint;
  amountOut: bigint;
  minOut: bigint;
  sellUsd: number;
  buyUsd: number;
  sellUsdPer: number;
  buyUsdPer: number;
  slipPct: number;
  slipAuto: boolean;
  feeLabel: string;
  gasUsd: number;
  pending: boolean;
  status: string | null;
  txHash: `0x${string}` | null;
  done: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [more, setMore] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [narrow, setNarrow] = useState(true);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const leavingRef = useRef(false);

  const dismiss = () => {
    if (leavingRef.current || pendingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(onClose, 220);
  };

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const id = requestAnimationFrame(() => setReady(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      mq.removeEventListener("change", sync);
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!narrow) return;
    const el = scrollRef.current;
    if (el && el.contains(e.target as Node) && el.scrollTop > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
    else setDragY(0);
  };

  const onTouchEnd = () => {
    if (dragY > 88) dismiss();
    else setDragY(0);
    startY.current = null;
  };

  const open = ready && !leaving;
  const sheetY = narrow ? (open ? Math.max(0, dragY) : 480) : 0;
  const dim = open ? Math.max(0.28, 0.62 - dragY / 520) : 0;
  const slipText = `${slipAuto ? "Auto " : ""}${slipPct.toFixed(2).replace(/\.?0+$/, "")}%`;
  const panelStyle = narrow
    ? {
        transform: `translateY(${sheetY}px)`,
        transition: dragY ? "none" : "transform 220ms ease",
      }
    : {
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 200ms ease, transform 200ms ease",
      };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-5">
      <button
        type="button"
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: dim }}
        onClick={dismiss}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="swap-review-title"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[#1b1b1b] shadow-[0_-16px_60px_rgba(0,0,0,0.45)] md:max-h-[min(720px,84vh)] md:w-[420px] md:rounded-[24px] md:border md:border-white/10 md:shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={panelStyle}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/22" />
        </div>
        <div className="flex items-center justify-between px-5 pt-4 pb-1 md:pt-5">
          <h2 id="swap-review-title" className="text-[20px] font-semibold tracking-[-0.02em] text-white">
            {done ? "Swap successful" : "You're swapping"}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[22px] leading-none text-white/50 hover:bg-white/6 hover:text-white disabled:opacity-35"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-2">
          {done ? (
            <SuccessBody
              sell={sell}
              buy={buy}
              amountIn={amountIn}
              amountOut={amountOut}
              sellUsd={sellUsd}
              buyUsd={buyUsd}
              txHash={txHash}
            />
          ) : (
            <>
              <TokenRow
                amount={formatOut(amountIn)}
                symbol={sell.symbol}
                usd={sellUsd}
                token={sell}
              />
              <div className="flex justify-start py-1 pl-0.5 text-white/35">
                <DownIcon />
              </div>
              <TokenRow
                amount={formatOut(amountOut)}
                symbol={buy.symbol}
                usd={buyUsd}
                token={buy}
              />

              <button
                type="button"
                onClick={() => setMore((v) => !v)}
                className="relative mt-5 mb-1 flex w-full items-center justify-center py-2"
                aria-expanded={more}
              >
                <span className="absolute inset-x-0 top-1/2 border-t border-white/8" />
                <span className="relative flex items-center gap-1.5 bg-[#1b1b1b] px-3 text-[13px] text-white/45">
                  {more ? "Show less" : "Show more"}
                  <Chevron down={!more} />
                </span>
              </button>

              {more ? (
                <div className="flex flex-col gap-3 py-2">
                  <Detail
                    label="Rate"
                    hint="Quoted price for this size, before slippage."
                    value={formatQuoteRate(amountIn, amountOut, sell, buy, sellUsdPer, buyUsdPer, false)}
                  />
                  <Detail label="Fee" hint="Paid to liquidity providers in the pool." value={feeLabel} />
                  <Detail
                    label="Network cost"
                    hint="Estimated gas to land this swap. Actual cost can differ."
                    value={gasUsd > 0 ? formatUsd(gasUsd) : "—"}
                  />
                  <Detail
                    label="Max slippage"
                    hint="Your swap reverts if the execution price moves more than this."
                    value={slipText}
                  />
                  <Detail
                    label="Minimum received"
                    hint="The least you’ll receive if price moves within slippage. Below this the swap reverts."
                    value={`${formatOut(minOut)} ${buy.symbol}`}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3 py-2">
                  <Detail label="Fee" hint="Paid to liquidity providers in the pool." value={feeLabel} />
                  <Detail
                    label="Network cost"
                    hint="Estimated gas to land this swap. Actual cost can differ."
                    value={gasUsd > 0 ? formatUsd(gasUsd) : "—"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-5">
          {!done && !pending && status ? (
            <div className="mb-2 text-center text-[13px] text-[#ff9b9b]">{status}</div>
          ) : null}
          {done ? (
            <button
              type="button"
              onClick={dismiss}
              className="flex h-[52px] w-full items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black transition-colors hover:bg-[#f2f2f2]"
            >
              Close
            </button>
          ) : !TXS_ENABLED ? (
            <ComingSoonCta className="flex h-[52px] w-full cursor-not-allowed items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black opacity-35" />
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="flex h-[52px] w-full items-center justify-center rounded-[16px] bg-white text-[17px] font-semibold tracking-tight text-black transition-colors hover:bg-[#f2f2f2] disabled:opacity-70"
              aria-label={pending ? "Swapping" : "Swap"}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <ButtonSpinner />
                  Swapping...
                </span>
              ) : (
                "Swap"
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SuccessBody({
  sell,
  buy,
  amountIn,
  amountOut,
  sellUsd,
  buyUsd,
  txHash,
}: {
  sell: SwapToken;
  buy: SwapToken;
  amountIn: bigint;
  amountOut: bigint;
  sellUsd: number;
  buyUsd: number;
  txHash: `0x${string}` | null;
}) {
  return (
    <div className="flex flex-col items-center pt-2 pb-4 text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f6a3a]">
        <svg width="26" height="26" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="m3.6 8.2 2.8 2.8 6-6.4"
            stroke="#7dff9a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="text-[15px] text-white/50">You received</div>
      <div className="mt-2 flex items-center justify-center gap-3">
        {buy.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={buy.image} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">
            {buy.symbol.slice(0, 3)}
          </div>
        )}
        <div className="text-[28px] font-medium tracking-tight text-white">
          {formatOut(amountOut)} {buy.symbol}
        </div>
      </div>
      <div className="mt-1 text-[14px] text-white/40">{formatUsd(buyUsd)}</div>
      <div className="mt-4 text-[14px] text-white/45">
        for {formatOut(amountIn)} {sell.symbol}
        {sellUsd > 0 ? ` (${formatUsd(sellUsd)})` : ""}
      </div>
      {txHash ? (
        <a
          href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 text-[13px] font-medium text-[#e8c547] hover:text-[#f0d060]"
        >
          View on explorer
        </a>
      ) : null}
    </div>
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

function TokenRow({
  amount,
  symbol,
  usd,
  token,
}: {
  amount: string;
  symbol: string;
  usd: number;
  token: SwapToken;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-[28px] font-medium tracking-tight text-white">
          {amount} {symbol}
        </div>
        <div className="text-[14px] text-white/40">{formatUsd(usd)}</div>
      </div>
      {token.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">
          {symbol.slice(0, 3)}
        </div>
      )}
    </div>
  );
}

function Detail({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[14px]">
      <InfoHint label={label} text={hint} />
      <div className="max-w-[62%] text-right break-words text-white tabular-nums">{value}</div>
    </div>
  );
}

function InfoHint({ label, text }: { label: string; text: string }) {
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
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={later}>
      <button
        type="button"
        onFocus={show}
        onBlur={later}
        className="cursor-help border-b border-dotted border-white/35 pb-px text-left text-white/55"
      >
        {label}
      </button>
      {open ? (
        <span
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={later}
          className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[min(240px,70vw)] rounded-[12px] bg-[#2a2a2a] px-3 py-2.5 text-[13px] leading-snug text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
        >
          {text}
          <span className="absolute top-full left-4 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-[#2a2a2a]" />
        </span>
      ) : null}
    </span>
  );
}

function Chevron({ down }: { down: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={down ? "" : "rotate-180"}
    >
      <path d="M2 4.2 6 8.2 10 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
