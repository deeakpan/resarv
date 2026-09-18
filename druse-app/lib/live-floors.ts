import {
  FALLBACK_FLOORS,
  RH_COLLECTIONS,
  liquidityCap,
  type FloorCollection,
} from "@/lib/floors";

type GqlFloor = {
  stats?: {
    oneDay?: {
      floorPriceChange?: number | null;
      volume?: { native?: { unit?: number } };
    };
  };
  floorPrice?: {
    pricePerItem?: {
      token?: { unit?: number };
      usd?: number;
    };
  };
};

type OsStats = {
  total?: { floor_price?: number };
  intervals?: { interval: string; volume: number }[];
};

const TTL_MS = 60_000;
const GQL = "https://gql.opensea.io/graphql";

let cached: { at: number; collections: FloorCollection[] } | null = null;

function osHeaders() {
  const key = process.env.OPENSEA_API_KEY?.trim();
  return {
    accept: "application/json",
    "user-agent": "Mozilla/5.0 DruseApp",
    origin: "https://opensea.io",
    referer: "https://opensea.io/",
    ...(key ? { "x-api-key": key } : {}),
  };
}

async function getJson<T>(url: string, ms = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: osHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function aliasFor(id: string) {
  return `c_${id.replace(/[^a-z0-9]/gi, "_")}`;
}

async function openSeaGraphql(): Promise<Record<string, GqlFloor> | null> {
  const fields = `
    ... on Collection {
      stats { oneDay { floorPriceChange volume { native { unit } } } }
      floorPrice { pricePerItem { token { unit } usd } }
    }
  `;
  const selections = RH_COLLECTIONS.map((c) => {
    const alias = aliasFor(c.id);
    return `${alias}: collectionBySlug(slug: "${c.slug}") { ${fields} }`;
  }).join("\n");

  try {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { ...osHeaders(), "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ query: `query DruseFloors { ${selections} }` }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Record<string, GqlFloor | null> };
    if (!json.data) return null;
    const byId: Record<string, GqlFloor> = {};
    for (const c of RH_COLLECTIONS) {
      const row = json.data[aliasFor(c.id)];
      if (row) byId[c.id] = row;
    }
    return byId;
  } catch {
    return null;
  }
}

async function ethUsd(): Promise<number> {
  const data = await getJson<{ ethereum?: { usd?: number } }>(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    4000,
  );
  return data?.ethereum?.usd || 2450;
}

function fromGraphql(id: string, row: GqlFloor, usd: number): FloorCollection | null {
  const catalog = RH_COLLECTIONS.find((c) => c.id === id);
  if (!catalog) return null;
  const floorEth = row.floorPrice?.pricePerItem?.token?.unit;
  if (floorEth == null || !Number.isFinite(floorEth) || floorEth <= 0) return null;
  const change = row.stats?.oneDay?.floorPriceChange;
  const volumeEth = row.stats?.oneDay?.volume?.native?.unit ?? 0;
  const floorUsd = row.floorPrice?.pricePerItem?.usd || floorEth * usd;
  return {
    id: catalog.id,
    name: catalog.name,
    symbol: catalog.symbol,
    image: catalog.image,
    art: catalog.art,
    description: catalog.description,
    floorEth,
    floorUsd,
    change24h: change == null || !Number.isFinite(change) ? 0 : Number((change * 100).toFixed(2)),
    volumeEth,
    liquidityCapEth: liquidityCap(floorEth, volumeEth),
  };
}

export async function loadLiveFloors(): Promise<{
  collections: FloorCollection[];
  source: "opensea" | "cache" | "fallback";
}> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { collections: cached.collections, source: "cache" };
  }

  const usd = await ethUsd();
  const gql = await openSeaGraphql();
  let live = gql
    ? RH_COLLECTIONS.map((c) => fromGraphql(c.id, gql[c.id], usd)).filter(
        (row): row is FloorCollection => Boolean(row),
      )
    : [];

  if (!live.length) {
    const rows = await Promise.all(
      RH_COLLECTIONS.map(async (c) => {
        const stats = await getJson<OsStats>(
          `https://api.opensea.io/api/v2/collections/${c.slug}/stats`,
        );
        const floorEth = stats?.total?.floor_price;
        if (!stats || floorEth == null || !Number.isFinite(floorEth) || floorEth <= 0) return null;
        const volumeEth = stats.intervals?.find((x) => x.interval === "one_day")?.volume ?? 0;
        const row: FloorCollection = {
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          image: c.image,
          art: c.art,
          description: c.description,
          floorEth,
          floorUsd: floorEth * usd,
          change24h: c.change24h,
          volumeEth,
          liquidityCapEth: liquidityCap(floorEth, volumeEth),
        };
        return row;
      }),
    );
    live = rows.filter((row): row is FloorCollection => Boolean(row));
  }

  if (live.length) {
    cached = { at: Date.now(), collections: live };
    return { collections: live, source: "opensea" };
  }

  if (cached) return { collections: cached.collections, source: "cache" };
  return { collections: FALLBACK_FLOORS, source: "fallback" };
}
