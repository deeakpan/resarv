"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  useAccount,
  useBalance,
  useConfig,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { formatTokenBal } from "@/lib/format-token";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { ComingSoonCta, ConnectCta } from "./ConnectButton";
import { TXS_ENABLED } from "@/lib/features";
import { TokenModal } from "./TokenPicker";
import {
  DEFAULT_CHAIN_ID,
  FACTORY_ABI,
  VAULT_ABI,
  getDeployment,
  getFactoryAddress,
  poolPath,
  type LiveVault,
} from "@/lib/druse";
import { ETH_TOKEN, addLiqPath, isWeth, tokenFromCa, type SwapToken } from "@/lib/swap";
import {
  ERC20_ABI,
  LAUNCHER_ABI,
  POSITION_MANAGER_ABI,
  STATE_VIEW_ABI,
  encodeMint,
  initSqrtFromFloor,
  numToWei,
  poolIdOf,
  type LivePool,
} from "@/lib/pools";
import { getUniswap, DRUSE_TICK_SPACING } from "@/config/uniswap";
import { PERMIT2_ABI, drusePoolKey } from "@/lib/universalRouter";
import { readJson } from "@/lib/rpc";
import { coverError, estimateTxCost, gasForCall, nativeHave } from "@/lib/tx-funds";
import { invalidateWalletReads } from "@/lib/wallet-cache";
import { toastError, toastSuccess } from "./ToastHost";
import {
  amountsForLiquidity,
  fullRangeTicks,
  liquidityForAmounts,
  pTokenPriceFromTick,
  ticksAroundPct,
  ticksFromEthRange,
} from "@/lib/v4-math";

type RangeKind = "full" | "wide" | "custom";

const PRIMARY =
  "flex h-14 w-full items-center justify-center rounded-[16px] bg-white text-[18px] font-semibold tracking-[-0.02em] text-black hover:bg-[#f2f2f2] disabled:opacity-35";
const CARD = "h-fit self-start rounded-[20px] border border-[#ffffff12] bg-[#131313]";
const INSET = "rounded-[16px] bg-[#1b1b1b]";
const ZERO = "0x0000000000000000000000000000000000000000";

function keyIsLive(key?: unknown) {
  if (!Array.isArray(key)) return false;
  const currency0 = typeof key[0] === "string" ? key[0] : "";
  return Boolean(currency0 && currency0.toLowerCase() !== ZERO);
}

function formatPrice(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(3);
}

function weiToInput(wei: bigint) {
  if (wei <= 0n) return "";
  const raw = formatUnits(wei, 18);
  if (!raw.includes(".")) return raw;
  const [whole, frac] = raw.split(".");
  const trimmed = frac.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

const WALLET_PCTS = [
  { label: "10%", bps: 1_000 },
  { label: "25%", bps: 2_500 },
  { label: "50%", bps: 5_000 },
  { label: "Max", bps: 10_000 },
] as const;

const MAX_UINT160 = 2n ** 160n - 1n;
const PERMIT_SECS = 180 * 24 * 60 * 60;

function writeError(err: unknown, fallback: string) {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const e = value as {
      message?: string;
      shortMessage?: string;
      details?: string;
      cause?: unknown;
    };
    if (e.shortMessage) parts.push(e.shortMessage);
    if (e.message) parts.push(e.message);
    if (e.details) parts.push(e.details);
    if (e.cause) walk(e.cause);
  };
  walk(err);
  const text = parts.join(" ");
  if (/user rejected|denied|rejected the request/i.test(text)) return "Rejected.";
  if (/NotOperator/i.test(text)) return "Only an operator can create a pool.";
  if (/PoolExists/i.test(text)) return "This pool already exists.";
  if (/ZeroAddress/i.test(text)) return "Launcher is missing a hook or factory.";
  if (/switch chain|chain mismatch|correct chain|does not match/i.test(text)) {
    return "Switch to Robinhood Chain first.";
  }
  if (/connector not connected|connector not found|no connector/i.test(text)) {
    return "Wallet not ready. Reconnect and try again.";
  }
  if (/timed? ?out|failed to fetch|network request/i.test(text)) {
    return "RPC timed out. Try again.";
  }
  if (/insufficient funds|exceeds the balance/i.test(text)) {
    return "Not enough ETH for gas.";
  }
  const short = parts.find((p) => p && p.length < 140);
  return short || fallback;
}

export default function AddLiquidity() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const wrongNetwork = chainId != null && chainId !== DEFAULT_CHAIN_ID;
  const [pools, setPools] = useState<LivePool[]>([]);
  const [vaults, setVaults] = useState<LiveVault[]>([]);
  const [vaultsReady, setVaultsReady] = useState(false);
  const [token, setToken] = useState<SwapToken | null>(null);
  const [open, setOpen] = useState(false);
  const [amountP, setAmountP] = useState("");
  const [amountEth, setAmountEth] = useState("");
  const [last, setLast] = useState<"p" | "eth">("p");
  const [status, setStatus] = useState<string | null>(null);
  const [rangeKind, setRangeKind] = useState<RangeKind>("full");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [working, setWorking] = useState(false);
  const [startPrice, setStartPrice] = useState("");
  const [ethFirst, setEthFirst] = useState(false);
  const stepperRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(1);
  const skipScroll = useRef(false);
  const scrollTimer = useRef<number>(0);
  const goToStepRef = useRef<(n: number) => void>(() => {});
  const skipUrl = useRef(true);
  const autoOpened = useRef(false);
  const hydratedToken = useRef<string | null>(null);
  stepRef.current = step;
  const tokenQ = params.get("token");

  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const factory = getFactoryAddress(DEFAULT_CHAIN_ID);
  const launcher = d.druse?.launcher as `0x${string}` | undefined;
  const hook = d.druse?.hook as `0x${string}`;
  const weth = (d.uniswapV4?.weth ?? uni.weth) as `0x${string}`;
  const manager = (d.uniswapV4?.positionManager ?? uni.positionManager) as `0x${string}`;
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as `0x${string}`;
  const permit2 = uni.permit2;

  const { data: owner } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: FACTORY_ABI,
    functionName: "owner",
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(factory) },
  });
  const { data: isOp } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: FACTORY_ABI,
    functionName: "isOperator",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(factory && address) },
  });
  const operator = Boolean(
    address && (address.toLowerCase() === (owner ?? "").toLowerCase() || isOp),
  );
  const { data: onChainKey, refetch: refetchOnChainPool } = useReadContract({
    address: launcher,
    abi: LAUNCHER_ABI,
    functionName: "poolKeys",
    args: token ? [token.address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: {
      enabled: Boolean(launcher && token),
      refetchInterval: created ? 2000 : false,
    },
  });
  const selectedPoolId =
    token && hook
      ? poolIdOf(drusePoolKey(token.address as `0x${string}`, weth, hook))
      : undefined;
  const { refetch: refetchLiq } = useReadContract({
    address: stateView,
    abi: STATE_VIEW_ABI,
    functionName: "getLiquidity",
    args: selectedPoolId ? [selectedPoolId] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(selectedPoolId && keyIsLive(onChainKey)) },
  });

  const writeToken = (next: SwapToken | null) => {
    autoOpened.current = false;
    hydratedToken.current = null;
    skipUrl.current = true;
    setToken(next);
    setAmountP("");
    setAmountEth("");
    setCreated(false);
    setStep(1);
    setStatus(null);
    setStartPrice(next?.floorEth && next.floorEth > 0 ? String(next.floorEth) : "");
    const slug =
      (next &&
        vaults.find((v) => v.vault.toLowerCase() === next.address.toLowerCase())?.id) ||
      next?.address;
    router.replace(addLiqPath(slug), { scroll: false });
  };

  const refreshPools = () =>
    Promise.all([
      fetch("/api/pools").then((r) => readJson<{ pools?: LivePool[] }>(r, { pools: [] })),
      fetch("/api/vaults").then((r) => readJson<{ vaults?: LiveVault[] }>(r, { vaults: [] })),
    ]).then(([poolData, vaultData]) => {
      const nextVaults = vaultData.vaults ?? [];
      const nextPools = poolData.pools ?? [];
      setVaults(nextVaults);
      setPools(nextPools);
      return { nextVaults, nextPools };
    });

  useEffect(() => {
    let cancelled = false;
    refreshPools()
      .then(({ nextVaults }) => {
        if (cancelled) return;
        const fromQuery = tokenFromCa(tokenQ, nextVaults);
        if (fromQuery && !isWeth(fromQuery.address)) {
          setToken(fromQuery);
          if (fromQuery.floorEth && fromQuery.floorEth > 0) {
            setStartPrice(String(fromQuery.floorEth));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setVaultsReady(true);
      });
    return () => {
      cancelled = true;
    };
    // Amounts are not re-read from the URL on every replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vaultsReady) return;
    const key = tokenQ ?? "";
    if (!key) return;
    if (hydratedToken.current === key) return;
    hydratedToken.current = key;
    const fromQuery = tokenFromCa(tokenQ, vaults);
    if (fromQuery && !isWeth(fromQuery.address)) {
      setToken(fromQuery);
    }
    skipUrl.current = true;
    const p = params.get("p");
    const eth = params.get("eth");
    if (p) {
      setLast("p");
      setAmountP(p);
    } else if (eth) {
      setLast("eth");
      setAmountEth(eth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultsReady, tokenQ]);

  const pool = pools.find((p) => p.vault.vault.toLowerCase() === token?.address);
  const onChainExists = keyIsLive(onChainKey);
  const poolExists = onChainExists || Boolean(pool?.exists) || created;
  const missing = Boolean(token && !poolExists);
  const createFlow = missing || created;
  const liveAdd = Boolean(token && poolExists && !created && !missing);
  const steps = createFlow
    ? [
        { n: 1, label: "Create v4 pool" },
        { n: 2, label: "Prefill amount" },
        { n: 3, label: "Set range" },
      ]
    : [
        { n: 1, label: "Select token pair and fees" },
        { n: 2, label: "Set price range and deposit amounts" },
      ];

  useEffect(() => {
    if (!createFlow && step > 2) setStep(2);
  }, [createFlow, step]);

  const scrollToStep = (n: number) => {
    const el = stepperRef.current;
    if (!el || !el.clientWidth) return;
    skipScroll.current = true;
    el.scrollTo({ left: (n - 1) * el.clientWidth, behavior: "smooth" });
    window.setTimeout(() => {
      skipScroll.current = false;
    }, 420);
  };

  useEffect(() => {
    scrollToStep(step);
  }, [step, steps.length]);

  const onStepScroll = () => {
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = stepperRef.current;
      if (!el || skipScroll.current || !el.clientWidth) return;
      const n = Math.round(el.scrollLeft / el.clientWidth) + 1;
      const current = stepRef.current;
      if (n === current || n < 1 || n > steps.length) return;
      if (n > current) {
        goToStepRef.current(n);
        return;
      }
      setStep(n);
    }, 70);
  };

  const mid = pool?.priceEth ?? pool?.vault.floorEth ?? 0;
  const pIs0 = pool?.pTokenIs0 ?? true;
  const sqrt = pool ? BigInt(pool.sqrtPriceX96 || "0") : 0n;
  const range = useMemo(() => {
    if (rangeKind === "wide") return ticksAroundPct(mid, 0.5, pIs0, DRUSE_TICK_SPACING);
    if (rangeKind === "custom") {
      return ticksFromEthRange(Number(minPrice) || 0, Number(maxPrice) || 0, pIs0, DRUSE_TICK_SPACING);
    }
    return fullRangeTicks(DRUSE_TICK_SPACING);
  }, [rangeKind, mid, pIs0, minPrice, maxPrice]);

  const { data: pBal } = useReadContract({
    address: token?.address as `0x${string}` | undefined,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && token) },
  });
  const { data: ethBal } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const { data: pTokenAllow, refetch: refetchPAllow } = useReadContract({
    address: token?.address as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && token ? [address as `0x${string}`, permit2] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && token) },
  });
  const { data: p2Allow, refetch: refetchP2 } = useReadContract({
    address: permit2,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args:
      address && token
        ? [address as `0x${string}`, token.address as `0x${string}`, manager]
        : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: Boolean(address && token) },
  });

  const quote = useMemo(() => {
    if (!pool?.exists || sqrt === 0n) return { p: 0, eth: 0, liq: 0n, a0: 0n, a1: 0n };
    const typed = last === "p" ? Number(amountP) || 0 : Number(amountEth) || 0;
    if (typed <= 0) return { p: 0, eth: 0, liq: 0n, a0: 0n, a1: 0n };
    const seed = numToWei(typed);
    const amount0 = last === "p" ? (pIs0 ? seed : 10n ** 36n) : pIs0 ? 10n ** 36n : seed;
    const amount1 = last === "p" ? (pIs0 ? 10n ** 36n : seed) : pIs0 ? seed : 10n ** 36n;
    const liq = liquidityForAmounts(sqrt, range.tickLower, range.tickUpper, amount0, amount1);
    const { amount0: a0, amount1: a1 } = amountsForLiquidity(sqrt, range.tickLower, range.tickUpper, liq);
    return {
      p: Number(pIs0 ? a0 : a1) / 1e18,
      eth: Number(pIs0 ? a1 : a0) / 1e18,
      liq,
      a0,
      a1,
    };
  }, [pool, sqrt, last, amountP, amountEth, pIs0, range.tickLower, range.tickUpper]);

  useEffect(() => {
    if (!quote.liq || working) return;
    if (last === "p") {
      const next = quote.eth > 0 ? String(Number(quote.eth.toPrecision(6))) : "";
      setAmountEth((cur) => (cur === next ? cur : next));
    } else {
      const next = quote.p > 0 ? String(Number(quote.p.toPrecision(6))) : "";
      setAmountP((cur) => (cur === next ? cur : next));
    }
  }, [quote.liq, quote.eth, quote.p, last, working]);

  useEffect(() => {
    if (!vaultsReady || !token || working) return;
    if (skipUrl.current) {
      skipUrl.current = false;
      return;
    }
    const slug =
      vaults.find((v) => v.vault.toLowerCase() === token.address.toLowerCase())?.id ??
      token.address;
    const t = window.setTimeout(() => {
      router.replace(
        addLiqPath(slug, {
          ...(last === "p" ? { p: amountP || undefined } : { eth: amountEth || undefined }),
        }),
        { scroll: false },
      );
    }, 250);
    return () => window.clearTimeout(t);
    // vaults omitted: identity changes must not rewrite the URL while typing/approving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultsReady, token, amountP, amountEth, last, router, working]);

  const slip0 = quote.liq ? (quote.a0 * 102n) / 100n + 1n : 0n;
  const slip1 = quote.liq ? (quote.a1 * 102n) / 100n + 1n : 0n;
  const ethNeed = quote.liq ? (pIs0 ? slip1 : slip0) : 0n;
  const pNeed = quote.liq ? (pIs0 ? slip0 : slip1) : 0n;
  const pHave = pBal ?? 0n;
  const ethHave = ethBal?.value ?? 0n;
  const [gasCost, setGasCost] = useState(0n);

  useEffect(() => {
    if (!address || !quote.liq || !poolExists) {
      setGasCost(0n);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      void estimateTxCost({
        account: address as `0x${string}`,
        to: manager,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: ["0x", BigInt(Math.floor(Date.now() / 1000) + 600)],
        value: ethNeed,
        fallbackGas: 900_000n,
      })
        .then((cost) => {
          if (live) setGasCost(cost);
        })
        .catch(() => {
          if (live) setGasCost(0n);
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [address, quote.liq, poolExists, manager, ethNeed]);

  const fundsBlock = coverError(pHave, pNeed, "token")
    ? `Insufficient ${token?.symbol ?? "pTOKEN"}`
    : coverError(ethHave, ethNeed + gasCost, "gas");
  const needApprove =
    quote.liq > 0n &&
    ((pTokenAllow ?? 0n) < pNeed ||
      !p2Allow ||
      p2Allow[0] < pNeed ||
      Number(p2Allow[1]) < Math.floor(Date.now() / 1000) + 60);

  const fillP = (bps: number) => {
    const wei = ((pBal ?? 0n) * BigInt(bps)) / 10_000n;
    setLast("p");
    setAmountP(weiToInput(wei));
  };
  const fillEth = (bps: number) => {
    let wei = ((ethBal?.value ?? 0n) * BigInt(bps)) / 10_000n;
    if (bps === 10_000) {
      const buffer = gasCost > 0n ? gasCost : parseUnits("0.001", 18);
      wei = wei > buffer ? wei - buffer : 0n;
    }
    setLast("eth");
    setAmountEth(weiToInput(wei));
  };

  const seedRange = () => {
    setRangeKind("full");
    setMinPrice(mid > 0 ? formatPrice(mid * 0.5) : "");
    setMaxPrice(mid > 0 ? formatPrice(mid * 1.5) : "");
  };

  useEffect(() => {
    if (autoOpened.current || !tokenQ) return;
    if (!token || !liveAdd) return;
    autoOpened.current = true;
    seedRange();
    setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, liveAdd, tokenQ]);

  const startEth = Number(startPrice) || pool?.vault.floorEth || 0;

  const goToStep = async (n: number) => {
    if (n === step) return;
    if (n < 1 || n > steps.length) return;
    if (n < step) {
      setStatus(null);
      setStep(n);
      return;
    }
    if (!token) {
      setStatus("Select a token first.");
      return;
    }
    setChecking(true);
    setStatus(null);
    try {
      const { data: key } = await refetchOnChainPool();
      const live = keyIsLive(key) || created || Boolean(pool?.exists);
      if (!live) {
        setStatus("No pool for this token yet.");
        setStep(1);
        scrollToStep(1);
        return;
      }
      await refetchLiq();
      await refreshPools();
      seedRange();
      setStep(n);
    } finally {
      setChecking(false);
    }
  };
  goToStepRef.current = (n) => {
    void goToStep(n);
  };

  const ensureChain = async () => {
    if (chainId === DEFAULT_CHAIN_ID) return;
    await switchChainAsync({ chainId: DEFAULT_CHAIN_ID });
  };

  const createPool = async () => {
    if (!launcher || !hook || !token || !pool) return;
    const nextSqrt = initSqrtFromFloor(startEth, token.address, weth);
    if (nextSqrt === 0n) {
      setStatus("Set a start price.");
      return;
    }
    setWorking(true);
    setStatus("Creating pool");
    try {
      await ensureChain();
      const hash = await writeContractAsync({
        address: launcher,
        abi: LAUNCHER_ABI,
        functionName: "createPool",
        args: [token.address as `0x${string}`, nextSqrt],
        chainId: DEFAULT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash, chainId: DEFAULT_CHAIN_ID });
      setPools((prev) =>
        prev.map((row) =>
          row.vault.vault.toLowerCase() === token.address.toLowerCase()
            ? { ...row, exists: true, sqrtPriceX96: nextSqrt.toString(), priceEth: startEth }
            : row,
        ),
      );
      setCreated(true);
      setStatus(null);
      seedRange();
      setStep(2);
      void refetchOnChainPool();
      void refetchLiq();
      void refreshPools();
      toastSuccess("Pool created", { detail: "Set a range and deposit next." });
    } catch (err) {
      const msg = writeError(err, "Create failed.");
      setStatus(msg);
      toastError("Could not create pool", { detail: msg });
    } finally {
      setWorking(false);
    }
  };

  const depositPlan = () => {
    if (!address || !token || !quote.liq) return null;
    const slip0 = (quote.a0 * 102n) / 100n + 1n;
    const slip1 = (quote.a1 * 102n) / 100n + 1n;
    return {
      account: address as `0x${string}`,
      pPay: pIs0 ? slip0 : slip1,
      ethPay: pIs0 ? slip1 : slip0,
      slip0,
      slip1,
    };
  };

  const sendWrite = async (req: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
    fallbackGas: bigint;
  }) => {
    const account = address as `0x${string}`;
    const gas = await gasForCall({
      account,
      to: req.address,
      abi: req.abi as Parameters<typeof gasForCall>[0]["abi"],
      functionName: req.functionName,
      args: req.args,
      value: req.value,
      fallbackGas: req.fallbackGas,
    });
    return writeContractAsync({
      address: req.address,
      abi: req.abi,
      functionName: req.functionName,
      args: req.args,
      value: req.value,
      gas,
      account,
      chainId: DEFAULT_CHAIN_ID,
    } as Parameters<typeof writeContractAsync>[0]);
  };

  const approve = async () => {
    const plan = depositPlan();
    if (!plan || !token) return;
    setWorking(true);
    setStatus("Approving");
    try {
      await ensureChain();
      if ((pTokenAllow ?? 0n) < plan.pPay) {
        setStatus("Approving token");
        const hash = await sendWrite({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [permit2, maxUint256],
          fallbackGas: 80_000n,
        });
        await waitForTransactionReceipt(config, { hash, chainId: DEFAULT_CHAIN_ID });
        await refetchPAllow();
      }
      const now = Math.floor(Date.now() / 1000);
      const p2ok =
        p2Allow &&
        p2Allow[0] >= plan.pPay &&
        Number(p2Allow[1]) > now + 60;
      if (!p2ok) {
        setStatus("Allowing deposit");
        const hash = await sendWrite({
          address: permit2,
          abi: PERMIT2_ABI,
          functionName: "approve",
          args: [
            token.address as `0x${string}`,
            manager,
            MAX_UINT160,
            now + PERMIT_SECS,
          ],
          fallbackGas: 60_000n,
        });
        await waitForTransactionReceipt(config, { hash, chainId: DEFAULT_CHAIN_ID });
        await refetchP2();
      }
      setStatus(null);
      toastSuccess("Approved", { detail: "You can add liquidity now." });
    } catch (err) {
      const msg = writeError(err, "Approve failed.");
      setStatus(msg);
      toastError("Approve failed", { detail: msg });
    } finally {
      setWorking(false);
    }
  };

  const add = async () => {
    if (!token || !pool?.exists || !quote.liq) return;
    const plan = depositPlan();
    if (!plan) return;
    if (pHave < plan.pPay) {
      const msg = `Insufficient ${token.symbol}`;
      setStatus(msg);
      toastError(msg);
      return;
    }
    setWorking(true);
    setStatus("Preparing");
    try {
      await ensureChain();
      const key = drusePoolKey(token.address as `0x${string}`, weth, hook);
      const data = encodeMint({
        key,
        tickLower: range.tickLower,
        tickUpper: range.tickUpper,
        liquidity: quote.liq,
        amount0Max: plan.slip0,
        amount1Max: plan.slip1,
        owner: plan.account,
        weth,
      });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const mintCost = await estimateTxCost({
        account: plan.account,
        to: manager,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: [data, deadline],
        value: plan.ethPay,
        fallbackGas: 900_000n,
      });
      const have = await nativeHave(plan.account);
      if (have < plan.ethPay + mintCost) {
        setStatus("Not enough ETH for gas");
        toastError("Not enough ETH for gas");
        return;
      }
      setStatus("Minting position");
      const gas = await gasForCall({
        account: plan.account,
        to: manager,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: [data, deadline],
        value: plan.ethPay,
        fallbackGas: 900_000n,
      });
      const mint = await writeContractAsync({
        address: manager,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: [data, deadline],
        value: plan.ethPay,
        gas,
        account: plan.account,
        chainId: DEFAULT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash: mint, chainId: DEFAULT_CHAIN_ID });
      await invalidateWalletReads(queryClient);
      setStatus(null);
      toastSuccess("Position opened", {
        detail: "ETH was wrapped in the deposit. Your liquidity is live.",
        href: "/positions",
        hrefLabel: "View positions",
      });
    } catch (err) {
      const msg = writeError(err, "Deposit failed.");
      setStatus(msg);
      toastError("Deposit failed", { detail: msg });
    } finally {
      setWorking(false);
    }
  };

  const rangeLabel =
    rangeKind === "full"
      ? "Full"
      : rangeKind === "wide"
        ? "Wide"
        : `${formatPrice(pTokenPriceFromTick(range.tickLower, pIs0))} to ${formatPrice(pTokenPriceFromTick(range.tickUpper, pIs0))}`;

  const openToken = () => setOpen(true);

  const inFlight = working || isPending || checking;
  const showPair = step === 1;
  const showAmounts = createFlow ? step === 2 : step === 2;
  const showRange = createFlow ? step === 3 : step === 2;

  return (
    <main className="w-full flex-1 bg-[#131313]">
      <div className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-8">
      <div>
          <div className="text-[14px] text-[#9b9b9b]">
            <Link href="/pools" className="hover:text-white">
              Pools
            </Link>
            {liveAdd && pool ? (
              <>
                <span className="px-1.5 text-[#5e5e5e]">&gt;</span>
                <Link href={poolPath(pool.vault)} className="hover:text-white">
                  {token?.symbol} / ETH
                </Link>
                <span className="px-1.5 text-[#5e5e5e]">&gt;</span>
                Add liquidity
              </>
            ) : (
              <>
                <span className="px-1.5 text-[#5e5e5e]">&gt;</span>
                New position
              </>
            )}
          </div>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-white">
            {liveAdd ? "Add liquidity" : "New position"}
          </h1>
      </div>

      <div className="mt-6 flex flex-col items-start gap-4 md:flex-row">
        <aside className={`${CARD} w-full px-5 py-5 md:w-[280px]`}>
          <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Steps</div>
          <div
            ref={stepperRef}
            onScroll={onStepScroll}
            className="no-scrollbar mt-3 flex snap-x snap-mandatory overflow-x-auto"
          >
            {steps.map((s) => {
              const reached = s.n <= step;
              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => void goToStep(s.n)}
                  className="flex w-full min-w-full snap-start items-center gap-3 bg-transparent p-0 text-left"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold leading-none ${
                      reached
                        ? "bg-white text-black"
                        : "bg-[#1b1b1b] text-[#9b9b9b] ring-1 ring-[#ffffff12]"
                    }`}
                  >
                    {s.n}
                  </span>
                  <div
                    className={`min-w-0 text-[16px] leading-5 tracking-[-0.02em] ${
                      reached ? "text-white" : "text-[#9b9b9b]"
                    }`}
                  >
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-1.5">
            {steps.map((s) => (
              <button
                key={s.n}
                type="button"
                aria-label={`Step ${s.n}`}
                onClick={() => void goToStep(s.n)}
                className={`h-1.5 rounded-full transition-all ${
                  s.n === step
                    ? "w-4 bg-white"
                    : s.n === step + 1
                      ? "w-1.5 bg-[#9b9b9b] hover:bg-white"
                      : s.n < step
                        ? "w-1.5 bg-[#9b9b9b] hover:bg-white"
                        : "w-1.5 bg-[#3d3d3d] hover:bg-[#9b9b9b]"
                }`}
              />
            ))}
          </div>
        </aside>

        <section className={`${CARD} w-full px-4 py-5 sm:px-6 md:ml-auto md:w-[568px]`}>
          {showPair ? (
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Select pair</div>
                  <span className="text-[14px] text-[#9b9b9b]">Uniswap v4</span>
                </div>
                <p className="mt-1 text-[14px] leading-5 text-[#9b9b9b]">
                  {createFlow
                    ? "Choose the tokens you want to provide liquidity for."
                    : "Add liquidity to this Uniswap v4 pool."}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <PairSlot token={ETH_TOKEN} />
                  <PairSlot
                    token={token}
                    placeholder="Select token"
                    onClick={openToken}
                  />
                </div>
              </div>
              <div>
                <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Fee tier</div>
                <p className="mt-1 text-[14px] leading-5 text-[#9b9b9b]">
                  Druse pools always use the 1% recommended tier.
                </p>
                <div className="mt-3 rounded-[16px] border border-[#ffffff12] bg-[#1b1b1b] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-medium text-white">1% fee tier</span>
                    <span className="rounded-full bg-[#ffffff12] px-2 py-0.5 text-[12px] font-medium text-white">
                      Recommended
                    </span>
                  </div>
                  <div className="mt-1 text-[14px] text-[#9b9b9b]">The % you will earn in fees.</div>
                </div>
              </div>
              {missing ? (
                <div>
                  <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Start price</div>
                  <label className="mt-3 flex items-center gap-3 rounded-[16px] border border-[#ffffff12] bg-[#1b1b1b] px-4 py-3">
                    <input
                      value={startPrice}
                      onChange={(e) => setStartPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder={pool?.vault.floorEth ? String(pool.vault.floorEth) : "0.00"}
                      className="w-0 min-w-0 flex-1 bg-transparent text-[18px] font-medium text-white outline-none placeholder:text-[#5e5e5e]"
                    />
                    <span className="shrink-0 text-[14px] text-[#9b9b9b]">ETH / {token?.symbol ?? "pTOKEN"}</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {showRange ? (
            <div className={`flex flex-col gap-3 ${showPair ? "mt-6" : ""}`}>
              <div>
                <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Set range</div>
                <p className="mt-1 text-[14px] leading-5 text-[#9b9b9b]">
                  Current {formatPrice(mid)} ETH / {token?.symbol ?? "pTOKEN"}
                </p>
              </div>
              <RangeDropdown value={rangeKind} onChange={setRangeKind} />
              {rangeKind === "custom" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className={`${INSET} px-4 py-3`}>
                    <div className="text-[12px] text-[#9b9b9b]">Min</div>
                    <input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="mt-1 w-full bg-transparent text-[18px] font-medium text-white outline-none placeholder:text-[#5e5e5e]"
                    />
                  </label>
                  <label className={`${INSET} px-4 py-3`}>
                    <div className="text-[12px] text-[#9b9b9b]">Max</div>
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="mt-1 w-full bg-transparent text-[18px] font-medium text-white outline-none placeholder:text-[#5e5e5e]"
                    />
                  </label>
                </div>
              ) : (
                <div className={`${INSET} px-4 py-3 text-[14px] text-[#9b9b9b]`}>{rangeLabel} range</div>
              )}
            </div>
          ) : null}

          {showAmounts ? (
            <div className={`flex flex-col gap-2 ${showRange || showPair ? "mt-6" : ""}`}>
              <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Deposit</div>
              <p className="text-[13px] leading-5 text-[#9b9b9b]">
                ETH wraps to WETH in this transaction. First time only, you approve Permit2 so the
                pool can pull your {token?.symbol ?? "pTOKEN"}.
              </p>
              <div className="relative">
                {ethFirst ? (
                  <DepositCard
                    label="ETH"
                    value={amountEth}
                    onChange={(v) => {
                      setLast("eth");
                      setAmountEth(v);
                    }}
                    token={ETH_TOKEN}
                    have={ethBal?.value ?? 0n}
                    onFill={fillEth}
                    connected={Boolean(address)}
                  />
                ) : (
                  <DepositCard
                    label={token?.symbol ?? "pTOKEN"}
                    value={amountP}
                    onChange={(v) => {
                      setLast("p");
                      setAmountP(v);
                    }}
                    token={token}
                    have={pBal ?? 0n}
                    onFill={fillP}
                    connected={Boolean(address)}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setEthFirst((v) => !v)}
                  className="absolute top-full left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] border-4 border-[#131313] bg-[#1b1b1b] text-white hover:bg-[#222]"
                  aria-label="Switch token order"
                >
                  <FlipIcon />
                </button>
              </div>
              <div className="mt-[2px]">
                {ethFirst ? (
                  <DepositCard
                    label={token?.symbol ?? "pTOKEN"}
                    value={amountP}
                    onChange={(v) => {
                      setLast("p");
                      setAmountP(v);
                    }}
                    token={token}
                    have={pBal ?? 0n}
                    onFill={fillP}
                    connected={Boolean(address)}
                  />
                ) : (
                  <DepositCard
                    label="ETH"
                    value={amountEth}
                    onChange={(v) => {
                      setLast("eth");
                      setAmountEth(v);
                    }}
                    token={ETH_TOKEN}
                    have={ethBal?.value ?? 0n}
                    onFill={fillEth}
                    connected={Boolean(address)}
                  />
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            {!TXS_ENABLED ? (
              <ComingSoonCta />
            ) : !isConnected ? (
              <ConnectCta />
            ) : wrongNetwork ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => void switchChainAsync({ chainId: DEFAULT_CHAIN_ID })}
                className={PRIMARY}
              >
                Switch to Robinhood Chain
              </button>
            ) : step === 1 && missing && !operator ? (
              <div className="flex h-14 items-center justify-center rounded-[16px] bg-[#1b1b1b] text-[18px] font-medium text-[#9b9b9b]">
                Only an operator can create this pool
              </div>
            ) : step === 1 && missing ? (
              <button
                type="button"
                disabled={!token || startEth <= 0 || isPending || working}
                onClick={() => void createPool()}
                className={PRIMARY}
              >
                {isPending || working ? <ButtonSpinner /> : !token ? "Select a token" : "Create pool"}
              </button>
            ) : step === 1 ? (
              <button
                type="button"
                disabled={!token || !poolExists || checking}
                onClick={() => void goToStep(2)}
                className={PRIMARY}
              >
                {checking ? <ButtonSpinner /> : !token ? "Select a token" : "Continue"}
              </button>
            ) : createFlow && step === 2 ? (
              <button
                type="button"
                disabled={!quote.liq || checking}
                onClick={() => void goToStep(3)}
                className={PRIMARY}
              >
                {checking ? <ButtonSpinner /> : quote.liq ? "Continue" : "Enter an amount"}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  !quote.liq ||
                  inFlight ||
                  (needApprove
                    ? pHave < pNeed
                    : Boolean(fundsBlock))
                }
                onClick={() => void (needApprove ? approve() : add())}
                className={PRIMARY}
              >
                {inFlight ? (
                  <span className="flex items-center gap-2">
                    <ButtonSpinner />
                    {status ?? "Working…"}
                  </span>
                ) : !quote.liq ? (
                  "Enter an amount"
                ) : needApprove ? (
                  pHave < pNeed ? `Insufficient ${token?.symbol ?? "pTOKEN"}` : "Approve"
                ) : fundsBlock ? (
                  fundsBlock
                ) : (
                  "Add liquidity"
                )}
              </button>
            )}
            {status && !inFlight ? (
              <div className="mt-3 text-center text-[13px] text-white/50">{status}</div>
            ) : null}
          </div>
        </section>
      </div>

      {open ? (
        <TokenModal
          vaults={vaults}
          tokensOnly
          loading={!vaultsReady}
          onClose={() => setOpen(false)}
          onPick={(t) => {
            if (!isWeth(t.address)) writeToken(t);
            setOpen(false);
          }}
        />
      ) : null}
      </div>
    </main>
  );
}

function ButtonSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path
        d="M17 10a7 7 0 0 0-7-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RangeDropdown({
  value,
  onChange,
}: {
  value: RangeKind;
  onChange: (next: RangeKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label = value === "full" ? "Full" : value === "wide" ? "Wide" : "Custom";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${INSET} flex h-10 w-full items-center justify-between px-4 text-[14px] font-medium text-white`}
      >
        <span>{label}</span>
        <span className={`text-[#9b9b9b] transition-transform ${open ? "rotate-180" : ""}`}>
          <Chevron />
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-[16px] border border-[#ffffff12] bg-[#1b1b1b] py-1"
        >
          {(["full", "wide", "custom"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={id === value}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
              className={`flex h-10 w-full items-center px-4 text-left text-[14px] font-medium capitalize ${
                id === value ? "bg-white/8 text-white" : "text-[#9b9b9b] hover:bg-white/4 hover:text-white"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DepositCard({
  label,
  value,
  onChange,
  token,
  have,
  onFill,
  connected,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  token: SwapToken | null;
  have: bigint;
  onFill: (bps: number) => void;
  connected: boolean;
}) {
  return (
    <div className="group rounded-[20px] border border-[#ffffff12] bg-[#1b1b1b] px-4 pt-[14px] pb-3 transition-colors duration-200 hover:bg-[#232323]">
      <div className="relative mb-1 min-h-[20px]">
        <div className="text-[14px] text-[#9b9b9b]">{label}</div>
        <div className="pointer-events-none absolute top-0 right-0 flex translate-y-1 items-center gap-2 text-[13px] font-medium text-white/40 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {WALLET_PCTS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={!connected || have <= 0n}
              onClick={() => onFill(p.bps)}
              className="hover:text-white disabled:opacity-35"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.00"
          className="w-0 min-w-0 flex-1 bg-transparent text-[28px] font-medium tracking-tight text-white outline-none placeholder:text-[#5e5e5e]"
        />
        <PairChip token={token} />
      </div>
      <div className="mt-1 text-[14px] text-[#5e5e5e]">Balance {formatTokenBal(have)}</div>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M5 3.5 3 5.5l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 5.5h8.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 12.5 13 10.5l-2-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.8 10.5H4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PairSlot({
  token,
  placeholder,
  onClick,
}: {
  token: SwapToken | null;
  placeholder?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        {token?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
        ) : null}
        <span className="whitespace-nowrap text-[16px] font-medium">{token?.symbol ?? placeholder}</span>
      </span>
      {onClick ? <Chevron /> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={`${INSET} flex h-12 w-full items-center px-3 text-white`}>{inner}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${INSET} flex h-12 w-full min-w-0 items-center justify-between gap-2 px-3 text-white hover:bg-[#232323]`}
    >
      {inner}
    </button>
  );
}

function PairChip({ token }: { token: SwapToken | null }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-[#1b1b1b] py-[6px] pr-3 pl-1.5">
      {token?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : null}
      <span className="whitespace-nowrap text-[15px] font-semibold sm:text-[18px]">{token?.symbol ?? "Token"}</span>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

