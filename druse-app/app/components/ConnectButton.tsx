"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { connect, getConnectors, switchChain as switchChainAction } from "wagmi/actions";
import { useAccount, useBalance, useConfig, useSwitchChain } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/lib/druse";

async function ensureRobinhoodChain(config: ReturnType<typeof useConfig>) {
  try {
    await switchChainAction(config, { chainId: DEFAULT_CHAIN_ID });
  } catch {
    /* wallet may reject or already be on 4663 */
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
    if (!target && typeof window !== "undefined" && window.ethereum) {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      target = pick();
    }

    if (target) {
      try {
        await connect(config, { connector: target, chainId: DEFAULT_CHAIN_ID });
        await ensureRobinhoodChain(config);
        return;
      } catch (err) {
        const code =
          typeof err === "object" && err && "code" in err
            ? Number((err as { code?: number }).code)
            : 0;
        const msg = err instanceof Error ? err.message : String(err);
        if (code === 4001 || /user rejected|denied|rejected the request/i.test(msg)) return;

        // Chain may be missing in the wallet — connect first, then add/switch to RH.
        try {
          await connect(config, { connector: target });
          await ensureRobinhoodChain(config);
          return;
        } catch (err2) {
          const code2 =
            typeof err2 === "object" && err2 && "code" in err2
              ? Number((err2 as { code?: number }).code)
              : 0;
          const msg2 = err2 instanceof Error ? err2.message : String(err2);
          if (code2 === 4001 || /user rejected|denied|rejected the request/i.test(msg2)) return;
        }
      }
    }
    open();
  };
}

function formatEth(wei?: bigint) {
  if (wei == null) return "…";
  const eth = Number(wei) / 1e18;
  if (!Number.isFinite(eth) || eth === 0) return "0 ETH";
  if (eth >= 100) return `${eth.toFixed(1)} ETH`;
  if (eth >= 1) return `${eth.toFixed(3)} ETH`;
  if (eth >= 0.01) return `${eth.toFixed(4)} ETH`;
  return `${eth.toPrecision(2)} ETH`;
}

function avatarStyle(address: string) {
  const a = Number.parseInt(address.slice(2, 8), 16);
  const b = Number.parseInt(address.slice(8, 14), 16);
  return {
    background: `conic-gradient(from 210deg, hsl(${a % 360} 62% 52%), hsl(${b % 360} 48% 38%), hsl(${(a >> 4) % 360} 70% 58%))`,
  };
}

export default function ConnectButton({
  className,
  trailing,
}: {
  className?: string;
  trailing?: React.ReactNode;
}) {
  const openWallet = useOpenWallet();
  const { address, isConnected } = useAppKitAccount();

  return (
    <button
      type="button"
      onClick={() => void openWallet()}
      className={
        className ??
        "h-[38px] rounded-xl bg-[#3a3a40] px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-[#2f2f34]"
      }
    >
      <span className="pr-1">
        {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect"}
      </span>
      {trailing}
    </button>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Full-width primary Connect CTA for swap / pool / stake forms. */
export function ConnectCta({ className }: { className?: string }) {
  const openWallet = useOpenWallet();
  return (
    <button
      type="button"
      onClick={() => void openWallet()}
      className={
        className ??
        "flex h-14 w-full items-center justify-center rounded-[16px] bg-white text-[18px] font-semibold tracking-[-0.02em] text-black transition-colors hover:bg-[#f2f2f2]"
      }
    >
      Connect
    </button>
  );
}

/** Disabled full-width CTA while chain writes are paused. */
export function ComingSoonCta({ className }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      className={
        className ??
        "flex h-14 w-full cursor-not-allowed items-center justify-center rounded-[16px] bg-white text-[18px] font-semibold tracking-[-0.02em] text-black opacity-35"
      }
    >
      Coming soon
    </button>
  );
}

export function HeaderConnect({ light = false }: { light?: boolean }) {
  const openWallet = useOpenWallet();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const { data } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(isConnected && address) },
  });

  if (!isConnected || !address) {
    return (
      <div
        className={`shrink-0 rounded-full p-px md:p-[1.5px] ${
          light
            ? "bg-gradient-to-r from-[#1b1b1b] via-[#6f6f6f] to-[#1b1b1b]"
            : "bg-gradient-to-r from-[#e8c547] via-[#f4f0d8] to-[#c6a35a]"
        }`}
      >
        <button
          type="button"
          onClick={() => void openWallet()}
          className="flex h-8 items-center gap-1.5 rounded-full bg-[#111] py-0.5 pr-0.5 pl-2.5 text-[12px] font-semibold tracking-[0.02em] text-white transition-colors hover:bg-[#1a1a1a] md:h-[38px] md:gap-2 md:pr-1 md:pl-4 md:text-[13px]"
        >
          Connect
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e8c547] text-[#1b1b1b] md:h-7 md:w-7">
            <ArrowIcon />
          </span>
        </button>
      </div>
    );
  }

  const wrongNetwork = chainId != null && chainId !== DEFAULT_CHAIN_ID;
  const label = wrongNetwork
    ? isPending
      ? "Switching…"
      : "Switch"
    : shortAddress(address);
  const desktopLabel = wrongNetwork
    ? isPending
      ? "Switching…"
      : "Switch network"
    : formatEth(data?.value);

  return (
    <button
      type="button"
      onClick={() => {
        if (wrongNetwork) {
          void switchChainAsync({ chainId: DEFAULT_CHAIN_ID }).catch(() => {
            /* user rejected add/switch */
          });
          return;
        }
        open();
      }}
      className={`flex shrink-0 items-center gap-1.5 bg-transparent p-0 md:gap-2 ${
        light
          ? "text-[#1b1b1b] hover:text-[#3a3a3a]"
          : "text-white hover:text-[#f0d36a]"
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full md:h-5 md:w-5 ${light ? "ring-1 ring-black/12" : "ring-1 ring-[#e8c547]/45"}`}
        style={avatarStyle(address)}
        aria-hidden
      />
      <span className="text-[12px] font-semibold tracking-[-0.02em] md:hidden">
        {label}
      </span>
      <span className="hidden text-[14px] font-semibold tabular-nums tracking-[-0.02em] md:inline">
        {desktopLabel}
      </span>
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 9 9 3M4.5 3H9v4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
