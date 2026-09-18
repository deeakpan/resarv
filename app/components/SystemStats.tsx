"use client";

import type { ReactNode } from "react";
import { formatPct, pretty } from "@/lib/format";
import { useOpenTroves } from "@/lib/open-troves";
import { useProtocol } from "@/lib/protocol";
import { Card } from "@/app/components/ui";

function Stat({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] py-3 last:border-0 last:pb-1 first:pt-1">
      <span className="text-[14px] font-medium text-[var(--muted)]">{term}</span>
      <span className="text-right text-[14px] font-semibold tabular-nums text-white">
        {children}
      </span>
    </div>
  );
}

export default function SystemStats() {
  const p = useProtocol();
  const { troves } = useOpenTroves();

  return (
    <Card title="Protocol statistics">
      <Stat term="Borrowing Fee">{formatPct(p.borrowFeePct, 2)}</Stat>
      <Stat term="rUSD supply">{pretty(p.rusdSupply)}</Stat>
      <Stat term="RSRV supply">{pretty(p.rsrvSupply)}</Stat>
      <Stat term="rUSD in Stability Pool">{pretty(p.rusdInSp)}</Stat>
      <Stat term="RSRV staked">{pretty(p.stakedRsrv)}</Stat>
      <Stat term="Open vaults">{troves.length}</Stat>
    </Card>
  );
}
