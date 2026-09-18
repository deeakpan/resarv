"use client";

import { useEffect, useState } from "react";

export type ToastMsg = {
  id: number;
  title: string;
};

let seq = 0;
const subs = new Set<(msg: ToastMsg) => void>();

export function toastSuccess(title = "Transaction successful") {
  const msg: ToastMsg = { id: ++seq, title };
  subs.forEach((fn) => fn(msg));
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const on = (msg: ToastMsg) => {
      setItems((cur) => [...cur.slice(-2), msg]);
      window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== msg.id));
      }, 3200);
    };
    subs.add(on);
    return () => {
      subs.delete(on);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--resarv-green)] text-[11px] text-white">
            ✓
          </span>
          {item.title}
        </div>
      ))}
    </div>
  );
}
