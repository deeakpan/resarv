import { createPublicClient, encodeAbiParameters, http, keccak256, pad, toHex } from "viem";
import { getUniswap } from "@/config/uniswap";
import {
  DEFAULT_CHAIN_ID,
  VAULT_ABI,
  getDeployment,
  type LiveVault,
} from "@/lib/druse";
import { loadLiveVaults } from "@/lib/live-vaults";
import { robinhoodChain } from "@/lib/rpc";
import { amountsForLiquidity, feesFromGrowth, ticksFromPositionInfo } from "@/lib/v4-math";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";

const STAKING_ABI = [
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const POS_ABI = [
  {
    type: "function",
    name: "getPoolAndPositionInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

const STATE_ABI = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "getFeeGrowthInside",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
    ],
    outputs: [
      { name: "feeGrowthInside0X128", type: "uint256" },
      { name: "feeGrowthInside1X128", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPositionInfo",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
    ],
  },
] as const;

export type BoardPosition = {
  tokenId: string;
  kind: "wallet" | "lp";
  vault: string;
  id: string | null;
  name: string;
  symbol: string;
  image: string | null;
  pToken: number;
  feesEth: number;
};

export type BoardSnapshot = {
  collections: number;
  tvlEth: number;
  tvlUsd: number;
  feesEth: number;
  rewardsEth: number;
  staking: string | null;
  positions: BoardPosition[];
};

function weiToEth(wei: bigint) {
  return Number(wei) / 1e18;
}

function poolIdOf(key: {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

async function positionIds(wallet: string, manager: string) {
  try {
    const res = await fetch(
      `${BLOCKSCOUT}/api/v2/addresses/${wallet}/nft?type=ERC-721`,
      { next: { revalidate: 8 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: { id?: string; token?: { address_hash?: string } }[];
    };
    return (data.items ?? [])
      .filter(
        (item) =>
          item.token?.address_hash?.toLowerCase() === manager.toLowerCase() &&
          item.id,
      )
      .map((item) => String(item.id));
  } catch {
    return [];
  }
}

export async function loadBoard(wallet?: string | null): Promise<BoardSnapshot> {
  const vaults = await loadLiveVaults();
  const d = getDeployment(DEFAULT_CHAIN_ID);
  const uni = getUniswap(DEFAULT_CHAIN_ID);
  const staking = d.druse?.staking ?? null;
  const hook = (d.druse?.hook ?? "").toLowerCase();
  const weth = (d.uniswapV4?.weth ?? uni.weth).toLowerCase();
  const manager = (d.uniswapV4?.positionManager ?? uni.positionManager).toLowerCase();
  const stateView = (d.uniswapV4?.stateView ?? uni.stateView) as `0x${string}`;

  const tvlEth = vaults.reduce(
    (sum, v) => sum + (v.holdings || 0) * (v.floorEth && v.floorEth > 0 ? v.floorEth : 0),
    0,
  );
  const tvlUsd = vaults.reduce(
    (sum, v) => sum + (v.holdings || 0) * (v.floorUsd && v.floorUsd > 0 ? v.floorUsd : 0),
    0,
  );

  let rewardsEth = 0;
  if (wallet && staking) {
    try {
      const earned = await client.readContract({
        address: staking as `0x${string}`,
        abi: STAKING_ABI,
        functionName: "earned",
        args: [wallet as `0x${string}`],
      });
      rewardsEth = weiToEth(earned);
    } catch {
      rewardsEth = 0;
    }
  }

  const byPToken = new Map(vaults.map((v) => [v.vault.toLowerCase(), v]));
  const positions: BoardPosition[] = [];

  if (wallet) {
    const held = await Promise.all(
      vaults.map(async (vault) => {
        try {
          const bal = await client.readContract({
            address: vault.vault as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "balanceOf",
            args: [wallet as `0x${string}`],
          });
          return { vault, bal };
        } catch {
          return { vault, bal: 0n };
        }
      }),
    );
    for (const { vault, bal } of held) {
      if (bal <= 0n) continue;
      positions.push({
        tokenId: `wallet:${vault.vault}`,
        kind: "wallet",
        vault: vault.vault,
        id: vault.id,
        name: vault.name,
        symbol: vault.symbol,
        image: vault.image || vault.art,
        pToken: weiToEth(bal),
        feesEth: 0,
      });
    }

    const ids = await positionIds(wallet, manager);
    for (const id of ids) {
      try {
        const pos = await readPosition(id, manager as `0x${string}`, stateView, hook, weth, byPToken);
        if (pos) positions.push(pos);
      } catch {
        /* skip unknown / non-druse positions */
      }
    }
  }

  const feesEth = positions.reduce((sum, p) => sum + p.feesEth, 0);

  return {
    collections: vaults.length,
    tvlEth,
    tvlUsd,
    feesEth,
    rewardsEth,
    staking,
    positions,
  };
}

async function readPosition(
  tokenId: string,
  manager: `0x${string}`,
  stateView: `0x${string}`,
  hook: string,
  weth: string,
  byPToken: Map<string, LiveVault>,
): Promise<BoardPosition | null> {
  const [meta, liquidity] = await Promise.all([
    client.readContract({
      address: manager,
      abi: POS_ABI,
      functionName: "getPoolAndPositionInfo",
      args: [BigInt(tokenId)],
    }),
    client.readContract({
      address: manager,
      abi: POS_ABI,
      functionName: "getPositionLiquidity",
      args: [BigInt(tokenId)],
    }),
  ]);

  const [poolKey, info] = meta;
  if (hook && poolKey.hooks.toLowerCase() !== hook) return null;
  const pToken = [poolKey.currency0, poolKey.currency1].find((c) => c.toLowerCase() !== weth);
  if (!pToken) return null;
  const vault = byPToken.get(pToken.toLowerCase());
  if (!vault) return null;

  const { tickLower, tickUpper } = ticksFromPositionInfo(info);
  const id = poolIdOf(poolKey);
  const slot0 = await client.readContract({
    address: stateView,
    abi: STATE_ABI,
    functionName: "getSlot0",
    args: [id],
  });

  const { amount0, amount1 } = amountsForLiquidity(
    slot0[0],
    tickLower,
    tickUpper,
    liquidity,
  );
  const pIs0 = poolKey.currency0.toLowerCase() === pToken.toLowerCase();
  const pTokenWei = pIs0 ? amount0 : amount1;

  let feesEth = 0;
  try {
    const [growth, stored] = await Promise.all([
      client.readContract({
        address: stateView,
        abi: STATE_ABI,
        functionName: "getFeeGrowthInside",
        args: [id, tickLower, tickUpper],
      }),
      client.readContract({
        address: stateView,
        abi: STATE_ABI,
        functionName: "getPositionInfo",
        args: [id, manager, tickLower, tickUpper, pad(toHex(BigInt(tokenId)), { size: 32 })],
      }),
    ]);
    const fee0 = feesFromGrowth(liquidity, growth[0], stored[1]);
    const fee1 = feesFromGrowth(liquidity, growth[1], stored[2]);
    const feeP = pIs0 ? fee0 : fee1;
    const feeW = pIs0 ? fee1 : fee0;
    const floor = vault.floorEth && vault.floorEth > 0 ? vault.floorEth : 0;
    feesEth = weiToEth(feeW) + weiToEth(feeP) * floor;
  } catch {
    feesEth = 0;
  }

  return {
    tokenId,
    kind: "lp",
    vault: vault.vault,
    id: vault.id,
    name: vault.name,
    symbol: vault.symbol,
    image: vault.image || vault.art,
    pToken: weiToEth(pTokenWei),
    feesEth,
  };
}
