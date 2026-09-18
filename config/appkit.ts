import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";
import { fallback, http } from "viem";
import { injected } from "wagmi/connectors";

export const SOMNIA_TESTNET_CHAIN_ID = 50312;
export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;

/** Active app chain — toggle via NEXT_PUBLIC_DEFAULT_CHAIN_ID in .env */
export const APP_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || ROBINHOOD_MAINNET_CHAIN_ID,
);

const SOMNIA_TESTNET_RPCS = [
  process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    "https://api.infra.testnet.somnia.network",
] as const;

const ROBINHOOD_RPCS = [
  process.env.NEXT_PUBLIC_RH_MAINNET_RPC?.trim() ||
    process.env.RH_MAINNET_RPC?.trim() ||
    "https://rpc.mainnet.chain.robinhood.com",
] as const;

/** @deprecated use APP_CHAIN_ID */
export const UNICHAIN_SEPOLIA_CHAIN_ID = APP_CHAIN_ID;
/** @deprecated */
export const ROBINHOOD_CHAIN_ID = APP_CHAIN_ID;
/** @deprecated */
export const ROBINHOOD_TESTNET_CHAIN_ID = APP_CHAIN_ID;

export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ||
  "00000000000000000000000000000000";

export const somniaTestnet = defineChain({
  id: SOMNIA_TESTNET_CHAIN_ID,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:50312",
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: [...SOMNIA_TESTNET_RPCS] },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: ROBINHOOD_MAINNET_CHAIN_ID,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:4663",
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [...ROBINHOOD_RPCS] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  testnet: false,
});

/** @deprecated aliases */
export const unichainSepolia = somniaTestnet;
export const robinhood = robinhoodMainnet;
export const robinhoodTestnet = somniaTestnet;

export const networks =
  APP_CHAIN_ID === SOMNIA_TESTNET_CHAIN_ID
    ? ([somniaTestnet] as const)
    : ([robinhoodMainnet] as const);

const activeNetwork = networks[0];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: [...networks],
  batch: {
    multicall: false,
  },
  transports: {
    [activeNetwork.id]: fallback(
      (APP_CHAIN_ID === SOMNIA_TESTNET_CHAIN_ID
        ? SOMNIA_TESTNET_RPCS
        : ROBINHOOD_RPCS
      ).map((url) => http(url, { timeout: 12_000 })),
      { rank: false },
    ),
  },
  customRpcUrls: {
    [`eip155:${activeNetwork.id}`]: (
      APP_CHAIN_ID === SOMNIA_TESTNET_CHAIN_ID
        ? SOMNIA_TESTNET_RPCS
        : ROBINHOOD_RPCS
    ).map((url) => ({ url })),
  },
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({
      shimDisconnect: true,
      target: {
        id: "io.metamask",
        name: "MetaMask",
        provider(win) {
          const ethereum = (
            win as { ethereum?: { isMetaMask?: boolean } } | undefined
          )?.ethereum;
          return ethereum?.isMetaMask ? (ethereum as never) : undefined;
        },
      },
    }),
  ],
});

export const METAMASK_WALLET_ID =
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";
