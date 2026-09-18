import type { Address } from "viem";

export type RhNftCollection = {
  id: string;
  name: string;
  symbol: string;
  address: Address;
  openseaSlug: string;
  logoUrl: string;
  chainId: number;
};

/** Live Robinhood Chain collections (OpenSea CAs). */
export const RH_NFT_COLLECTIONS: RhNftCollection[] = [
  {
    id: "stonkbrokers",
    name: "Stonk Brokers",
    symbol: "STONK",
    address: "0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0",
    openseaSlug: "stonkbrokers-434284142",
    logoUrl:
      "https://i2c.seadn.io/collection/stonkbrokers-434284142/image_type_logo/d2dfd6700b856a0efa032fe803488f/96d2dfd6700b856a0efa032fe803488f.png",
    chainId: 4663,
  },
  {
    id: "therobinhood",
    name: "The Robin Hood",
    symbol: "ROBIN",
    address: "0x2cb61a81cec32534de271666fa020c89c2dd1920",
    openseaSlug: "therobinhood",
    logoUrl:
      "https://i2c.seadn.io/collection/therobinhood/image_type_logo",
    chainId: 4663,
  },
  {
    id: "monkeyhood",
    name: "MonkeyHood",
    symbol: "MONKEY",
    address: "0x6581b6fa83e714956935cd1e16ac8f6f5c44c484",
    openseaSlug: "monkeyhoodnfts",
    logoUrl:
      "https://i2c.seadn.io/collection/monkeyhoodnfts/image_type_logo",
    chainId: 4663,
  },
];

export function collectionByAddress(
  address?: string | null,
): RhNftCollection | undefined {
  if (!address) return undefined;
  const a = address.toLowerCase();
  return RH_NFT_COLLECTIONS.find((c) => c.address.toLowerCase() === a);
}

export function collectionBySlug(slug: string): RhNftCollection | undefined {
  return RH_NFT_COLLECTIONS.find((c) => c.openseaSlug === slug || c.id === slug);
}

export function supportedCollectionAddresses(): Address[] {
  return RH_NFT_COLLECTIONS.map((c) => c.address);
}
