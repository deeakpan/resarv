"use client";

import type { FloorCollection } from "@/lib/floors";

const SPOTS: {
  wrap: string;
  reverse: boolean;
  rotate: number;
  size: string;
}[] = [
  {
    wrap: "left-[2%] top-[14%] sm:left-[5%] sm:top-[16%]",
    reverse: false,
    rotate: -14,
    size: "h-[56px] w-[56px] sm:h-[68px] sm:w-[68px]",
  },
  {
    wrap: "right-[2%] top-[12%] sm:right-[5%] sm:top-[14%]",
    reverse: true,
    rotate: 12,
    size: "h-[48px] w-[48px] sm:h-[58px] sm:w-[58px]",
  },
  {
    wrap: "bottom-[14%] left-[3%] sm:bottom-[16%] sm:left-[6%]",
    reverse: false,
    rotate: 16,
    size: "h-[54px] w-[54px] sm:h-[64px] sm:w-[64px]",
  },
  {
    wrap: "bottom-[10%] right-[3%] sm:bottom-[12%] sm:right-[6%]",
    reverse: true,
    rotate: -8,
    size: "h-[46px] w-[46px] sm:h-[56px] sm:w-[56px]",
  },
];

const ORB_IDS = [
  "pyopyopyopyo",
  "cash-cats",
  "robinhood-punks",
  "stonkbrokers",
];

function Triangle({ up }: { up: boolean }) {
  return (
    <svg width="9" height="7" viewBox="0 0 10 8" aria-hidden>
      {up ? (
        <path d="M5 0.5 9.5 7.5H0.5Z" fill="#9ca3af" />
      ) : (
        <path d="M5 7.5 0.5 0.5h9Z" fill="#FF5000" />
      )}
    </svg>
  );
}

export default function NftOrbs({
  collections,
}: {
  collections: FloorCollection[];
}) {
  const byId = new Map(collections.map((c) => [c.id, c]));
  const orbs = ORB_IDS.map((id) => byId.get(id)).filter(
    (c): c is FloorCollection => Boolean(c),
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b0b0b]" />
      <div className="noise pointer-events-none absolute inset-0 opacity-[0.08]" />
      {orbs.map((c, i) => {
        const spot = SPOTS[i];
        if (!spot) return null;
        const up = (c.change24h ?? 0) >= 0;
        const src = c.art || c.image;
        return (
          <div
            key={c.id}
            className={`group pointer-events-auto absolute z-[1] flex items-center gap-3 ${
              spot.reverse ? "flex-row-reverse" : ""
            } ${spot.wrap}`}
          >
            <div className={`relative ${spot.size}`}>
              <div className="pointer-events-none absolute -inset-[6px] rounded-full border border-white/15 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div
                className="orb-tilt absolute inset-0 transition-transform duration-300 ease-out"
                style={{ ["--tilt" as string]: `${spot.rotate}deg` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full rounded-full object-cover opacity-40 blur-[10px] transition-opacity duration-200 group-hover:opacity-0"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="absolute inset-0 h-full w-full rounded-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-90"
                />
              </div>
            </div>
            <div
              className={`pointer-events-none shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
                spot.reverse ? "text-right" : "text-left"
              }`}
            >
              <div
                className="text-[15px] font-semibold leading-none tracking-tight"
                style={{ color: up ? "#7dd3fc" : "#f87171" }}
              >
                {c.symbol}
              </div>
              <div
                className={`mt-1.5 flex items-center gap-1 text-[12px] font-medium text-white ${
                  spot.reverse ? "justify-end" : ""
                }`}
              >
                <Triangle up={up} />
                {c.change24h == null ? "—" : `${Math.abs(c.change24h).toFixed(2)}%`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
