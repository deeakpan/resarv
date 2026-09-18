import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank you",
  description: "Thanks for reaching out to Resarv.",
};

export default function ThanksPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-5 py-20 md:px-8">
      <h1 className="text-2xl font-semibold text-white">Thank you</h1>
      <p className="mt-3 max-w-[42ch] text-[15px] font-medium leading-relaxed text-[#8a8a8a]">
        We appreciate you. Our team will get back to you as soon as we can.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-[14px] font-semibold text-black transition hover:bg-white/90"
        >
          Launch app
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-white/[0.08] px-5 text-[14px] font-semibold text-white transition hover:bg-white/[0.12]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
