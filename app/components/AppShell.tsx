"use client";

import type { ReactNode } from "react";
import SystemStats from "@/app/components/SystemStats";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center gap-8 px-3 pb-16 pt-10 sm:px-4 md:flex-row md:items-start md:justify-center md:gap-8 md:px-8 md:pt-14">
      <div className="w-full min-w-0 max-w-[520px]">{children}</div>
      <aside className="w-full min-w-0 max-w-[340px] md:sticky md:top-4 md:self-start">
        <SystemStats />
      </aside>
    </main>
  );
}
