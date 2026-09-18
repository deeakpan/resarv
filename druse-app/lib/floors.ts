export type FloorCollection = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  art: string;
  description: string;
  floorEth: number;
  floorUsd: number;
  change24h: number | null;
  volumeEth: number;
  liquidityCapEth: number;
};

export type RhCollection = {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  image: string;
  art: string;
  description: string;
  floorEth: number;
  floorUsd: number;
  change24h: number;
  volumeEth: number;
};

/** Robinhood Chain collections on OpenSea. Images are collection art, not ETH blue-chips. */
export const RH_COLLECTIONS: RhCollection[] = [
  {
    id: "stonkbrokers",
    slug: "stonkbrokers-434284142",
    name: "StonkBrokers",
    symbol: "STONK",
    image:
      "https://i2c.seadn.io/collection/stonkbrokers-434284142/image_type_logo/d2dfd6700b856a0efa032fe803488f/96d2dfd6700b856a0efa032fe803488f.png",
    art: "https://raw2.seadn.io/robinhood/0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0/87d9f1106ac56f203ece104d71b92d/c487d9f1106ac56f203ece104d71b92d.svg",
    description: "4444 pixel stock-broker NFTs with dedicated onchain wallets funded at mint.",
    floorEth: 5.969,
    floorUsd: 14228,
    change24h: 25.9,
    volumeEth: 5.12,
  },
  {
    id: "chain-mancers",
    slug: "chain-mancers",
    name: "Chain Mancers",
    symbol: "MANCER",
    image:
      "https://raw2.seadn.io/robinhood/0x797a2e030b7e49107c8f07bf0300ea9cae88ca57/e25bfcd8c0c30d4e0870dd66125778/7ae25bfcd8c0c30d4e0870dd66125778.svg",
    art: "https://raw2.seadn.io/robinhood/0x797a2e030b7e49107c8f07bf0300ea9cae88ca57/9764c3e78db93bd245bc72ff2d80e3/d79764c3e78db93bd245bc72ff2d80e3.svg",
    description: "Hoods up.",
    floorEth: 0.85,
    floorUsd: 2026,
    change24h: 29.1,
    volumeEth: 18.72,
  },
  {
    id: "pyopyopyopyo",
    slug: "py0py0py0py0",
    name: "pyopyopyopyo",
    symbol: "PYO",
    image:
      "https://i2c.seadn.io/collection/pyopyopyopyo-13242225/image_type_logo/6b7385348bbe1bf7cea1d9565f0955/676b7385348bbe1bf7cea1d9565f0955.png",
    art: "https://i2c.seadn.io/robinhood/0x08dc7cb3f4ccc8eea782e2924d151e2130f22b28/9931480c40ed615035cdebe39f635a/8e9931480c40ed615035cdebe39f635a.png",
    description: "",
    floorEth: 0.0344,
    floorUsd: 82,
    change24h: 16.5,
    volumeEth: 0.84,
  },
  {
    id: "spritehood-wisps",
    slug: "spritehood-wisps",
    name: "Spritehood Wisps",
    symbol: "WISP",
    image:
      "https://raw2.seadn.io/robinhood/0xd6577124f96394faee65afd2408f2ffa88445f63/dcc8910ff6b905c271b25915e0b6b7/eedcc8910ff6b905c271b25915e0b6b7.svg",
    art: "https://raw2.seadn.io/robinhood/0xd6577124f96394faee65afd2408f2ffa88445f63/e5e44a2f82fce1d9867ca7dd5e5fe9/35e5e44a2f82fce1d9867ca7dd5e5fe9.svg",
    description: "",
    floorEth: 0.0069,
    floorUsd: 16,
    change24h: 3.0,
    volumeEth: 3.19,
  },
  {
    id: "onchainhoodies",
    slug: "onchainhoodies-",
    name: "OnChainHoodies",
    symbol: "OCH",
    image:
      "https://i2c.seadn.io/collection/onchainhoodies-587016624/image_type_logo/0c1d894db3c6684ec879891f20fb79/cb0c1d894db3c6684ec879891f20fb79.png",
    art: "https://raw2.seadn.io/robinhood/0x9ec6c5b9f572a9b02138e553bc5f5882da735f45/cde25d8f4dcb0ae3d6cd4e0004db49/29cde25d8f4dcb0ae3d6cd4e0004db49.svg",
    description: "",
    floorEth: 0.02,
    floorUsd: 48,
    change24h: 25.0,
    volumeEth: 0.53,
  },
  {
    id: "cash-cats",
    slug: "cashcatss",
    name: "Cash Cats",
    symbol: "CATS",
    image:
      "https://i2c.seadn.io/collection/cashcatss/image_type_logo/85d404f808ab106f13790b69054c3f/a185d404f808ab106f13790b69054c3f.png",
    art: "https://i2c.seadn.io/robinhood/0xe3b34c4bb0f12c82143745eee6a6cf4e3154b1fa/b3d704837a199852ca856b124a4fd9/3eb3d704837a199852ca856b124a4fd9.png",
    description: "",
    floorEth: 0.0617,
    floorUsd: 147,
    change24h: 8.2,
    volumeEth: 18.2,
  },
  {
    id: "robinhood-punks",
    slug: "robinhood-punks",
    name: "Robinhood Punks",
    symbol: "PUNKS",
    image:
      "https://i2c.seadn.io/collection/robinhood-punks/image_type_logo/4afd4a32b01cddd945d23e60c66d95/f94afd4a32b01cddd945d23e60c66d95.jpeg",
    art: "https://i2c.seadn.io/robinhood/0xf08c65564eb07d880021105489552080b08e4319/d2019ee2ac6602f939d1b798c2d6b3/fcd2019ee2ac6602f939d1b798c2d6b3.png",
    description: "",
    floorEth: 0.00635,
    floorUsd: 15,
    change24h: 29.1,
    volumeEth: 1.84,
  },
  {
    id: "pitboys",
    slug: "pitboys",
    name: "PitBoys",
    symbol: "PIT",
    image:
      "https://raw2.seadn.io/robinhood/0x57069d845701b50f41327362c1c23789043f8dec/37f47c4ae477f8472fe01445d1839d/1737f47c4ae477f8472fe01445d1839d.svg",
    art: "https://raw2.seadn.io/robinhood/0x57069d845701b50f41327362c1c23789043f8dec/7a97ef3a0bb1620d432c1e5b8827e9/817a97ef3a0bb1620d432c1e5b8827e9.svg",
    description: "",
    floorEth: 0.0193,
    floorUsd: 46,
    change24h: 22.0,
    volumeEth: 0.65,
  },
];

export const FALLBACK_FLOORS: FloorCollection[] = RH_COLLECTIONS.map((c) => ({
  ...c,
  liquidityCapEth: liquidityCap(c.floorEth, c.volumeEth),
}));

export function liquidityCap(floorEth: number, volumeEth: number) {
  const book = floorEth * 5;
  const volCap = volumeEth > 0 ? volumeEth * 0.15 : book;
  const cap = Math.min(book, volCap);
  return Math.max(0.05, Number(cap.toFixed(4)));
}
