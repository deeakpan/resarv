import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms governing use of the Resarv interface and protocol interactions on Robinhood Chain.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16 md:px-8">
      <h1 className="text-2xl font-semibold text-white">Terms of Use</h1>
      <p className="mt-2 text-[13px] font-medium text-[#6b6b6b]">
        Last updated: September 18, 2026
      </p>

      <div className="mt-8 space-y-6 text-[15px] font-medium leading-relaxed text-[#8a8a8a]">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Acceptance</h2>
          <p>
            By accessing Resarv you agree to these terms. If you do not agree,
            do not use the interface or interact with the protocol.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Interface only</h2>
          <p>
            Resarv provides a web interface to smart contracts on Robinhood Chain. The
            interface may change, break, or become unavailable. Protocol logic
            lives on-chain and may differ from what the UI displays.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Risks</h2>
          <p>
            Borrowing, staking, liquidations, oracle pricing, and smart
            contracts are experimental and carry risk of loss, including total
            loss of funds or NFTs. You are solely responsible for your
            transactions and wallet security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">No advice</h2>
          <p>
            Nothing on Resarv is financial, legal, or tax advice. Content is for
            informational purposes only.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Eligibility</h2>
          <p>
            You represent that you are legally allowed to use DeFi applications
            in your jurisdiction and are not subject to applicable sanctions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Resarv contributors and
            operators are not liable for any damages arising from use of the
            interface or protocol.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Contact</h2>
          <p>
            See{" "}
            <Link href="/support" className="text-white hover:underline">
              Support
            </Link>{" "}
            or our{" "}
            <Link href="/privacy" className="text-white hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
