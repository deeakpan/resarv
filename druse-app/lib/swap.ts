import { getDeployment, DEFAULT_CHAIN_ID, type LiveVault } from "@/lib/druse";

export function getWethAddress(chainId = DEFAULT_CHAIN_ID) {
  const weth = getDeployment(chainId).uniswapV4?.weth;
  return (weth ?? "0x4200000000000000000000000000000000000006").toLowerCase();
}

export function isWeth(address: string, chainId = DEFAULT_CHAIN_ID) {
  return address.toLowerCase() === getWethAddress(chainId);
}

export function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function swapPath(input: string, output: string) {
  return `/swap?in=${input}&out=${output}`;
}

export function addLiqPath(
  token?: string | null,
  amounts?: { p?: string; eth?: string },
) {
  if (!token || isWeth(token)) return "/pools/new";
  const q = new URLSearchParams({ token });
  if (amounts?.p) q.set("p", amounts.p);
  if (amounts?.eth) q.set("eth", amounts.eth);
  return `/pools/new?${q}`;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type SwapToken = {
  address: string;
  symbol: string;
  name: string;
  image: string | null;
  floorEth: number | null;
  floorUsd: number | null;
};

export const ETH_TOKEN: SwapToken = {
  address: getWethAddress(),
  symbol: "ETH",
  name: "Ether",
  image: "/eth.svg?v=3",
  floorEth: null,
  floorUsd: null,
};

export function vaultToken(v: LiveVault): SwapToken {
  return {
    address: v.vault.toLowerCase(),
    symbol: v.symbol,
    name: v.name,
    image: v.image || v.art,
    floorEth: v.floorEth,
    floorUsd: v.floorUsd,
  };
}

export function tokenFromCa(ca: string | null | undefined, vaults: LiveVault[]): SwapToken | null {
  if (!ca) return null;
  const lower = ca.toLowerCase();
  if (isWeth(lower)) return ETH_TOKEN;
  const match = vaults.find(
    (v) =>
      v.vault.toLowerCase() === lower ||
      v.asset.toLowerCase() === lower ||
      v.id?.toLowerCase() === lower ||
      v.symbol.toLowerCase() === lower,
  );
  return match ? vaultToken(match) : null;
}
