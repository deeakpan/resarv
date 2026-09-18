"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { HeaderConnect } from "./ConnectButton";
import { SOCIAL } from "@/lib/socials";

const LINKS = [
  { href: "/swap", label: "Trade" },
  { href: "/vaults", label: "NFT Vaults" },
  { href: "#stake", label: "Staking" },
  { href: "#docs", label: "Docs" },
];

const SOCIALS = [
  { href: SOCIAL.x, label: "X", icon: XIcon },
  { href: SOCIAL.telegram, label: "Telegram", icon: TelegramIcon },
  { href: SOCIAL.github, label: "GitHub", icon: GitHubIcon },
];

type Tone = "art" | "light" | "dark";

export default function Header() {
  const [tone, setTone] = useState<Tone>("art");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 12);
      const headerH = 72;
      const swapTop = document.getElementById("trade")?.getBoundingClientRect().top ?? 9999;
      const restTop = document.getElementById("rest-dark")?.getBoundingClientRect().top ?? 9999;
      if (restTop <= headerH || swapTop <= headerH) setTone("dark");
      else setTone("art");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  const onDark = !scrolled || tone !== "light";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter] duration-200 ${
        !scrolled && !menuOpen
          ? "bg-transparent"
          : tone === "light"
            ? "bg-white/90 backdrop-blur-xl"
            : "bg-[#0b0b0b]/70 backdrop-blur-xl"
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:h-[72px] md:gap-6 md:px-10 lg:px-16">
        <a href="/" className="relative z-10 flex shrink-0 items-center" aria-label="Druse home">
          <Image
            src="/wordmark.png"
            alt="Druse"
            width={160}
            height={57}
            sizes="160px"
            className="h-8 w-auto md:h-10"
            priority
          />
        </a>

        <div className="relative z-10 flex min-w-0 items-center gap-4 md:gap-8">
          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-[14px] font-semibold ${
                  onDark
                    ? "text-white/90 transition-colors hover:text-white"
                    : "text-[#3a3a3a] transition-colors hover:text-[#1a1a1a]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-4 sm:flex">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className={`transition-opacity hover:opacity-60 ${
                  onDark ? "text-white" : "text-[#1b1b1b]"
                }`}
              >
                <social.icon />
              </a>
            ))}
          </div>
          <HeaderConnect light={!onDark} />
          <button
            type="button"
            className={`bg-transparent p-0 md:hidden ${onDark ? "text-white" : "text-[#1b1b1b]"}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-[16px] font-semibold ${
                  onDark ? "text-white" : "text-[#1b1b1b]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
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

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.01 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.24 3H21l-6.51 7.44L22 21h-6.17l-4.82-6.3L5.4 21H2.63l6.97-7.97L2 3h6.31l4.36 5.77L18.24 3Zm-1.08 16.2h1.7L6.93 4.7H5.1l12.06 14.5Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.5 3.05 2.9 10.22c-1.27.5-1.26 1.2-.23 1.51l4.77 1.49 1.85 5.7c.23.7.41.97.88.97.45 0 .65-.21 1-.62l2.07-2.13 4.3 3.18c.79.44 1.36.21 1.56-.73l2.83-13.35c.29-1.16-.45-1.69-1.43-1.16Z" />
    </svg>
  );
}
