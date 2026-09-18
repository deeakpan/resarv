import type { Metadata } from "next";
import WalletGate from "@/app/components/WalletGate";
import Positions from "@/app/components/Positions";

export const metadata: Metadata = {
  title: "Positions",
  description:
    "View and repay your Resarv troves, collateral, debt, and liquidation risk.",
};

export default function PositionsPage() {
  return (
    <WalletGate>
      <Positions />
    </WalletGate>
  );
}
