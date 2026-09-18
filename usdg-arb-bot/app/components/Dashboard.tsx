"use client";

import { useCallback, useEffect, useState } from "react";

type Pool = {
  id: string;
  label: string;
  source: string;
  liquidityUsd?: number;
  dexId?: string;
};

type Scan = {
  at: string;
  dryRun: boolean;
  thresholdBps: number;
  pools: Pool[];
  pegQuote: { error: string } | {
    rate: number;
    deviationFromPeg: number;
    amountIn: string;
    amountOut: string;
  };
  opportunity: null | {
    direction: string;
    rate: number;
    deviationBps: number;
    sizeUsdg: string;
    estimatedEdge: string;
    useFlashloan: boolean;
  };
  note: string;
};

export default function Dashboard() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false);
  const [execMsg, setExecMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/scan");
      const data = (await res.json()) as Scan;
      setScan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const run = async () => {
    setBusy(true);
    setExecMsg(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setExecMsg(data.message ?? JSON.stringify(data));
      await refresh();
    } catch (e) {
      setExecMsg(e instanceof Error ? e.message : "execute failed");
    } finally {
      setBusy(false);
    }
  };

  const peg = scan?.pegQuote;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-10">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500">
          ROBINHOOD CHAIN · 4663
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          USDG peg arb bot
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Discovers Uniswap v4 USDG pools, quotes the USDG↔PEG path, and
          flash-borrows USDG when the rate drifts from 1:1 to trade it back.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Refresh scan
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? "Running…" : "Execute arb"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {execMsg ? (
        <p className="rounded-lg bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {execMsg}
        </p>
      ) : null}

      {scan ? (
        <>
          <section className="rounded-2xl bg-zinc-900/80 p-5">
            <h2 className="text-sm font-semibold text-zinc-300">Peg status</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Mode</dt>
                <dd className="text-white">
                  {scan.dryRun ? "DRY RUN" : "LIVE"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Threshold</dt>
                <dd className="text-white">{scan.thresholdBps} bps</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Scanned</dt>
                <dd className="text-white">{scan.at}</dd>
              </div>
              {"error" in (peg ?? { error: "" }) ? (
                <div className="mt-2 text-amber-400">
                  {(peg as { error: string }).error}
                </div>
              ) : peg && "rate" in peg ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">USDG→PEG rate</dt>
                    <dd className="font-mono text-white">
                      {peg.rate.toFixed(6)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Deviation</dt>
                    <dd className="font-mono text-white">
                      {(peg.deviationFromPeg * 1e4).toFixed(1)} bps
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            {scan.opportunity ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Opportunity: {scan.opportunity.direction} · size{" "}
                {scan.opportunity.sizeUsdg} USDG · edge ~$
                {scan.opportunity.estimatedEdge} · flashloan{" "}
                {scan.opportunity.useFlashloan ? "yes" : "no"}
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                No actionable deviation right now.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300">
              USDG Uniswap v4 pools ({scan.pools.length})
            </h2>
            <ul className="mt-3 divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
              {scan.pools.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.label}</p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {p.id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-zinc-400">
                    <div>{p.source}</div>
                    {p.liquidityUsd != null ? (
                      <div>${p.liquidityUsd.toLocaleString()}</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs leading-relaxed text-zinc-600">{scan.note}</p>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Scanning Robinhood Chain…</p>
      )}
    </div>
  );
}
