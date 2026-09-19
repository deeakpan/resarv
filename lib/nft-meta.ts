import { collectionByAddress } from "@/lib/collections";

export type NftTokenMeta = {
  tokenId: number;
  name: string;
  image: string;
  collection: string;
};

const cache = new Map<string, { meta: NftTokenMeta; at: number }>();
const CACHE_MS = 10 * 60_000;

const RH_RPC =
  process.env.RH_MAINNET_RPC?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";

function decodeAbiString(hex: string): string {
  const buf = Buffer.from(hex.replace(/^0x/, ""), "hex");
  if (buf.length < 64) throw new Error("Bad eth_call result");
  const offset = Number(buf.readBigUInt64BE(24));
  const len = Number(buf.readBigUInt64BE(offset + 24));
  return buf.slice(offset + 32, offset + 32 + len).toString("utf8");
}

function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

async function ethCallTokenUri(
  collection: string,
  tokenId: number,
): Promise<string> {
  const data = `0xc87b56dd${tokenId.toString(16).padStart(64, "0")}`;
  const res = await fetch(RH_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: collection, data }, "latest"],
    }),
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: string;
    error?: { message: string };
  };
  if (json.error?.message) throw new Error(json.error.message);
  if (!json.result || json.result === "0x") {
    throw new Error(`No tokenURI for ${collection} #${tokenId}`);
  }
  return decodeAbiString(json.result);
}

async function resolveImageFromUri(
  uri: string,
  tokenId: number,
  collectionName: string,
): Promise<{ name: string; image: string }> {
  if (uri.startsWith("data:application/json;base64,")) {
    const json = JSON.parse(
      Buffer.from(
        uri.slice("data:application/json;base64,".length),
        "base64",
      ).toString("utf8"),
    ) as { name?: string; image?: string };
    if (!json.image) throw new Error(`No image for #${tokenId}`);
    return {
      name: json.name || `${collectionName} #${tokenId}`,
      image: json.image,
    };
  }

  if (uri.startsWith("http") || uri.startsWith("ipfs://")) {
    const res = await fetch(ipfsToHttp(uri), {
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`Meta HTTP ${res.status}`);
    const json = (await res.json()) as { name?: string; image?: string };
    if (!json.image) throw new Error(`No image for #${tokenId}`);
    return {
      name: json.name || `${collectionName} #${tokenId}`,
      image: ipfsToHttp(json.image),
    };
  }

  throw new Error(`Unsupported tokenURI for #${tokenId}`);
}

export async function fetchTokenMeta(
  collection: string,
  tokenId: number,
): Promise<NftTokenMeta> {
  const key = `${collection.toLowerCase()}:${tokenId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.meta;

  const reg = collectionByAddress(collection);
  const uri = await ethCallTokenUri(collection, tokenId);
  const resolved = await resolveImageFromUri(
    uri,
    tokenId,
    reg?.name || "NFT",
  );
  const meta: NftTokenMeta = {
    tokenId,
    name: resolved.name,
    image: resolved.image,
    collection,
  };
  cache.set(key, { meta, at: Date.now() });
  return meta;
}

export async function fetchTokenMetas(
  collection: string,
  tokenIds: number[],
): Promise<NftTokenMeta[]> {
  const reg = collectionByAddress(collection);
  const fallbackImage = reg?.logoUrl || "/nfts/stonk.svg";
  const results = await Promise.allSettled(
    tokenIds.map((id) => fetchTokenMeta(collection, id)),
  );
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      tokenId: tokenIds[i],
      name: `${reg?.name || "NFT"} #${tokenIds[i]}`,
      image: fallbackImage,
      collection,
    };
  });
}

/** @deprecated */
export async function fetchStonkTokenMetas(tokenIds: number[]) {
  const { STONK_BROKERS_COLLECTION } = await import("@/lib/nft-floor");
  return fetchTokenMetas(STONK_BROKERS_COLLECTION, tokenIds);
}

export const STONK_COLLECTION_LOGO =
  "https://i2c.seadn.io/collection/stonkbrokers-434284142/image_type_logo/d2dfd6700b856a0efa032fe803488f/96d2dfd6700b856a0efa032fe803488f.png";
