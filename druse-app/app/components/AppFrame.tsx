"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";

export default function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const cool = path.startsWith("/pools/new") || path.startsWith("/stake");

  return (
    <div className={`relative flex min-h-full flex-1 flex-col ${cool ? "bg-[#131313]" : "bg-[#100f0c]"}`}>
      {cool ? null : <div className="pointer-events-none fixed inset-0 z-0 night-wash" aria-hidden />}
      <div className="relative z-[1] flex min-h-full flex-1 flex-col">
        <AppHeader />
        {children}
      </div>
    </div>
  );
}
