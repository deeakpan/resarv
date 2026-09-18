import type { Metadata } from "next";
import { Suspense } from "react";
import AddLiquidity from "../../../components/AddLiquidity";

export const metadata: Metadata = { title: "New position" };

export default function NewPoolPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-white/8" />
          <div className="mt-8 h-80 animate-pulse rounded-2xl bg-white/6" />
        </main>
      }
    >
      <AddLiquidity />
    </Suspense>
  );
}
