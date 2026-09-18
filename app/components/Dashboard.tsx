"use client";

import { useState } from "react";
import AppShell from "@/app/components/AppShell";
import TroveCard from "@/app/components/TroveCard";
import StabilityCard from "@/app/components/StabilityCard";
import StakingCard from "@/app/components/StakingCard";

type Panel = "trove" | "sp" | "stake" | null;

export default function Dashboard() {
  const [open, setOpen] = useState<Panel>(null);

  const toggle = (panel: Panel) =>
    setOpen((cur) => (cur === panel ? null : panel));

  return (
    <AppShell>
      <TroveCard
        open={open === "trove"}
        onToggle={() => toggle("trove")}
      />
      <StabilityCard open={open === "sp"} onToggle={() => toggle("sp")} />
      <StakingCard
        open={open === "stake"}
        onToggle={() => toggle("stake")}
      />
    </AppShell>
  );
}
