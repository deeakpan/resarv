"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { SOCIAL } from "@/lib/socials";

const APP_LINKS = [
  { href: "/swap", label: "Trade", icon: TradeIcon },
  { href: "/vaults", label: "Vaults", icon: ExploreIcon },
  { href: "/stake", label: "Stake", icon: LaunchIcon },
  { href: "/pools", label: "Pools", icon: PoolIcon },
  { href: "/positions", label: "Positions", icon: PortfolioIcon },
] as const;

const GROUPS = [
  {
    title: "Protocol",
    links: [
      { label: "Vaults", href: "/vaults" },
      { label: "Uniswap v4", href: "https://docs.uniswap.org/contracts/v4/overview" },
      { label: "Hooks", href: "https://docs.uniswap.org/contracts/v4/concepts/hooks" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Brand", href: "/#docs" },
      { label: "GitHub", href: SOCIAL.github },
    ],
  },
] as const;

function isOn(path: string, href: string) {
  if (path === href) return true;
  if (href !== "/" && path.startsWith(href)) return true;
  return false;
}

export default function MobileNavSheet({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const id = requestAnimationFrame(() => setOpen(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
        aria-label="Close menu"
      />
      <nav
        className="absolute inset-x-0 bottom-0 flex max-h-[min(92dvh,720px)] w-full flex-col rounded-t-[28px] bg-[#111] shadow-[0_-18px_60px_rgba(0,0,0,0.45)]"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/22" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="pt-4 text-[13px] font-semibold text-white/40">App</div>
          <ul className="mt-3 flex flex-col gap-1">
            {APP_LINKS.map((link) => {
              const on = isOn(path, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`flex items-center gap-3.5 rounded-2xl py-2.5 pr-2 ${
                      on ? "text-white" : "text-white/90"
                    }`}
                  >
                    <link.icon />
                    <span className="text-[22px] font-semibold tracking-[-0.03em]">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-col gap-1">
            {GROUPS.map((g) => (
              <Accordion
                key={g.title}
                title={g.title}
                open={group === g.title}
                onToggle={() => setGroup((v) => (v === g.title ? null : g.title))}
              >
                {g.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={onClose}
                    className="block py-2 text-[16px] text-white/55 hover:text-white"
                    {...(link.href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {link.label}
                  </a>
                ))}
              </Accordion>
            ))}
          </div>

          <div className="mt-5 border-t border-white/8 pt-2">
            <Accordion
              title="Legal & Privacy"
              open={group === "legal"}
              onToggle={() => setGroup((v) => (v === "legal" ? null : "legal"))}
            >
              <a href="/#docs" onClick={onClose} className="block py-2 text-[16px] text-white/55">
                Terms
              </a>
              <a href="/#docs" onClick={onClose} className="block py-2 text-[16px] text-white/55">
                Privacy
              </a>
            </Accordion>
            <div className="mt-4 flex items-center justify-between pb-3 text-white/70">
              <a href="/#docs" onClick={onClose} aria-label="Help" className="hover:text-white">
                <HelpIcon />
              </a>
              <div className="flex items-center gap-5">
                <a
                  href={SOCIAL.github}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  aria-label="GitHub"
                  className="hover:text-white"
                >
                  <GitHubIcon />
                </a>
                <a
                  href={SOCIAL.x}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  aria-label="X"
                  className="hover:text-white"
                >
                  <XIcon />
                </a>
                <a
                  href={SOCIAL.telegram}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  aria-label="Telegram"
                  className="hover:text-white"
                >
                  <TelegramIcon />
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>,
    document.body,
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left text-[18px] font-medium tracking-[-0.02em] text-white"
      >
        {title}
        <span className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>
          <Chevron />
        </span>
      </button>
      {open ? <div className="pb-2 pl-0.5">{children}</div> : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 4.2 6 8l4-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M8.2 6.8 5 10l3.2 3.2M5.4 10h13.4M19.8 21.2 23 18l-3.2-3.2M22.6 18H9.2"
        stroke="#e8c547"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="9.2" stroke="#e8c547" strokeWidth="2.1" />
      <path d="m11.2 16.8 1.4-5.6 5.6-1.4-1.4 5.6-5.6 1.4Z" fill="#e8c547" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14.2 5.2c3.4 1.2 6.6 4.4 7.6 7.8-2.2.2-4.8-.6-6.6-2.4-1.8-1.8-2.6-4.4-2.4-6.6 0 .4.4.8 1.4 1.2Z"
        fill="#e8c547"
      />
      <path
        d="M10.4 12.2c2.4 2.4 5.8 3.6 8.4 3.2-1.2 2.8-4 5.2-6.6 6.2-.4-2.4.2-5.2 1.8-6.8-1.6 1.6-4.4 2.2-6.8 1.8 1-2.6 3.4-5.4 6.2-6.6-.4 2.6.8 6 2.2 7.4Z"
        fill="#e8c547"
      />
      <circle cx="16.6" cy="11.4" r="1.15" fill="#111" />
      <path d="M8.2 19.6c-.8.3-1.8.9-2.4 1.8.9-.6 1.5-1.6 1.8-2.4.2.2.4.4.6.6Z" fill="#e8c547" />
    </svg>
  );
}

function PoolIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M6.5 8.5v11.2" stroke="#e8c547" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M6.5 8.5h6.2" stroke="#e8c547" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M9.4 8.5v4.2h5.6V8.5" stroke="#e8c547" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5.2 21.2c1.6-1.1 3.2-1.1 4.8 0s3.2 1.1 4.8 0 3.2-1.1 4.8 0 3.2 1.1 4.8 0"
        stroke="#e8c547"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="5.2" y="8.4" width="17.6" height="12.4" rx="2.4" stroke="#e8c547" strokeWidth="2.1" />
      <path d="M10.2 8.4V7.6A2.4 2.4 0 0 1 12.6 5.2h2.8A2.4 2.4 0 0 1 17.8 7.6v.8" stroke="#e8c547" strokeWidth="2.1" />
      <path d="M5.2 14.2h17.6" stroke="#e8c547" strokeWidth="2.1" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 2.5 3.2v.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.5 3.05 2.9 10.22c-1.27.5-1.26 1.2-.23 1.51l4.77 1.49 1.85 5.7c.23.7.41.97.88.97.45 0 .65-.21 1-.62l2.07-2.13 4.3 3.18c.79.44 1.36.21 1.56-.73l2.83-13.35c.29-1.16-.45-1.69-1.43-1.16Z" />
    </svg>
  );
}
