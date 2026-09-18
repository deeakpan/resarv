import { ADDRESSES, KNOWN_USDG_POOLS } from "@/lib/addresses";

export type DiscoveredPool = {
  id: string;
  label: string;
  dexId?: string;
  baseToken?: { address: string; symbol: string };
  quoteToken?: { address: string; symbol: string };
  priceUsd?: string;
  liquidityUsd?: number;
  source: "known" | "dexscreener" | "geckoterminal";
};

function isUsdg(addr?: string) {
  return addr?.toLowerCase() === ADDRESSES.usdg.toLowerCase();
}

/** Discover Uniswap pools that include USDG on Robinhood Chain */
export async function discoverUsdgPools(): Promise<DiscoveredPool[]> {
  const byId = new Map<string, DiscoveredPool>();

  for (const p of KNOWN_USDG_POOLS) {
    byId.set(p.id.toLowerCase(), {
      id: p.id,
      label: p.label,
      source: "known",
      quoteToken: { address: ADDRESSES.usdg, symbol: "USDG" },
    });
  }

  // DexScreener token endpoint (works for many L2s)
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ADDRESSES.usdg}`,
      { next: { revalidate: 30 } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        pairs?: Array<{
          chainId?: string;
          pairAddress?: string;
          dexId?: string;
          labels?: string[];
          baseToken?: { address: string; symbol: string };
          quoteToken?: { address: string; symbol: string };
          priceUsd?: string;
          liquidity?: { usd?: number };
        }>;
      };
      for (const pair of data.pairs ?? []) {
        const chain = (pair.chainId || "").toLowerCase();
        if (
          chain &&
          !chain.includes("robinhood") &&
          chain !== "4663" &&
          !chain.includes("rh")
        ) {
          // Keep if either token is USDG anyway — some APIs omit chain labels
          if (!isUsdg(pair.baseToken?.address) && !isUsdg(pair.quoteToken?.address)) {
            continue;
          }
        }
        const id = pair.pairAddress;
        if (!id) continue;
        const dex = (pair.dexId || "").toLowerCase();
        if (dex && !dex.includes("uniswap")) continue;

        const label = `${pair.baseToken?.symbol ?? "?"}/${pair.quoteToken?.symbol ?? "?"}`;
        byId.set(id.toLowerCase(), {
          id,
          label,
          dexId: pair.dexId,
          baseToken: pair.baseToken,
          quoteToken: pair.quoteToken,
          priceUsd: pair.priceUsd,
          liquidityUsd: pair.liquidity?.usd,
          source: "dexscreener",
        });
      }
    }
  } catch {
    /* ignore discovery errors — known pools still work */
  }

  // GeckoTerminal fallback
  try {
    const networks = ["robinhood", "robinhood-chain", "rh"];
    for (const net of networks) {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${ADDRESSES.usdg}/pools?page=1`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 30 },
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Array<{
          id?: string;
          attributes?: {
            name?: string;
            address?: string;
            reserve_in_usd?: string;
          };
        }>;
      };
      for (const row of data.data ?? []) {
        const addr = row.attributes?.address || row.id?.split("_").pop();
        if (!addr) continue;
        byId.set(addr.toLowerCase(), {
          id: addr,
          label: row.attributes?.name || "USDG pool",
          liquidityUsd: row.attributes?.reserve_in_usd
            ? Number(row.attributes.reserve_in_usd)
            : undefined,
          source: "geckoterminal",
        });
      }
      break;
    }
  } catch {
    /* ignore */
  }

  return [...byId.values()].sort(
    (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0),
  );
}
