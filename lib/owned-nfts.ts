"use client";

import { useCallback, useEffect, useState } from "react";
import { type Address } from "viem";
import { usePublicClient } from "wagmi";
import { erc721Abi } from "@/lib/abi";
import { collectionByAddress } from "@/lib/collections";

export type OwnedNft = {
  collection: Address;
  tokenId: number;
  collectionName: string;
  logoUrl?: string;
};

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";

async function ownedViaEnumerable(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  collection: Address,
  owner: Address,
): Promise<number[]> {
  const balance = await client.readContract({
    address: collection,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  const n = Number(balance);
  if (!Number.isFinite(n) || n <= 0) return [];
  const capped = Math.min(n, 40);
  const ids: number[] = [];
  for (let i = 0; i < capped; i++) {
    try {
      const id = await client.readContract({
        address: collection,
        abi: erc721Abi,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, BigInt(i)],
      });
      ids.push(Number(id));
    } catch {
      break;
    }
  }
  return ids;
}

async function ownedViaBlockscout(
  collection: Address,
  owner: Address,
): Promise<number[]> {
  const url = `${BLOCKSCOUT}/api/v2/addresses/${owner}/nft?type=ERC-721`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: { token?: { address_hash?: string }; id?: string }[];
  };
  const col = collection.toLowerCase();
  const ids: number[] = [];
  for (const item of json.items || []) {
    const addr = item.token?.address_hash?.toLowerCase();
    if (addr !== col) continue;
    const id = Number(item.id);
    if (Number.isInteger(id) && id >= 0) ids.push(id);
  }
  return ids.slice(0, 40);
}

export function useOwnedNfts(
  collections: Address[],
  owner?: Address,
  chainId?: number,
) {
  const client = usePublicClient({ chainId });
  const [nfts, setNfts] = useState<OwnedNft[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!owner || !collections.length || !client) {
      setNfts([]);
      return;
    }
    setLoading(true);
    try {
      const out: OwnedNft[] = [];
      for (const collection of collections) {
        const reg = collectionByAddress(collection);
        let ids: number[] = [];
        try {
          ids = await ownedViaEnumerable(client, collection, owner);
        } catch {
          ids = [];
        }
        if (!ids.length) {
          try {
            ids = await ownedViaBlockscout(collection, owner);
          } catch {
            ids = [];
          }
        }
        for (const tokenId of ids) {
          out.push({
            collection,
            tokenId,
            collectionName: reg?.name || "Collection",
            logoUrl: reg?.logoUrl,
          });
        }
      }
      out.sort((a, b) => {
        const c = a.collectionName.localeCompare(b.collectionName);
        return c !== 0 ? c : a.tokenId - b.tokenId;
      });
      setNfts(out);
    } finally {
      setLoading(false);
    }
  }, [client, collections, owner]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { nfts, loading, refetch };
}
