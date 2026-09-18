"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import {
  erc20Abi,
  nftCdpAbi,
  rsrvStakingAbi,
  stabilityPoolAbi,
} from "@/lib/abi";
import { DECIMAL_PRECISION, getAddresses, NFT_BORROW_FEE } from "@/lib/contracts";
import { APP_CHAIN_ID } from "@/config/appkit";

export function useProtocol(chainId: number = APP_CHAIN_ID) {
  const { address } = useAccount();
  const activeChainId = chainId;
  const addresses = getAddresses(activeChainId);
  const enabled = Boolean(addresses);
  const stakingLive = Boolean(
    addresses?.stakingEnabled &&
      addresses.rsrv !==
        "0x0000000000000000000000000000000000000000" &&
      addresses.rsrvStaking !==
        "0x0000000000000000000000000000000000000000",
  );

  const eth = useBalance({
    address,
    chainId: activeChainId,
    query: { enabled: Boolean(address) },
  });

  const rusdSupply = useReadContract({
    address: addresses?.rusd,
    abi: erc20Abi,
    functionName: "totalSupply",
    chainId: activeChainId,
    query: { enabled, refetchInterval: 12_000 },
  });

  const rsrvSupply = useReadContract({
    address: addresses?.rsrv,
    abi: erc20Abi,
    functionName: "totalSupply",
    chainId: activeChainId,
    query: { enabled: enabled && stakingLive, refetchInterval: 12_000 },
  });

  const rusdInSp = useReadContract({
    address: addresses?.stabilityPool,
    abi: stabilityPoolAbi,
    functionName: "totalDeposits",
    chainId: activeChainId,
    query: { enabled, refetchInterval: 12_000 },
  });

  const stakedRsrv = useReadContract({
    address: addresses?.rsrvStaking,
    abi: rsrvStakingAbi,
    functionName: "totalStaked",
    chainId: activeChainId,
    query: { enabled: enabled && stakingLive, refetchInterval: 12_000 },
  });

  const borrowFeeRead = useReadContract({
    address: addresses?.nftCdp,
    abi: nftCdpAbi,
    functionName: "BORROW_FEE",
    chainId: activeChainId,
    query: { enabled, refetchInterval: 60_000 },
  });

  const userEnabled = enabled && Boolean(address);

  const rusdBalance = useReadContract({
    address: addresses?.rusd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled, refetchInterval: 12_000 },
  });

  const rsrvBalance = useReadContract({
    address: addresses?.rsrv,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled && stakingLive, refetchInterval: 12_000 },
  });

  const spDeposit = useReadContract({
    address: addresses?.stabilityPool,
    abi: stabilityPoolAbi,
    functionName: "compoundedDeposit",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled, refetchInterval: 12_000 },
  });

  const spPending = useReadContract({
    address: addresses?.stabilityPool,
    abi: stabilityPoolAbi,
    functionName: "pendingRUSD",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled, refetchInterval: 12_000 },
  });

  const rsrvStake = useReadContract({
    address: addresses?.rsrvStaking,
    abi: rsrvStakingAbi,
    functionName: "stakes",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled && stakingLive, refetchInterval: 12_000 },
  });

  const stakePending = useReadContract({
    address: addresses?.rsrvStaking,
    abi: rsrvStakingAbi,
    functionName: "pendingRUSD",
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled && stakingLive, refetchInterval: 12_000 },
  });

  const rusdSpAllowance = useReadContract({
    address: addresses?.rusd,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && addresses
        ? [address, addresses.stabilityPool]
        : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled, refetchInterval: 12_000 },
  });

  const rusdCdpAllowance = useReadContract({
    address: addresses?.rusd,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && addresses ? [address, addresses.nftCdp] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled, refetchInterval: 12_000 },
  });

  const rsrvAllowance = useReadContract({
    address: addresses?.rsrv,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && addresses ? [address, addresses.rsrvStaking] : undefined,
    chainId: activeChainId,
    query: { enabled: userEnabled && stakingLive, refetchInterval: 12_000 },
  });

  const borrowFee = borrowFeeRead.data ?? NFT_BORROW_FEE;

  return {
    addresses,
    deployed: Boolean(addresses),
    stakingLive,
    chainId: activeChainId,
    address,
    ethBalance: eth.data?.value,
    rusdSupply: rusdSupply.data,
    rsrvSupply: rsrvSupply.data,
    rusdInSp: rusdInSp.data,
    stakedRsrv: stakedRsrv.data,
    borrowFee,
    borrowFeePct: Number((borrowFee * 10000n) / DECIMAL_PRECISION) / 100,
    rusdBalance: rusdBalance.data,
    rsrvBalance: rsrvBalance.data,
    spDeposit: spDeposit.data,
    spPending: spPending.data,
    rsrvStake: rsrvStake.data,
    stakePending: stakePending.data,
    rusdSpAllowance: rusdSpAllowance.data,
    rusdCdpAllowance: rusdCdpAllowance.data,
    rsrvAllowance: rsrvAllowance.data,
    lusdBalance: rusdBalance.data,
    lqtyBalance: rsrvBalance.data,
    lusdSupply: rusdSupply.data,
    lusdInSp: rusdInSp.data,
    stakedLqty: stakedRsrv.data,
    lqtyStake: rsrvStake.data,
    lusdAllowance: rusdSpAllowance.data,
    lqtyAllowance: rsrvAllowance.data,
    price: undefined as bigint | undefined,
    borrowingRate: borrowFee,
    borrowingRatePct: Number((borrowFee * 10000n) / DECIMAL_PRECISION) / 100,
    troveCount: undefined,
    systemColl: undefined,
    systemDebt: undefined,
    tcr: undefined,
    tcrPct: null as number | null,
    troveStatus: undefined,
    troveActive: false,
    troveColl: undefined,
    troveDebt: undefined,
    spEthGain: undefined,
    spLqtyGain: stakePending.data,
    refetch: () => {
      void eth.refetch();
      void rusdSupply.refetch();
      void rsrvSupply.refetch();
      void rusdInSp.refetch();
      void stakedRsrv.refetch();
      void borrowFeeRead.refetch();
      void rusdBalance.refetch();
      void rsrvBalance.refetch();
      void spDeposit.refetch();
      void spPending.refetch();
      void rsrvStake.refetch();
      void stakePending.refetch();
      void rusdSpAllowance.refetch();
      void rusdCdpAllowance.refetch();
      void rsrvAllowance.refetch();
    },
  };
}
