import { type Address, type Hex, encodeAbiParameters, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isDemoMode } from "@/lib/demo";

export const PRICE_TTL_SECONDS = 40;

export const PRICE_TYPEHASH = keccak256(
  toBytes(
    "PriceAttestation(address collection,uint256 tokenId,uint256 price,uint256 deadline)"
  )
);

export const EIP712_DOMAIN_TYPEHASH = keccak256(
  toBytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);

export function buildDomainSeparator(
  chainId: number,
  verifyingContract: Address
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(toBytes("ResarvNFTCDP")),
        keccak256(toBytes("1")),
        BigInt(chainId),
        verifyingContract,
      ]
    )
  );
}

export function hashPriceAttestation(params: {
  collection: Address;
  tokenId: bigint;
  price: bigint;
  deadline: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [
        PRICE_TYPEHASH,
        params.collection,
        params.tokenId,
        params.price,
        params.deadline,
      ]
    )
  );
}

export function hashTypedData(domainSeparator: Hex, structHash: Hex): Hex {
  return keccak256(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`);
}

export async function resolveFloorPrice(collection: Address): Promise<{
  price: bigint;
  pricingSource: string;
  floorEth?: number;
  floorUsd?: number;
}> {
  // Live OpenSea floor for known Robinhood collections (and demo Stonk path)
  try {
    const { fetchCollectionFloor, usdToWad } = await import("@/lib/nft-floor");
    const { collectionByAddress } = await import("@/lib/collections");
    if (collectionByAddress(collection) || isDemoMode()) {
      const q = await fetchCollectionFloor(
        isDemoMode() && !collectionByAddress(collection)
          ? "stonkbrokers-434284142"
          : collection,
      );
      return {
        price: usdToWad(q.floorUsd),
        pricingSource: `${q.slug} ${q.source} floor`,
        floorEth: q.floorEth,
        floorUsd: q.floorUsd,
      };
    }
  } catch {
    /* fall through to env maps */
  }

  const raw = process.env.NFT_FLOOR_PRICES;
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      const hit =
        map[collection] ||
        map[collection.toLowerCase()] ||
        map[collection.toUpperCase()];
      if (hit) {
        return { price: BigInt(hit), pricingSource: "NFT_FLOOR_PRICES" };
      }
    } catch {
      /* fall through */
    }
  }
  const fallback = process.env.DEFAULT_NFT_FLOOR_USD;
  if (fallback) {
    return { price: BigInt(fallback), pricingSource: "DEFAULT_NFT_FLOOR_USD" };
  }
  return { price: 1000n * 10n ** 18n, pricingSource: "default $1000" };
}

export async function signNftPrice(params: {
  collection: Address;
  tokenId: bigint;
  chainId: number;
  nftCdp: Address;
  privateKey: Hex;
  price?: bigint;
}): Promise<{
  collection: Address;
  tokenId: string;
  price: string;
  deadline: number;
  signature: Hex;
  demo: boolean;
  pricingSource: string;
  floorEth?: number;
  floorUsd?: number;
}> {
  const resolved =
    params.price != null
      ? { price: params.price, pricingSource: "override" as const }
      : await resolveFloorPrice(params.collection);

  const price = resolved.price;
  const deadline = Math.floor(Date.now() / 1000) + PRICE_TTL_SECONDS;
  const domainSeparator = buildDomainSeparator(params.chainId, params.nftCdp);
  const structHash = hashPriceAttestation({
    collection: params.collection,
    tokenId: params.tokenId,
    price,
    deadline: BigInt(deadline),
  });
  const digest = hashTypedData(domainSeparator, structHash);
  const account = privateKeyToAccount(params.privateKey);
  const signature = await account.sign({ hash: digest });

  return {
    collection: params.collection,
    tokenId: params.tokenId.toString(),
    price: price.toString(),
    deadline,
    signature,
    demo: isDemoMode(),
    pricingSource: resolved.pricingSource,
    floorEth: "floorEth" in resolved ? resolved.floorEth : undefined,
    floorUsd: "floorUsd" in resolved ? resolved.floorUsd : undefined,
  };
}
