"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ConnectButton from "@/app/components/ConnectButton";
import { pretty } from "@/lib/format";
import { useProtocol } from "@/lib/protocol";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/positions", label: "Positions" },
  { href: "/risky-troves", label: "Risky Troves" },
] as const;

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-[14px] w-[22px]" aria-hidden>
      <span
        className={`absolute left-0 h-[2.5px] rounded-full bg-white transition-all duration-200 ${
          open
            ? "top-[6px] w-[22px] translate-y-0 rotate-45"
            : "top-0 w-[22px]"
        }`}
      />
      <span
        className={`absolute left-0 h-[2.5px] rounded-full bg-white transition-all duration-200 ${
          open
            ? "top-[6px] w-[22px] -rotate-45"
            : "top-[9px] w-[14px]"
        }`}
      />
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { ethBalance, rusdBalance, rsrvBalance, address, deployed } =
    useProtocol();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const linkClass = (href: string, mobile = false) => {
    const active =
      pathname === href || pathname.startsWith(`${href}/`);
    if (mobile) {
      return active
        ? "block text-[28px] font-medium text-white"
        : "block text-[28px] font-medium text-[#8a8a8a]";
    }
    return active
      ? "text-white"
      : "text-[#8a8a8a] hover:text-white";
  };

  return (
    <header className="relative z-40 border-b border-white/10 bg-[var(--background)]">
      <div className="flex items-center gap-3 px-4 py-3 md:gap-4 md:px-8">
        <button
          type="button"
          className="inline-flex items-center justify-center p-0 md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon open={menuOpen} />
        </button>

        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/wordmark.png"
            alt="Resarv"
            width={180}
            height={32}
            className="h-8"
            style={{ width: "auto", height: 32 }}
            priority
          />
        </Link>

        <nav className="hidden flex-1 items-center gap-5 text-[15px] font-bold md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {address ? (
            <div className="hidden items-center gap-4 sm:flex">
              {(
                [
                  ["ETH", ethBalance ?? 0n, 4, undefined],
                  [
                    "rUSD",
                    deployed ? (rusdBalance ?? 0n) : undefined,
                    2,
                    "/rusd.png",
                  ],
                  [
                    "RSRV",
                    deployed ? (rsrvBalance ?? 0n) : undefined,
                    2,
                    "/logo.png",
                  ],
                ] as const
              ).map(([label, value, digits, icon]) => (
                <div key={label} className="flex flex-col">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#8a8a8a]">
                    {icon ? (
                      <Image
                        src={icon}
                        alt={label}
                        width={12}
                        height={12}
                        className="h-3 w-3 rounded-full object-cover"
                      />
                    ) : null}
                    {label}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-white">
                    {pretty(value, digits)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <ConnectButton />
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 top-[57px] z-30 bg-[var(--background)] px-5 pb-10 pt-6 md:hidden">
          <nav className="flex flex-col gap-5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(item.href, true)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
