"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { type ReactNode, useState } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  METAMASK_WALLET_ID,
  ROBINHOOD_MAINNET_CHAIN_ID,
  networks,
  projectId,
  robinhoodMainnet,
  wagmiAdapter,
} from "@/config/appkit";
import ToastHost from "@/app/components/ToastHost";

const ROBINHOOD_RPC =
  process.env.NEXT_PUBLIC_RH_MAINNET_RPC?.trim() ||
  process.env.RH_MAINNET_RPC?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";

const ACTIVE_CAIP = `eip155:${ROBINHOOD_MAINNET_CHAIN_ID}` as const;

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [...networks],
  defaultNetwork: robinhoodMainnet,
  customRpcUrls: {
    [ACTIVE_CAIP]: [{ url: ROBINHOOD_RPC }],
  },
  // Don't force a chain switch (MetaMask popup) just because the wallet is on another network
  allowUnsupportedChain: true,
  enableInjected: true,
  enableEIP6963: true,
  enableWalletConnect: true,
  enableBaseAccount: false,
  enableCoinbase: false,
  enableWalletGuide: false,
  allWallets: "SHOW",
  featuredWalletIds: [METAMASK_WALLET_ID],
  metadata: {
    name: "Resarv",
    description: "NFT-backed rUSD CDP on Robinhood Chain",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : "https://resarv.xyz",
    icons: [
      typeof window !== "undefined"
        ? `${window.location.origin}/logo.png`
        : "https://resarv.xyz/logo.png",
    ],
  },
  themeMode: "dark",
  themeVariables: {
    "--apkt-accent": "#ff9900",
    "--apkt-border-radius-master": "24px",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    onramp: false,
    swaps: false,
  },
});

export default function Providers({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastHost />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
