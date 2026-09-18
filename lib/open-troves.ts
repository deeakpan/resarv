"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address } from "viem";
import { usePublicClient } from "wagmi";
import { ZERO_ADDRESS } from "@/lib/contracts";
import { RH_NFT_COLLECTIONS } from "@/lib/collections";
import { useProtocol } from "@/lib/protocol";
import { nftCdpAbi } from "@/lib/abi";

export type OpenTrove = {
  collection: Address;
  tokenId: number;
  owner: Address;
  debt: bigint;
};

const PROBE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function useOpenTroves() {
  const p = useProtocol();
  const client = usePublicClient({ chainId: p.chainId });
  const [troves, setTroves] = useState<OpenTrove[]>([]);

  const collections = useMemo(() => {
    if (p.addresses?.supportedCollections?.length) {
      return p.addresses.supportedCollections;
    }
    return RH_NFT_COLLECTIONS.map((c) => c.address);
  }, [p.addresses?.supportedCollections]);

  const tokenIds = useMemo(
    () =>
      p.addresses?.mintedTokenIds?.length
        ? p.addresses.mintedTokenIds
        : PROBE_IDS,
    [p.addresses?.mintedTokenIds],
  );

  const enabled = Boolean(
    p.addresses?.nftCdp && collections.length > 0 && client,
  );

  const refetchAll = useCallback(async () => {
    if (!client || !p.addresses?.nftCdp) return;
    const cdp = p.addresses.nftCdp;
    const out: OpenTrove[] = [];
    await Promise.all(
      collections.flatMap((collection) =>
        tokenIds.map(async (tokenId) => {
          try {
            const [owner, debt] = await client.readContract({
              address: cdp,
              abi: nftCdpAbi,
              functionName: "getPosition",
              args: [collection, BigInt(tokenId)],
            });
            if (
              owner &&
              owner.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
              debt > 0n
            ) {
              out.push({ collection, tokenId, owner, debt });
            }
          } catch {
            /* skip missing / reverted */
          }
        }),
      ),
    );
    out.sort((a, b) => {
      const ca = a.collection.toLowerCase().localeCompare(b.collection.toLowerCase());
      return ca !== 0 ? ca : a.tokenId - b.tokenId;
    });
    setTroves(out);
  }, [client, p.addresses?.nftCdp, collections, tokenIds]);

  useEffect(() => {
    if (!enabled) {
      setTroves([]);
      return;
    }
    void refetchAll();
    const id = window.setInterval(() => void refetchAll(), 8_000);
    return () => window.clearInterval(id);
  }, [enabled, refetchAll]);

  return {
    troves,
    refetchAll,
    collections,
    /** @deprecated prefer trove.collection */
    collection: collections[0],
    enabled,
  };
}
