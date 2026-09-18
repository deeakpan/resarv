"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { ChainController } from "@reown/appkit-controllers";
import { type ReactNode, useState } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  METAMASK_WALLET_ID,
  druseNetwork,
  projectId,
  robinhoodRpcUrls,
  wagmiAdapter,
} from "@/config/appkit";
import { registerBrowserWallets } from "@/lib/eip6963";
import ToastHost from "@/app/components/ToastHost";

if (typeof window !== "undefined") {
  try {
    window.localStorage.setItem("@appkit/active_caip_network_id", "eip155:4663");
    window.localStorage.setItem("@appkit/active_namespace", "eip155");
  } catch {
    /* ignore quota / private mode */
  }
}

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [druseNetwork],
  defaultNetwork: druseNetwork,
  customRpcUrls: {
    "eip155:4663": robinhoodRpcUrls,
  },
  allowUnsupportedChain: false,
  enableInjected: true,
  enableEIP6963: true,
  enableWalletConnect: true,
  enableBaseAccount: false,
  enableCoinbase: false,
  allWallets: "SHOW",
  featuredWalletIds: [METAMASK_WALLET_ID],
  customWallets: [
    {
      id: METAMASK_WALLET_ID,
      name: "MetaMask",
      homepage: "https://metamask.io",
      rdns: "io.metamask",
      mobile_link: "metamask://",
      injected: [{ namespace: "eip155", injected_id: "isMetaMask" }],
    } as never,
  ],
  debug: false,
  metadata: {
    name: "Druse",
    description: "NFT floor vaults",
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
    "--apkt-accent": "#c6a35a",
    "--apkt-border-radius-master": "12px",
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
  ChainController.setRequestedCaipNetworks([druseNetwork], "eip155");
  ChainController.setActiveCaipNetwork(druseNetwork);
  registerBrowserWallets();
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
    cookies
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
