"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderConnect } from "./ConnectButton";
import MobileNavSheet from "./MobileNavSheet";

const LINKS = [
  { href: "/vaults", label: "Vaults" },
  { href: "/swap", label: "Trade" },
  { href: "/pools", label: "Pools" },
  { href: "/positions", label: "Positions" },
  { href: "/stake", label: "Stake" },
];

function linkOn(path: string, href: string) {
  if (path === href) return true;
  if (href === "/vaults" && path.startsWith("/vaults/")) return true;
  if (href === "/swap" && path.startsWith("/swap")) return true;
  if (href === "/pools" && path.startsWith("/pools")) return true;
  if (href === "/positions" && path.startsWith("/positions")) return true;
  return false;
}

export default function AppHeader() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  const cool = path.startsWith("/pools/new") || path.startsWith("/stake");

  return (
    <header
      className={`sticky top-0 ${menuOpen ? "z-[80]" : "z-50"} ${
        cool ? "bg-[#131313]" : "bg-[#100f0c]/70 backdrop-blur-xl"
      }`}
    >
      <div
        className={`flex h-16 items-center justify-between gap-3 md:h-[72px] md:gap-4 ${
          cool ? "mx-auto w-full max-w-[1040px] px-4 md:px-8" : "px-4 md:px-10 lg:px-16"
        }`}
      >
        <Link href="/" className="relative z-10 shrink-0" aria-label="Druse home">
          <Image
            src="/wordmark.png"
            alt="Druse"
            width={160}
            height={57}
            sizes="160px"
            className="h-8 w-auto md:h-10"
            priority
          />
        </Link>
        <div className="flex min-w-0 items-center gap-2.5 md:gap-8">
          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => {
              const on = linkOn(path, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[14px] font-semibold ${
                    on ? "text-white" : "text-white/55 transition-colors hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <HeaderConnect />
          <button
            type="button"
          className="relative z-[70] bg-transparent p-0 text-white md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen ? <MobileNavSheet path={path} onClose={() => setMenuOpen(false)} /> : null}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
