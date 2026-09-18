import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Resarv handles wallet connections, cookies, and on-chain data on Somnia.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16 md:px-8">
      <h1 className="text-2xl font-semibold text-white">Privacy Policy</h1>
      <p className="mt-2 text-[13px] font-medium text-[#6b6b6b]">
        Last updated: September 18, 2026
      </p>

      <div className="mt-8 space-y-6 text-[15px] font-medium leading-relaxed text-[#8a8a8a]">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Overview</h2>
          <p>
            Resarv is a decentralized application for borrowing rUSD against NFT
            collateral on Somnia. This policy explains what information is used
            when you visit the site or connect a wallet.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">On-chain data</h2>
          <p>
            Wallet addresses, transactions, balances, and protocol positions are
            public by design of the blockchain. Resarv does not control and
            cannot delete public on-chain records.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Cookies &amp; local storage</h2>
          <p>
            We use essential cookies and browser storage for wallet session
            reconnection and UI preferences (including cookie consent). These are
            required for the app to function and are not used for advertising
            tracking.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Third parties</h2>
          <p>
            Wallet connections may use WalletConnect / AppKit providers. NFT
            pricing and metadata may be fetched from third-party APIs. Their
            privacy practices apply to data they process.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Contact</h2>
          <p>
            Questions? Reach us via{" "}
            <Link href="/support" className="text-white hover:underline">
              Support
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
