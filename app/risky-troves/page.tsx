import type { Metadata } from "next";
import WalletGate from "@/app/components/WalletGate";
import RiskyTroves from "@/app/components/RiskyTroves";

export const metadata: Metadata = {
  title: "Risky Troves",
  description:
    "Browse undercollateralized Resarv troves eligible for liquidation on Somnia.",
};

export default function RiskyTrovesPage() {
  return (
    <WalletGate>
      <RiskyTroves />
    </WalletGate>
  );
}
