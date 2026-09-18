"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useAccount, useSwitchChain } from "wagmi";
import { APP_CHAIN_ID } from "@/config/appkit";
import { shortAddress } from "@/lib/format";

const pill =
  "inline-flex max-w-full shrink-0 items-center justify-center rounded-full bg-[var(--input)] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm";

export default function ConnectButton({
  variant = "header",
}: {
  variant?: "header" | "page";
}) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const wrongNetwork = chainId != null && chainId !== APP_CHAIN_ID;

  if (variant === "page" && !isConnected) {
    return (
      <button
        type="button"
        onClick={() => open({ view: "Connect" })}
        className={`${pill} px-8 py-3 text-base`}
      >
        Connect
      </button>
    );
  }

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={() => open({ view: "Connect" })}
        className={pill}
      >
        Connect
      </button>
    );
  }

  const label = wrongNetwork
    ? isPending
      ? "Switching"
      : "Switch network"
    : null;

  return (
    <button
      type="button"
      onClick={() => {
        if (wrongNetwork) {
          void switchChainAsync({ chainId: APP_CHAIN_ID }).catch(() => {});
          return;
        }
        open({ view: "Account" });
      }}
      className={pill}
    >
      {label ?? (
        <>
          <span className="sm:hidden">Connected</span>
          <span className="hidden sm:inline">{shortAddress(address)}</span>
        </>
      )}
    </button>
  );
}
