"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { ChainController } from "@reown/appkit-controllers";
import { type ReactNode, useState } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  METAMASK_WALLET_ID,
  networks,
  projectId,
  somniaTestnet,
  wagmiAdapter,
} from "@/config/appkit";
import ToastHost from "@/app/components/ToastHost";

const SOMNIA_RPC =
  process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC?.trim() ||
  "https://api.infra.testnet.somnia.network";

if (typeof window !== "undefined") {
  try {
    window.localStorage.setItem(
      "@appkit/active_caip_network_id",
      "eip155:50312",
    );
    window.localStorage.setItem("@appkit/active_namespace", "eip155");
  } catch {
    /* ignore */
  }
}

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [...networks],
  defaultNetwork: somniaTestnet,
  customRpcUrls: {
    "eip155:50312": [{ url: SOMNIA_RPC }],
  },
  allowUnsupportedChain: false,
  enableInjected: true,
  enableEIP6963: true,
  enableWalletConnect: true,
  enableBaseAccount: false,
  enableCoinbase: false,
  allWallets: "SHOW",
  featuredWalletIds: [METAMASK_WALLET_ID],
  metadata: {
    name: "Resarv",
    description: "NFT-backed rUSD CDP on Somnia Testnet",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000",
    icons: [
      typeof window !== "undefined"
        ? `${window.location.origin}/logo.png`
        : "http://localhost:3000/logo.png",
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

if (typeof window !== "undefined") {
  ChainController.setRequestedCaipNetworks([somniaTestnet], "eip155");
  ChainController.setActiveCaipNetwork(somniaTestnet);
}

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
