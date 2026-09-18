import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";
import { fallback, http } from "viem";
import { injected } from "wagmi/connectors";

const ROBINHOOD_RPCS = [
  "https://rpc.mainnet.chain.robinhood.com",
] as const;

export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ||
  "00000000000000000000000000000000";

export const hasReownCloud =
  /^[0-9a-f]{32}$/i.test(projectId) && !/^0+$/.test(projectId);

export const druseNetwork = defineChain({
  id: 4663,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:4663",
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [...ROBINHOOD_RPCS],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  testnet: false,
});

/** Alias kept for callers that expect an explicit RH export. */
export const robinhoodNetwork = druseNetwork;

export const networks = [druseNetwork] as const;

export const robinhoodRpcUrls = ROBINHOOD_RPCS.map((url) => ({ url }));

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: [...networks],
  transports: {
    [druseNetwork.id]: fallback(
      ROBINHOOD_RPCS.map((url) => http(url, { timeout: 12_000 })),
      { rank: false },
    ),
  },
  customRpcUrls: {
    "eip155:4663": robinhoodRpcUrls,
  },
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({
      shimDisconnect: true,
      target: {
        id: "io.metamask",
        name: "MetaMask",
        provider(win) {
          const ethereum = (win as { ethereum?: { isMetaMask?: boolean } } | undefined)?.ethereum;
          return ethereum?.isMetaMask ? (ethereum as never) : undefined;
        },
      },
    }),
  ],
});

export const METAMASK_WALLET_ID =
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";
