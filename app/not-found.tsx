import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on Resarv.",
};

export default function NotFound() {
  return (
    <div className="landing relative flex min-h-screen flex-col bg-black text-white">
      <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-center px-5 pt-6 md:px-8 md:pt-8">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/wordmark.png"
            alt="Resarv"
            width={280}
            height={48}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-5 py-16 text-center md:px-8">
        <p className="font-sans text-[13px] font-semibold tracking-[0.18em] text-[#6b6b6b]">
          404
        </p>
        <h1 className="mt-4 max-w-[18ch] font-sans text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.15] tracking-[-0.03em] text-white">
          This page got liquidated
        </h1>
        <p className="mt-4 max-w-[38ch] font-sans text-[clamp(0.95rem,1.5vw,1.125rem)] font-medium leading-relaxed text-[#888]">
          The route you’re looking for doesn’t exist. Head home or open the
          app to keep borrowing against your NFTs.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-6 font-sans text-[14px] font-semibold text-black transition hover:bg-white/90"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white/[0.08] px-6 font-sans text-[14px] font-semibold text-white transition hover:bg-white/[0.12]"
          >
            Launch app
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
