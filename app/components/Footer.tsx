import Link from "next/link";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.227-8.451L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const linkClass =
  "text-[13px] font-medium text-[#8a8a8a] transition-colors hover:text-white";

export default function Footer() {
  return (
    <footer className="relative z-10 bg-transparent">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p className="text-[13px] font-medium text-[#8a8a8a]">Resarv</p>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/docs" className={linkClass}>
            Docs
          </Link>
          <a
            href="https://x.com/resarved"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8a8a8a] transition-colors hover:text-white"
            aria-label="Resarv on X"
          >
            <XIcon />
          </a>
          <a
            href="https://t.me/resarved_chat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8a8a8a] transition-colors hover:text-white"
            aria-label="Resarv on Telegram"
          >
            <TelegramIcon />
          </a>
          <Link href="/terms" className={linkClass}>
            Terms of Use
          </Link>
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          <Link href="/support" className={linkClass}>
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
