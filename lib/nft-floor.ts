/**
 * Live OpenSea floor pricing by collection slug / contract address.
 */

import {
  RH_NFT_COLLECTIONS,
  collectionByAddress,
  type RhNftCollection,
} from "@/lib/collections";

export type FloorQuote = {
  floorEth: number;
  floorUsd: number;
  source: "opensea" | "coingecko" | "default";
  slug: string;
  fetchedAt: number;
};

const cache = new Map<string, FloorQuote>();
const CACHE_MS = 30_000;

/** Convert a USD float into 1e18 wad without blowing float precision. */
export function usdToWad(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error(`Invalid USD floor: ${usd}`);
  }
  const [whole, frac = ""] = usd.toFixed(8).split(".");
  const frac8 = (frac + "00000000").slice(0, 8);
  return BigInt(whole) * 10n ** 18n + BigInt(frac8) * 10n ** 10n;
}

async function ethUsd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { ethereum?: { usd?: number } };
    return Number(json.ethereum?.usd || 0);
  } catch {
    return 0;
  }
}

async function fetchOpenSeaFloor(slug: string): Promise<FloorQuote> {
  const query = `query($slug: String!) {
    collectionBySlug(slug: $slug) {
      ... on Collection {
        floorPrice {
          pricePerItem {
            token { unit symbol }
            usd
          }
        }
      }
    }
  }`;
  const res = await fetch("https://gql.opensea.io/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://opensea.io",
      referer: `https://opensea.io/collection/${slug}`,
      "user-agent": "Mozilla/5.0 Resarv",
    },
    body: JSON.stringify({ query, variables: { slug } }),
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`OpenSea HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      collectionBySlug?: {
        floorPrice?: {
          pricePerItem?: {
            token?: { unit?: string | number; symbol?: string };
            usd?: number | string | null;
          };
        } | null;
      } | null;
    };
    errors?: { message?: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "OpenSea GraphQL error");
  }
  const item = json.data?.collectionBySlug?.floorPrice?.pricePerItem;
  const floorEth = Number(item?.token?.unit || 0);
  let floorUsd = Number(item?.usd || 0);

  if ((!Number.isFinite(floorUsd) || floorUsd <= 0) && floorEth > 0) {
    const usd = await ethUsd();
    if (usd > 0) {
      floorUsd = floorEth * usd;
      return {
        floorEth,
        floorUsd,
        source: "coingecko",
        slug,
        fetchedAt: Date.now(),
      };
    }
  }

  if (!Number.isFinite(floorUsd) || floorUsd <= 0) {
    throw new Error(`OpenSea returned no floor for ${slug}`);
  }

  return {
    floorEth: Number.isFinite(floorEth) ? floorEth : 0,
    floorUsd,
    source: "opensea",
    slug,
    fetchedAt: Date.now(),
  };
}

function defaultFloor(slug: string): FloorQuote | null {
  const fallback = process.env.DEFAULT_NFT_FLOOR_USD;
  if (!fallback) return null;
  const usd = Number(fallback) / 1e18;
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return {
    floorEth: 0,
    floorUsd: usd,
    source: "default",
    slug,
    fetchedAt: Date.now(),
  };
}

export async function fetchCollectionFloor(
  collectionOrSlug: string,
): Promise<FloorQuote> {
  const byAddr = collectionByAddress(collectionOrSlug);
  const slug =
    byAddr?.openseaSlug ||
    RH_NFT_COLLECTIONS.find((c) => c.id === collectionOrSlug)?.openseaSlug ||
    collectionOrSlug;

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit;

  try {
    const q = await fetchOpenSeaFloor(slug);
    cache.set(slug, q);
    return q;
  } catch (err) {
    const fb = defaultFloor(slug);
    if (fb) {
      cache.set(slug, fb);
      return fb;
    }
    throw err;
  }
}

/** @deprecated use fetchCollectionFloor */
export async function fetchStonkBrokersFloor(): Promise<FloorQuote> {
  return fetchCollectionFloor("stonkbrokers-434284142");
}

export const STONK_BROKERS_SLUG = "stonkbrokers-434284142";
export const STONK_BROKERS_COLLECTION =
  "0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0" as const;

export function resolveRegistry(
  collection: string,
): RhNftCollection | undefined {
  return collectionByAddress(collection);
}
