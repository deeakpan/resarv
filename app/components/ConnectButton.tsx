"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { connect, getConnectors, switchChain as switchChainAction } from "wagmi/actions";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { APP_CHAIN_ID } from "@/config/appkit";
import { shortAddress } from "@/lib/format";

async function ensureAppChain(config: ReturnType<typeof useConfig>) {
  try {
    await switchChainAction(config, { chainId: APP_CHAIN_ID });
  } catch {
    /* wallet may reject */
  }
}

function useOpenWallet() {
  const { open } = useAppKit();
  const config = useConfig();

  return async () => {
    const pick = () => {
      const list = getConnectors(config);
      return (
        list.find((c) => c.id === "io.metamask" || c.id === "io.metamask.flask") ||
        list.find((c) => /metamask/i.test(c.id) || /metamask/i.test(c.name)) ||
        list.find((c) => c.id === "injected")
      );
    };

    let target = pick();
    if (!target && typeof window !== "undefined" && "ethereum" in window) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      target = pick();
    }

    if (target) {
      try {
        await connect(config, {
          connector: target,
          chainId: APP_CHAIN_ID,
        });
        await ensureAppChain(config);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/user rejected|denied/i.test(msg)) return;
        try {
          await connect(config, { connector: target });
          await ensureAppChain(config);
          return;
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : String(err2);
          if (/user rejected|denied/i.test(msg2)) return;
        }
      }
    }
    open();
  };
}

const pill =
  "inline-flex max-w-full shrink-0 items-center justify-center rounded-full bg-[var(--input)] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm";

export default function ConnectButton({
  variant = "header",
}: {
  variant?: "header" | "page";
}) {
  const openWallet = useOpenWallet();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const wrongNetwork = chainId != null && chainId !== APP_CHAIN_ID;

  if (variant === "page" && !isConnected) {
    return (
      <button
        type="button"
        onClick={() => void openWallet()}
        className={`${pill} px-8 py-3 text-base`}
      >
        Connect
      </button>
    );
  }

  if (!isConnected || !address) {
    return (
      <button type="button" onClick={() => void openWallet()} className={pill}>
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
        open();
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
