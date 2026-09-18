/**
 * Official Uniswap v4 + Universal Router deployments.
 * Druse does not deploy a router. Swaps go through these.
 *
 * https://developers.uniswap.org/docs/protocols/v4/deployments
 */
export type UniswapV4 = {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  quoter: `0x${string}`;
  stateView: `0x${string}`;
  universalRouter: `0x${string}`;
  universalRouterLatest?: `0x${string}`;
  permit2: `0x${string}`;
  weth: `0x${string}`;
  reservesLens?: `0x${string}`;
};

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const RESERVES = "0x0000001b173C3bbF3984D417d8614E3eed34865B" as const;

/** Unichain Sepolia. Druse testnet (chain 1301). */
export const UNISWAP_1301: UniswapV4 = {
  poolManager: "0x00b036b58a818b1bc34d502d3fe730db729e62ac",
  positionManager: "0xf969aee60879c54baaed9f3ed26147db216fd664",
  quoter: "0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472",
  stateView: "0xc199f1072a74d4e905aba1a84d9a45e2546b6222",
  universalRouter: "0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d",
  universalRouterLatest: "0x8B844f885672f333Bc0042cB669255f93a4C1E6b",
  permit2: PERMIT2,
  weth: "0x4200000000000000000000000000000000000006",
  reservesLens: RESERVES,
};

/** Robinhood Chain mainnet (chain 4663). */
export const UNISWAP_4663: UniswapV4 = {
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  permit2: PERMIT2,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  reservesLens: RESERVES,
};

/** Unichain mainnet (chain 130). */
export const UNISWAP_130: UniswapV4 = {
  poolManager: "0x1f98400000000000000000000000000000000004",
  positionManager: "0x4529a01c7a0410167c5740c487a8de60232617bf",
  quoter: "0x333e3c607b141b18ff6de9f258db6e77fe7491e0",
  stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2",
  universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3",
  universalRouterLatest: "0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7",
  permit2: PERMIT2,
  weth: "0x4200000000000000000000000000000000000006",
  reservesLens: RESERVES,
};

export const UNISWAP_BY_CHAIN: Record<number, UniswapV4> = {
  1301: UNISWAP_1301,
  4663: UNISWAP_4663,
  130: UNISWAP_130,
};

export function getUniswap(chainId: number): UniswapV4 {
  const cfg = UNISWAP_BY_CHAIN[chainId];
  if (!cfg) throw new Error(`No official Uniswap v4 Universal Router on chain ${chainId}`);
  return cfg;
}

/** Druse pTOKEN/WETH pools. */
export const DRUSE_LP_FEE = 10_000;
export const DRUSE_TICK_SPACING = 200;
