import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Resarv on X or Telegram.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16 md:px-8">
      <h1 className="text-2xl font-semibold text-white">Support</h1>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#8a8a8a]">
        Reach us on{" "}
        <a
          href="https://x.com/resarved"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:underline"
        >
          X
        </a>{" "}
        or{" "}
        <a
          href="https://t.me/resarved_chat"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:underline"
        >
          Telegram
        </a>
        . After you message us, you can return to our{" "}
        <Link href="/thanks" className="text-white hover:underline">
          thank you
        </Link>{" "}
        page.
      </p>
    </main>
  );
}
