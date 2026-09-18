import type { Address } from "viem";
import nftCdpAddresses from "@/deployments/nft-cdp-addresses.json";
import { APP_CHAIN_ID, SOMNIA_TESTNET_CHAIN_ID } from "@/config/appkit";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export const DECIMAL_PRECISION = 10n ** 18n;
export const NFT_MAX_LTV = 4n * 10n ** 17n; // 40%
export const NFT_LIQ_THRESHOLD = 5n * 10n ** 17n; // 50%
export const NFT_BORROW_FEE = 5n * 10n ** 15n; // 0.5%

export type NftCdpAddresses = {
  rusd: Address;
  rsrv: Address;
  rsrvStaking: Address;
  stabilityPool: Address;
  nftCdp: Address;
  priceSigner: Address;
  treasury: Address;
  mockNft: Address;
  mintedTokenIds: number[];
  supportedCollections: Address[];
  stakingEnabled: boolean;
};

type DeploymentFile = Record<
  string,
  {
    chainId: number;
    addresses: Partial<Record<string, string | number[] | string[] | boolean>> & {
      mintedTokenIds?: number[];
      supportedCollections?: string[];
      stakingEnabled?: boolean;
    };
    deployedAt?: string | null;
  }
>;

const file = nftCdpAddresses as DeploymentFile;

export function getDeployment(chainId: number = APP_CHAIN_ID) {
  return file[String(chainId)] ?? file[String(SOMNIA_TESTNET_CHAIN_ID)];
}

export function getAddresses(
  chainId: number = APP_CHAIN_ID,
): NftCdpAddresses | null {
  const raw = getDeployment(chainId)?.addresses;
  if (!raw?.nftCdp || raw.nftCdp === ZERO_ADDRESS) {
    return null;
  }
  return {
    rusd: raw.rusd as Address,
    rsrv: (raw.rsrv as Address) || ZERO_ADDRESS,
    rsrvStaking: (raw.rsrvStaking as Address) || ZERO_ADDRESS,
    stabilityPool: raw.stabilityPool as Address,
    nftCdp: raw.nftCdp as Address,
    priceSigner: (raw.priceSigner as Address) || ZERO_ADDRESS,
    treasury: (raw.treasury as Address) || ZERO_ADDRESS,
    mockNft: (raw.mockNft as Address) || ZERO_ADDRESS,
    mintedTokenIds: Array.isArray(raw.mintedTokenIds)
      ? raw.mintedTokenIds.map(Number)
      : [],
    supportedCollections: Array.isArray(raw.supportedCollections)
      ? (raw.supportedCollections as Address[])
      : raw.mockNft && raw.mockNft !== ZERO_ADDRESS
        ? [raw.mockNft as Address]
        : [],
    stakingEnabled:
      raw.stakingEnabled === true ||
      (Boolean(raw.rsrvStaking) &&
        (raw.rsrvStaking as string).toLowerCase() !==
          ZERO_ADDRESS.toLowerCase()),
  };
}

/** @deprecated Liquity ETH CDP helpers — unused on Somnia NFT CDP */
export const LUSD_LIQUIDATION_RESERVE = 200n * 10n ** 18n;
export const LUSD_MINIMUM_NET_DEBT = 1800n * 10n ** 18n;

export function isTestnetPriceFeed(_chainId?: number) {
  return true;
}
