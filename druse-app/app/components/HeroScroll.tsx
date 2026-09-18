"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SHRINK_BUDGET = 5600;
const PIN_BUDGET = 2600;
const DOT = 22;
const EDGE_GAP = 0;
const TITLE_TOP = 96;
const HANDOFF_CAP = 56;
const DESKTOP_MQ = "(min-width: 768px)";

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type Phase = "shrink" | "pin" | "ready";

function StaticHero() {
  return (
    <section id="hero" className="relative min-h-[100svh]">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/cluster.png?v=4"
          alt=""
          className="h-full w-full object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#100f0c] via-[#100f0c]/55 to-[#100f0c]/25" />
      </div>
      <div className="relative z-[1] flex min-h-[100svh] flex-col justify-end px-5 pt-28 pb-14">
        <h1 className="max-w-[18ch] font-[family-name:var(--font-headline)] text-[36px] leading-[1.02] font-extrabold tracking-[-0.04em] text-white">
          Trade fluid nfts.
        </h1>
        <p className="mt-3 max-w-[34ch] text-[15px] leading-snug font-medium text-white/80">
          Instant sell and floor-to-floor routing, powered by Uniswap v4 hooks.
          Built for Robinhood Chain.
        </p>
        <a
          href="/vaults"
          className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-[#e8c547] px-6 text-[14px] font-semibold tracking-[0.04em] text-[#1b1b1b]"
        >
          Launch App
        </a>
      </div>
    </section>
  );
}

function PinnedHero() {
  const shrinkRef = useRef(0);
  const pathRef = useRef(0);
  const phaseRef = useRef<Phase>("shrink");
  const touchYRef = useRef(0);
  const handoffRef = useRef(false);
  const [shrink, setShrink] = useState(0);
  const [pathT, setPathT] = useState(0);
  const [phase, setPhase] = useState<Phase>("shrink");
  const [view, setView] = useState({ w: 1440, h: 900 });

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const applyPath = useCallback(
    (next: number) => {
      const value = clamp(next);
      pathRef.current = value;
      setPathT(value);

      if (value <= 0) {
        handoffRef.current = false;
        setPhaseSafe("shrink");
        return;
      }

      if (value >= 1) {
        document.body.style.overflow = "";
        handoffRef.current = true;
        setPhaseSafe("ready");
        return;
      }

      handoffRef.current = false;
      document.body.style.overflow = "hidden";
      setPhaseSafe("pin");
    },
    [setPhaseSafe],
  );

  const applyShrink = useCallback(
    (next: number) => {
      const value = clamp(next);
      shrinkRef.current = value;
      setShrink(value);

      if (value < 1) {
        pathRef.current = 0;
        setPathT(0);
        handoffRef.current = false;
        setPhaseSafe("shrink");
        return;
      }

      if (phaseRef.current === "shrink") {
        pathRef.current = 0;
        setPathT(0);
        setPhaseSafe("pin");
      }
    },
    [setPhaseSafe],
  );

  useEffect(() => {
    const measure = () => setView({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);
    shrinkRef.current = 0;
    pathRef.current = 0;
    setShrink(0);
    setPathT(0);
    setPhaseSafe("shrink");
    document.body.style.overflow = "hidden";

    return () => {
      html.style.scrollBehavior = prevBehavior;
      document.body.style.overflow = "";
    };
  }, [setPhaseSafe]);

  useEffect(() => {
    if (phase !== "ready") {
      document.body.style.overflow = "hidden";
      window.scrollTo(0, 0);
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
  }, [phase]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const current = phaseRef.current;

      if (current === "shrink") {
        e.preventDefault();
        const raw = shrinkRef.current + e.deltaY / SHRINK_BUDGET;
        if (raw >= 1) {
          applyShrink(1);
          const extra = ((raw - 1) * SHRINK_BUDGET) / PIN_BUDGET;
          if (extra > 0) applyPath(extra);
        } else {
          applyShrink(raw);
        }
        return;
      }

      if (current === "pin") {
        e.preventDefault();
        const raw = pathRef.current + e.deltaY / PIN_BUDGET;
        if (raw <= 0) {
          applyPath(0);
          applyShrink(1 + (raw * PIN_BUDGET) / SHRINK_BUDGET);
        } else {
          applyPath(raw);
        }
        return;
      }

      if (window.scrollY <= 0 && e.deltaY < 0) {
        e.preventDefault();
        applyPath(1 + e.deltaY / PIN_BUDGET);
        return;
      }

      if (handoffRef.current && e.deltaY > 0) {
        e.preventDefault();
        window.scrollBy(0, Math.min(e.deltaY, HANDOFF_CAP));
        if (window.scrollY > 96) handoffRef.current = false;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchYRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? touchYRef.current;
      const dy = (touchYRef.current - y) * 1.15;
      touchYRef.current = y;
      const current = phaseRef.current;

      if (current === "shrink") {
        e.preventDefault();
        const raw = shrinkRef.current + dy / SHRINK_BUDGET;
        if (raw >= 1) {
          applyShrink(1);
          const extra = ((raw - 1) * SHRINK_BUDGET) / PIN_BUDGET;
          if (extra > 0) applyPath(extra);
        } else {
          applyShrink(raw);
        }
        return;
      }

      if (current === "pin") {
        e.preventDefault();
        const raw = pathRef.current + dy / PIN_BUDGET;
        if (raw <= 0) {
          applyPath(0);
          applyShrink(1 + (raw * PIN_BUDGET) / SHRINK_BUDGET);
        } else {
          applyPath(raw);
        }
        return;
      }

      if (window.scrollY <= 0 && dy < 0) {
        e.preventDefault();
        applyPath(1 + dy / PIN_BUDGET);
        return;
      }

      if (handoffRef.current && dy > 0) {
        e.preventDefault();
        window.scrollBy(0, Math.min(dy, HANDOFF_CAP));
        if (window.scrollY > 96) handoffRef.current = false;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const current = phaseRef.current;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
      const up = e.key === "ArrowUp" || e.key === "PageUp";
      if (!down && !up) return;
      const delta = down ? 80 : -80;

      if (current === "shrink") {
        e.preventDefault();
        const raw = shrinkRef.current + delta / SHRINK_BUDGET;
        if (raw >= 1) {
          applyShrink(1);
          const extra = ((raw - 1) * SHRINK_BUDGET) / PIN_BUDGET;
          if (extra > 0) applyPath(extra);
        } else {
          applyShrink(raw);
        }
        return;
      }

      if (current === "pin") {
        e.preventDefault();
        const raw = pathRef.current + delta / PIN_BUDGET;
        if (raw <= 0) {
          applyPath(0);
          applyShrink(1 + (raw * PIN_BUDGET) / SHRINK_BUDGET);
        } else {
          applyPath(raw);
        }
        return;
      }

      if (up && window.scrollY <= 0) {
        e.preventDefault();
        applyPath(1 + delta / PIN_BUDGET);
        return;
      }

      if (handoffRef.current && down) {
        e.preventDefault();
        window.scrollBy(0, 80);
        if (window.scrollY > 96) handoffRef.current = false;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [applyPath, applyShrink]);

  const pinFrom = view.h / 2 - DOT / 2;
  const pinTo = view.h - DOT - EDGE_GAP;
  const pinLen = Math.max(1, pinTo - pinFrom);
  const squareTop = pinFrom + pathT * pinLen;
  const squareCenter = squareTop + DOT / 2;
  const lineTop = pinFrom + DOT;
  const lineH = Math.max(1, pinTo - lineTop);

  const panelW = lerp(view.w, DOT, shrink);
  const panelH = lerp(view.h, DOT, shrink);
  const goldMix = shrink;
  const contentY = lerp(0, -140, shrink);
  const contentOp = lerp(1, 0, clamp(shrink * 1.35));
  const artOp = lerp(1, 0, clamp(shrink * 1.15));
  const pathOp = clamp((shrink - 0.72) / 0.28);
  const titleOp = clamp((shrink - 0.78) / 0.18);
  const titleTop = lerp(view.h / 2 - 92, TITLE_TOP, clamp((shrink - 0.55) / 0.45));

  return (
    <div id="hero" className="relative h-[100dvh]">
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 z-[1] w-px -translate-x-1/2"
          style={{
            top: `${lineTop}px`,
            height: `${lineH}px`,
            opacity: pathOp,
          }}
          aria-hidden
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.22) 0 4px, transparent 4px 10px)",
            }}
          />
          <div
            className="absolute top-0 left-0 h-full w-full bg-[#e8c547]"
            style={{
              height: `${pathT * 100}%`,
              maxHeight: "100%",
              boxShadow: "0 0 8px rgba(232, 197, 71, 0.4)",
            }}
          />
        </div>

        <div
          className="hero-scroll-panel absolute left-1/2 z-[2] overflow-hidden will-change-[width,height,top]"
          style={{
            top: `${squareCenter}px`,
            width: `${panelW}px`,
            height: `${panelH}px`,
            borderRadius: 0,
            transform: "translate(-50%, -50%)",
            background:
              goldMix > 0.02
                ? `linear-gradient(160deg, #f0d060 0%, #e8c547 45%, #c6a35a 100%)`
                : undefined,
            boxShadow:
              goldMix > 0.55
                ? `0 0 ${lerp(0, 16, goldMix)}px rgba(232, 197, 71, ${0.28 * goldMix})`
                : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/cluster.png?v=4"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_bottom]"
            style={{ opacity: artOp }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: artOp,
              background:
                "linear-gradient(90deg, rgba(42,14,16,0.35) 0%, rgba(42,14,16,0.1) 26%, transparent 48%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: goldMix,
              background:
                "linear-gradient(160deg, #f0d060 0%, #e8c547 45%, #c6a35a 100%)",
            }}
          />
        </div>

        {contentOp > 0.02 && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[3] mx-auto flex h-screen max-w-[1240px] items-center px-6 pt-[96px] pb-16 md:px-12 lg:px-16"
            style={{
              transform: `translate3d(0, ${contentY}px, 0)`,
              opacity: contentOp,
            }}
          >
            <div className="pointer-events-auto max-w-[420px]">
              <h1 className="font-[family-name:var(--font-headline)] text-[32px] leading-[1.02] font-extrabold tracking-[-0.04em] text-white md:text-[44px]">
                Trade fluid nfts.
              </h1>
              <p className="mt-3 max-w-[340px] text-[14px] leading-snug font-medium text-white md:text-[16px]">
                Instant sell and floor-to-floor routing, powered by Uniswap v4
                hooks. Built for Robinhood Chain.
              </p>
              <a
                href="/vaults"
                className="mt-8 inline-flex h-9 items-center rounded-full bg-[#e8c547] px-5 text-[13px] font-semibold tracking-[0.04em] text-[#1b1b1b] transition-colors hover:bg-[#f0d060]"
              >
                Launch App
              </a>
            </div>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 z-[3] px-6 text-center"
          style={{
            top: `${titleTop}px`,
            opacity: titleOp,
          }}
        >
          <h2 className="mx-auto max-w-[720px] font-[family-name:var(--font-headline)] text-[26px] leading-[1.1] font-extrabold tracking-[-0.04em] text-white md:text-[40px]">
            The liquidity layer for NFTs.
          </h2>
        </div>
      </div>
    </div>
  );
}

export default function HeroScroll() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => {
      setDesktop(mq.matches);
      if (!mq.matches) document.body.style.overflow = "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, []);

  if (!desktop) return <StaticHero />;
  return <PinnedHero />;
}
