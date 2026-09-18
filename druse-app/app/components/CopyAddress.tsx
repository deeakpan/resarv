"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

export default function CopyAddress({
  address,
  children,
  className,
}: {
  address: string;
  children: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span className="group/copy inline-flex max-w-full items-center gap-1.5">
      <span className={className}>{children}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        className={`inline-flex shrink-0 items-center text-[#c6a35a] transition-opacity ${
          copied
            ? "opacity-100"
            : "opacity-0 group-hover/copy:opacity-100 focus-visible:opacity-100"
        }`}
      >
        {copied ? (
          <span className="text-[12px] font-semibold leading-none text-emerald-400">copied!</span>
        ) : (
          <CopyIcon />
        )}
      </button>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 5.5V4.2A1.7 1.7 0 0 0 8.8 2.5H4.2A1.7 1.7 0 0 0 2.5 4.2v4.6A1.7 1.7 0 0 0 4.2 10.5H5.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
