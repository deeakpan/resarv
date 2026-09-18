"use client";

import { SOCIAL } from "@/lib/socials";

function GitHubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.01 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.24 3H21l-6.51 7.44L22 21h-6.17l-4.82-6.3L5.4 21H2.63l6.97-7.97L2 3h6.31l4.36 5.77L18.24 3Zm-1.08 16.2h1.7L6.93 4.7H5.1l12.06 14.5Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.5 3.05 2.9 10.22c-1.27.5-1.26 1.2-.23 1.51l4.77 1.49 1.85 5.7c.23.7.41.97.88.97.45 0 .65-.21 1-.62l2.07-2.13 4.3 3.18c.79.44 1.36.21 1.56-.73l2.83-13.35c.29-1.16-.45-1.69-1.43-1.16Z" />
    </svg>
  );
}

const COLUMNS = [
  {
    title: "App",
    links: [
      { label: "Trade", href: "/#trade" },
      { label: "NFT Vaults", href: "/vaults" },
      { label: "Staking", href: "/#stake" },
      { label: "$DRUSE", href: "/#druse" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "Vaults", href: "/vaults" },
      { label: "Uniswap v4", href: "https://docs.uniswap.org/contracts/v4/overview" },
      { label: "Hooks", href: "https://docs.uniswap.org/contracts/v4/concepts/hooks" },
      { label: "Developers", href: "/#docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#inventory" },
      { label: "Brand", href: "/#docs" },
      { label: "GitHub", href: SOCIAL.github },
    ],
  },
  {
    title: "Need help?",
    links: [
      { label: "Contact us", href: SOCIAL.telegram },
    ],
  },
];

function hashId(href: string) {
  if (href.startsWith("/#")) return href.slice(2);
  if (href.startsWith("#")) return href.slice(1);
  return null;
}

function FooterLink({ href, children }: { href: string; children: string }) {
  const id = hashId(href);
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-[14px] text-white/45 transition-colors hover:text-white"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      onClick={
        id
          ? (e) => {
              const el = document.getElementById(id);
              if (!el) return;
              e.preventDefault();
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${id}`);
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}

export default function Footer() {
  return (
    <footer id="docs" className="relative border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 md:flex-row md:items-start md:justify-between md:px-8 md:py-20">
        <div className="flex min-h-[120px] flex-col justify-between">
          <a
            href="/"
            className="font-[family-name:var(--font-logo)] text-[32px] font-bold tracking-[-0.03em] text-white no-underline"
          >
            Druse
          </a>
          <div className="mt-10 flex items-center gap-5 text-white md:mt-16">
            <a
              href={SOCIAL.github}
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-50"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
            <a
              href={SOCIAL.x}
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-50"
              aria-label="X"
            >
              <XIcon />
            </a>
            <a
              href={SOCIAL.telegram}
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-50"
              aria-label="Telegram"
            >
              <TelegramIcon />
            </a>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 md:max-w-[720px] md:gap-x-14">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-4 text-[15px] font-bold text-white">{col.title}</div>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-[13px] text-white/40 md:px-8">
        © 2026 Druse
      </div>
    </footer>
  );
}
