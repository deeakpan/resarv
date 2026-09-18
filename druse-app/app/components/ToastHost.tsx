"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ToastKind = "success" | "error";

export type ToastMsg = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
};

let seq = 0;
const subs = new Set<(msg: ToastMsg) => void>();

export function toast(kind: ToastKind, title: string, extra?: Omit<ToastMsg, "id" | "kind" | "title">) {
  const msg: ToastMsg = { id: ++seq, kind, title, ...extra };
  subs.forEach((fn) => fn(msg));
}

export function toastSuccess(title: string, extra?: Omit<ToastMsg, "id" | "kind" | "title">) {
  toast("success", title, extra);
}

export function toastError(title: string, extra?: Omit<ToastMsg, "id" | "kind" | "title">) {
  toast("error", title, extra);
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const on = (msg: ToastMsg) => {
      setItems((cur) => [...cur.slice(-2), msg]);
      window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== msg.id));
      }, 5600);
    };
    subs.add(on);
    return () => {
      subs.delete(on);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 left-4 z-[100] flex flex-col items-stretch gap-2 sm:top-auto sm:bottom-6 sm:left-auto sm:w-[380px]">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1a1916] px-4 py-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          role="status"
        >
          {item.kind === "success" ? <SuccessMark /> : <ErrorMark />}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">{item.title}</div>
            {item.detail ? (
              <div className="mt-0.5 text-[13px] leading-snug text-white/55">{item.detail}</div>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="mt-1.5 inline-block text-[13px] font-semibold text-[#e8c547] hover:text-[#f0d060]"
              >
                {item.hrefLabel ?? "View"}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setItems((cur) => cur.filter((x) => x.id !== item.id))}
            className="shrink-0 text-[18px] leading-none text-white/35 hover:text-white"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function SuccessMark() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f6a3a]">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="m3.6 8.2 2.8 2.8 6-6.4"
          stroke="#7dff9a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ErrorMark() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6a1f1f]">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M5 5l6 6M11 5 5 11" stroke="#ff9b9b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
