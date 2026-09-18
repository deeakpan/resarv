/**
 * Uniswap v4 + USDG on Robinhood Chain (4663)
 * @see https://developers.uniswap.org/docs/protocols/v4/deployments
 */
export const ADDRESSES = {
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as const,
  /** Native ETH sentinel used by Uniswap v4 PoolKey */
  nativeEth: "0x0000000000000000000000000000000000000000" as const,
  weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73" as const,
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951" as const,
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7" as const,
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94" as const,
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b" as const,
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904" as const,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const,
} as const;

export const USDG_DECIMALS = 6;

/** Known Uniswap v4 pool IDs involving USDG on Robinhood */
export const KNOWN_USDG_POOLS = [
  {
    id: "0x1c586d50f3ddf33955374f077f09a745d2ffab3a8c9e2acd6e832b9ab52fcdf8" as const,
    label: "ETH / USDG",
    currency0: ADDRESSES.nativeEth,
    currency1: ADDRESSES.usdg,
  },
  {
    id: "0xfcfae8fa0bd6da961bcf5d990f27690932deac4f093e99bf3e871691c6586593" as const,
    label: "WETH / USDG",
    currency0: ADDRESSES.weth,
    currency1: ADDRESSES.usdg,
  },
] as const;
