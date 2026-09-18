"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import ConnectButton from "@/app/components/ConnectButton";
import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export default function WalletGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAppKitAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--background)]">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="max-w-md text-lg font-bold leading-snug text-[var(--muted)]">
            Connect your wallet to continue.
          </p>
          <ConnectButton variant="page" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
