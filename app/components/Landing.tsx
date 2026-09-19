"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Footer from "@/app/components/Footer";

const SIDE_NAV = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/positions", label: "Positions" },
  { href: "/risky-troves", label: "Risky Troves" },
] as const;

const STACKED_NFTS = [
  "/landing/nfts/ref/stonk.png",
  "/landing/nfts/ref/pyo.png",
  "/landing/nfts/ref/cats.png",
  "/landing/nfts/ref/punks.png",
] as const;

const SCENES = [
  {
    id: "borrow",
    phone: "/landing-phone.png",
    phoneAlt: "Borrow rUSD against NFT collateral",
    eyebrow: "The immutable and decentralized way to",
    title: "borrow against your NFTs",
    body: "Mint rUSD against floor price and rarity, and earn protocol fees with RSRV any hour of any day.",
    nav: "Borrow",
    showNftStack: true,
    showStableStack: false,
  },
  {
    id: "stake",
    phone: "/landing-phone-stake.png",
    phoneAlt: "Stake RSRV and earn protocol fees",
    eyebrow: null,
    title: "Share protocol fees with stakers.",
    body: "Stake RSRV to earn a cut of borrow fees. Claim in rUSD whenever you’re ready, same hour, same day.",
    nav: "Stake",
    showNftStack: false,
    showStableStack: false,
  },
  {
    id: "stability",
    phone: "/landing-phone-usdg-swap.png",
    phoneAlt: "Uniswap-style USDG to rUSD swap",
    eyebrow: "Extra USDG lying around?",
    title: "Swap it for rUSD",
    body: "Route USDG into rUSD on our Uniswap V4 pools, deposit in the Stability Pool, back liquidations, and earn protocol fees.",
    nav: "Stability",
    showNftStack: false,
    showStableStack: true,
  },
] as const;

const FAQS = [
  {
    q: "What is Resarv?",
    a: "Resarv is an NFT CDP on Robinhood Chain. Deposit eligible NFTs as collateral, mint rUSD, stake RSRV for fees, and use the Stability Pool to back liquidations.",
  },
  {
    q: "How is my borrow limit calculated?",
    a: "Borrowing is based on NFT floor price and rarity, with a maximum LTV around 40%. Liquidation risk rises as your LTV approaches the protocol threshold.",
  },
  {
    q: "What happens if I’m liquidated?",
    a: "If your trove becomes undercollateralized, liquidators (and the Stability Pool) can repay debt and seize collateral. Keep an eye on Positions and Risky Troves.",
  },
  {
    q: "What is the Stability Pool?",
    a: "Deposit rUSD to absorb liquidations and earn a share of protocol fees. You can route USDG into rUSD via our Uniswap V4 pools before depositing.",
  },
  {
    q: "How do stakers earn?",
    a: "Stake RSRV to receive a cut of borrow fees, claimable in rUSD whenever you’re ready.",
  },
] as const;

function NftStack({ dimmed }: { dimmed?: boolean }) {
  return (
    <span
      className={`ml-2.5 inline-flex items-center align-middle ${
        dimmed ? "opacity-35" : ""
      }`}
      aria-hidden
    >
      {STACKED_NFTS.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="relative size-[0.72em] rounded-full border-2 border-black object-cover"
          style={{ marginLeft: i === 0 ? 0 : "-0.28em", zIndex: STACKED_NFTS.length - i }}
        />
      ))}
    </span>
  );
}

function StableStack({ dimmed }: { dimmed?: boolean }) {
  return (
    <span
      className={`ml-2.5 inline-flex items-center align-middle ${
        dimmed ? "opacity-35" : ""
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/usdg.png"
        alt="USDG"
        className="relative size-[0.72em] rounded-full border-2 border-black object-cover"
        style={{ zIndex: 2 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rusd.png"
        alt="rUSD"
        className="relative size-[0.72em] rounded-full border-2 border-black object-cover"
        style={{ marginLeft: "-0.28em", zIndex: 1 }}
      />
    </span>
  );
}

function PhoneStage({
  active,
  className,
}: {
  active: number;
  className?: string;
}) {
  return (
    <div className={`landing-phone relative w-full ${className ?? ""}`}>
      <Image
        src={SCENES[0].phone}
        alt=""
        width={920}
        height={1220}
        priority
        aria-hidden
        className="h-auto w-full opacity-0"
      />
      {SCENES.map((scene, i) => (
        <Image
          key={scene.id}
          src={scene.phone}
          alt={scene.phoneAlt}
          width={920}
          height={1220}
          priority
          className={`absolute inset-0 h-full w-full object-contain drop-shadow-[0_50px_100px_rgba(0,0,0,0.8)] transition-opacity duration-500 ease-out ${
            active === i
              ? "z-10 opacity-100"
              : "pointer-events-none z-0 opacity-0"
          }`}
        />
      ))}
    </div>
  );
}

function SceneCopy({
  scene,
  i,
  active,
  showCta,
  alwaysBright,
}: {
  scene: (typeof SCENES)[number];
  i: number;
  active?: number;
  showCta?: boolean;
  alwaysBright?: boolean;
}) {
  const on = alwaysBright || active === i;
  return (
    <div className={alwaysBright ? "w-full" : undefined}>
      {scene.eyebrow ? (
        <p
          className={`max-w-[24ch] font-sans font-extrabold leading-[1.15] tracking-[-0.025em] transition-colors duration-300 ${
            alwaysBright
              ? "text-[clamp(1.55rem,6vw,2rem)] text-white"
              : `text-[clamp(1.55rem,2.6vw,2.15rem)] ${on ? "text-white" : "text-[#3a3a3a]"}`
          }`}
        >
          {scene.eyebrow}
        </p>
      ) : null}
      <h2
        className={`mt-1 flex max-w-[20ch] flex-wrap items-center gap-y-1 font-sans font-extrabold leading-[1.15] tracking-[-0.025em] transition-colors duration-300 ${
          alwaysBright
            ? "text-[clamp(1.55rem,6vw,2rem)] text-white"
            : `text-[clamp(1.55rem,2.6vw,2.15rem)] ${on ? "text-white" : "text-[#3a3a3a]"}`
        }`}
      >
        <span>{scene.title}</span>
        {scene.showNftStack ? <NftStack dimmed={!alwaysBright && !on} /> : null}
        {scene.showStableStack ? (
          <StableStack dimmed={!alwaysBright && !on} />
        ) : null}
      </h2>
      <p
        className={`mt-4 max-w-[34ch] font-sans font-medium leading-[1.45] tracking-[-0.01em] transition-colors duration-300 ${
          alwaysBright
            ? "text-[1rem] text-[#888]"
            : `text-[clamp(0.95rem,1.35vw,1.125rem)] ${on ? "text-[#888]" : "text-[#333]"}`
        }`}
      >
        {scene.body}
      </p>
      {showCta ? (
        <Link
          href="/dashboard"
          className={`mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 font-sans text-[14px] font-semibold transition-opacity duration-300 ${
            alwaysBright || on
              ? "bg-white text-black opacity-100 hover:bg-white/90"
              : "pointer-events-none bg-white text-black opacity-20"
          }`}
        >
          Launch app
        </Link>
      ) : null}
    </div>
  );
}

function FaqSection({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className={`relative z-10 w-full py-16 md:py-28 ${className}`}>
      <h2 className="font-sans text-[clamp(1.55rem,2.6vw,2.15rem)] font-extrabold tracking-[-0.025em] text-white">
        FAQ
      </h2>
      <p className="mt-3 max-w-[40ch] font-sans text-[15px] font-medium text-[#888]">
        Quick answers about borrowing, staking, and the Stability Pool.
      </p>
      <ul className="mt-10 w-full max-w-[560px]">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-sans text-[15px] font-semibold text-white md:text-[16px]">
                  {item.q}
                </span>
                <span
                  className={`shrink-0 font-sans text-[22px] font-medium text-[#6b6b6b] transition-transform ${
                    isOpen ? "rotate-45" : ""
                  }`}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {isOpen ? (
                <p className="pb-5 font-sans text-[14px] font-medium leading-relaxed text-[#888] md:text-[15px]">
                  {item.a}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-[14px] w-[22px]" aria-hidden>
      <span
        className={`absolute left-0 h-[2.5px] rounded-full bg-white transition-all duration-200 ${
          open ? "top-[6px] w-[22px] rotate-45" : "top-0 w-[22px]"
        }`}
      />
      <span
        className={`absolute left-0 h-[2.5px] rounded-full bg-white transition-all duration-200 ${
          open ? "top-[6px] w-[22px] -rotate-45" : "top-[9px] w-[14px]"
        }`}
      />
    </span>
  );
}

export default function Landing() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(0);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      if (window.matchMedia("(max-width: 767px)").matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = window.innerHeight * 0.45;
        let best = 0;
        let bestDist = Number.POSITIVE_INFINITY;

        panelRefs.current.forEach((section, i) => {
          if (!section) return;
          const rect = section.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const dist = Math.abs(center - mid);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });

        setActive((prev) => (prev === best ? prev : best));
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollToScene = (index: number) => {
    setActive(index);
    panelRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="landing relative bg-black pb-20 text-white md:pb-0">
      <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-30 mx-auto flex w-full max-w-[1400px] items-center justify-between px-5 pt-5 md:px-8 md:pt-6">
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center p-0"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon open={menuOpen} />
        </button>

        <Link href="/" className="flex items-center justify-center">
          <Image
            src="/wordmark.png"
            alt="Resarv"
            width={280}
            height={48}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>

        <Link
          href="/dashboard"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] px-4 font-sans text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.12]"
        >
          Launch
        </Link>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-20 bg-black px-6 pb-10 pt-20 md:hidden">
          <nav className="flex flex-col gap-5">
            {SIDE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`font-sans text-[28px] font-semibold ${
                  pathname === item.href ? "text-white" : "text-[#8a8a8a]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {/* Mobile: text then phone; normal scroll */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-16 px-5 pb-28 pt-8 md:hidden">
        {SCENES.map((scene, i) => (
          <section key={scene.id} className="flex flex-col">
            <SceneCopy scene={scene} i={i} showCta={i === 0} alwaysBright />
            <div className="landing-phone mx-auto mt-10 w-full max-w-[300px]">
              <Image
                src={scene.phone}
                alt={scene.phoneAlt}
                width={920}
                height={1220}
                priority={i === 0}
                className="h-auto w-full object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
              />
            </div>
          </section>
        ))}
        <FaqSection />
      </div>

      {/* Desktop: sticky phone only through scenes; FAQ releases it */}
      <main className="relative z-10 mx-auto hidden w-full max-w-[1400px] md:block">
        <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_auto] items-stretch gap-6 px-8">
          <div className="relative min-h-0">
            <div className="sticky top-0 flex h-svh items-center justify-center pt-16">
              <PhoneStage
                active={active}
                className="w-full max-w-[420px] lg:max-w-[460px]"
              />
            </div>
          </div>

          <div className="flex flex-col pl-2 lg:pl-6">
            {SCENES.map((scene, i) => (
              <section
                key={scene.id}
                data-index={i}
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
                className="flex min-h-svh flex-col justify-center py-24"
              >
                <SceneCopy
                  scene={scene}
                  i={i}
                  active={active}
                  showCta={i === 0}
                />
              </section>
            ))}
          </div>

          <aside className="relative hidden min-h-0 lg:block">
            <div className="sticky top-0 flex h-svh flex-col justify-center gap-4 pr-1">
              {SCENES.map((scene, i) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => scrollToScene(i)}
                  className={`text-left font-sans text-[15px] font-semibold transition-colors ${
                    active === i ? "text-white" : "text-[#6b6b6b] hover:text-white"
                  }`}
                >
                  {scene.nav}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  document.getElementById("faq")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                className="text-left font-sans text-[15px] font-semibold text-[#6b6b6b] transition-colors hover:text-white"
              >
                FAQ
              </button>
              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
                {SIDE_NAV.filter((n) => n.href !== "/").map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="font-sans text-[14px] font-semibold text-[#6b6b6b] transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* FAQ inset from edge, pulled toward center under phone + copy */}
        <div className="px-8 pb-4">
          <div className="mx-auto w-full max-w-[640px] md:ml-[22%] md:mr-auto lg:ml-[24%]">
            <FaqSection />
          </div>
        </div>
      </main>

      <Footer />

      {!menuOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md md:hidden">
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white font-sans text-[15px] font-semibold text-black transition hover:bg-white/90"
          >
            Launch app
          </Link>
        </div>
      ) : null}
    </div>
  );
}
