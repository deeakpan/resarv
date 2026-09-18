"use client";

import { useEffect, useState } from "react";
import type { FloorCollection } from "@/lib/floors";
import Footer from "./Footer";
import Header from "./Header";
import HeroScroll from "./HeroScroll";
import LandingMarkets from "./LandingMarkets";
import LandingStory from "./LandingStory";
import SwapWidget from "./SwapWidget";

export default function HomeClient({ collections: initial }: { collections: FloorCollection[] }) {
  const [collections, setCollections] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/floors", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { collections?: FloorCollection[] }) => {
        if (!cancelled && data.collections?.length) setCollections(data.collections);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    document.documentElement.classList.add("scroll-fx");

    const nodes = document.querySelectorAll(
      ".scroll-rise, .scroll-rise-late, .scroll-in-left, .scroll-in-right, .scroll-scale, .scroll-tile, .scroll-stagger, .swap-arrive",
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -12% 0px" },
    );

    const id = window.requestAnimationFrame(() => {
      nodes.forEach((node) => io.observe(node));
    });

    return () => {
      window.cancelAnimationFrame(id);
      io.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#100f0c]">
      <div className="pointer-events-none fixed inset-0 z-0 night-wash" aria-hidden />
      <Header />
      <div className="relative z-[1]">
        <HeroScroll />

        <div className="relative">
          <section
            id="trade"
            className="scroll-mt-24 flex items-center px-4 py-16 md:sticky md:top-[72px] md:z-[1] md:min-h-[calc(100svh-72px)] md:py-0"
          >
            <div className="swap-arrive relative z-[1] mx-auto w-full max-w-[480px]">
              <div className="mb-7 text-center">
                <h2 className="font-[family-name:var(--font-logo)] text-[28px] font-bold tracking-[-0.03em] text-white md:text-[32px]">
                  Floor, in motion.
                </h2>
                <p className="mx-auto mt-2 max-w-[400px] text-[15px] leading-relaxed text-white/50">
                  Sell, buy, and hop collections at floor.
                </p>
              </div>
              <SwapWidget collections={collections} />
            </div>
          </section>

          <div
            id="rest-dark"
            className="dusk-wash stack-card relative z-[2] overflow-x-clip text-white"
          >
            <LandingStory />
            <LandingMarkets collections={collections} />
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
