"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "resarv-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[#0a0a0a]/95 px-4 py-4 backdrop-blur-md md:px-6"
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[62ch] font-sans text-[13px] font-medium leading-relaxed text-[#a3a3a3]">
          We use essential cookies for wallet session and app state. See our{" "}
          <Link href="/privacy" className="text-white underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 font-sans text-[13px] font-semibold text-black transition hover:bg-white/90"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
