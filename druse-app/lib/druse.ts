import addresses from "@/deployments/addresses.json";
import { RH_COLLECTIONS, type RhCollection } from "@/lib/floors";

export const DEFAULT_CHAIN_ID = 4663;

export type DemoCollection = {
  id: string;
  nft: string;
  vault: string | null;
};

export type DruseDeployment = {
  name?: string;
  deployer?: string;
  uniswapV4?: {
    weth?: string;
    positionManager?: string;
    stateView?: string;
  };
  druse?: {
    factory?: string;
    staking?: string;
    stakeToken?: string;
    hook?: string;
    launcher?: string;
  };
  demo?: { collections?: DemoCollection[] };
};

export const FACTORY_ABI = [
  {
    type: "function",
    name: "allVaults",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "vaults", type: "address[]" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "excludedFromFees",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setFeeExclusion",
    stateMutability: "nonpayable",
    inputs: [
      { name: "excludedAddr", type: "address" },
      { name: "excluded", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPTokenPremium721",
    stateMutability: "view",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [
      { name: "premium", type: "uint256" },
      { name: "depositor", type: "address" },
    ],
  },
  {
    type: "function",
    name: "premiumDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const VAULT_ABI = [
  {
    type: "function",
    name: "assetAddress",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "totalHoldings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "vaultId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allHoldings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "vaultFees",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "mintFee", type: "uint256" },
      { name: "redeemFee", type: "uint256" },
      { name: "swapFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "enableMint",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "enableRedeem",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "pTokenToETH",
    stateMutability: "view",
    inputs: [{ name: "pTokenAmount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIds", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "depositor", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "pTokensMinted", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "payable",
    inputs: [
      { name: "idsOut", type: "uint256[]" },
      { name: "to", type: "address" },
      { name: "wethAmount", type: "uint256" },
      { name: "pTokenPremiumLimit", type: "uint256" },
      { name: "forceFees", type: "bool" },
    ],
    outputs: [{ name: "ethFees", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenDepositInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "timestamp", type: "uint48" },
      { name: "depositor", type: "address" },
    ],
  },
] as const;

export const ERC721_ABI = [
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const DEMO_NFT_ABI = [
  {
    type: "function",
    name: "mintTo",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export function isDemo() {
  const flag = process.env.NEXT_PUBLIC_DEMO?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function getDeployment(chainId = DEFAULT_CHAIN_ID): DruseDeployment {
  const all = addresses as Record<string, DruseDeployment>;
  return all[String(chainId)] ?? {};
}

export function getFactoryAddress(chainId = DEFAULT_CHAIN_ID) {
  return getDeployment(chainId).druse?.factory ?? null;
}

export function collectionById(id: string): RhCollection | undefined {
  return RH_COLLECTIONS.find((c) => c.id === id);
}

export type LiveVault = {
  vault: string;
  asset: string;
  vaultId: string;
  name: string;
  symbol: string;
  holdings: number;
  id: string | null;
  image: string | null;
  art: string | null;
  description: string | null;
  floorEth: number | null;
  floorUsd: number | null;
  volumeEth: number | null;
  change24h: number | null;
};

export type VaultDetail = LiveVault & {
  tokenIds: string[];
  enableMint: boolean;
  enableRedeem: boolean;
  mintFeeEth: number;
  redeemFeeEth: number;
  mintFeeWei: string;
  redeemFeeWei: string;
  mintFeePct: number;
  redeemFeePct: number;
};

export function vaultPath(v: LiveVault) {
  return `/vaults/${v.id ?? v.vault}`;
}

export function poolPath(v: { id?: string | null; vault: string }) {
  return `/pools/${v.id ?? v.vault}`;
}

export function vaultMatchesSlug(v: LiveVault, slug: string) {
  const s = decodeURIComponent(slug).toLowerCase();
  return (
    v.id?.toLowerCase() === s ||
    v.vault.toLowerCase() === s ||
    v.symbol.toLowerCase() === s
  );
}

export function displayForAsset(
  asset: string,
  chainId = DEFAULT_CHAIN_ID,
): RhCollection | undefined {
  const d = getDeployment(chainId) as DruseDeployment & {
    collections?: Record<string, { nft?: string; vault?: string | null }>;
    nfts?: Record<string, string>;
  };
  const a = asset.toLowerCase();
  for (const [id, row] of Object.entries(d.collections ?? {})) {
    if (row?.nft?.toLowerCase() === a) return collectionById(id);
  }
  for (const [id, nft] of Object.entries(d.nfts ?? {})) {
    if (nft?.toLowerCase() === a) {
      // Skip demo mock NFTs that share catalog ids.
      if (isDemo()) return collectionById(id);
      if (id === "spritehood-wisps") return collectionById(id);
    }
  }
  return undefined;
}
