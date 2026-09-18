import type { Metadata } from "next";
import WalletGate from "@/app/components/WalletGate";
import Dashboard from "@/app/components/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Open a trove, borrow rUSD against your NFTs, stake RSRV, and manage Stability Pool deposits.",
};

export default function DashboardPage() {
  return (
    <WalletGate>
      <Dashboard />
    </WalletGate>
  );
}
