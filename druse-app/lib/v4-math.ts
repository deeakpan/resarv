const Q96 = 2n ** 96n;
const Q128 = 2n ** 128n;

export function signExtend24(raw: number) {
  return raw >= 0x800000 ? raw - 0x1000000 : raw;
}

export function ticksFromPositionInfo(info: bigint) {
  return {
    tickLower: signExtend24(Number((info >> 8n) & 0xffffffn)),
    tickUpper: signExtend24(Number((info >> 32n) & 0xffffffn)),
  };
}

export function tickToSqrtPriceX96(tick: number): bigint {
  const abs = tick < 0 ? -tick : tick;
  let ratio = (abs & 0x1) !== 0
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n;
  if (abs & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (abs & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (abs & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (abs & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (abs & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if (abs & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if (abs & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if (abs & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if (abs & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if (abs & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if (abs & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if (abs & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if (abs & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if (abs & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if (abs & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if (abs & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if (abs & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if (abs & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if (abs & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;
  return ratio >> 32n;
}

function amount0(sqrtA: bigint, sqrtB: bigint, liquidity: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (lo === 0n) return 0n;
  return (liquidity * Q96 * (hi - lo)) / hi / lo;
}

function amount1(sqrtA: bigint, sqrtB: bigint, liquidity: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  return (liquidity * (hi - lo)) / Q96;
}

export function amountsForLiquidity(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
) {
  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  if (sqrtPrice <= sqrtA) return { amount0: amount0(sqrtA, sqrtB, liquidity), amount1: 0n };
  if (sqrtPrice < sqrtB) {
    return {
      amount0: amount0(sqrtPrice, sqrtB, liquidity),
      amount1: amount1(sqrtA, sqrtPrice, liquidity),
    };
  }
  return { amount0: 0n, amount1: amount1(sqrtA, sqrtB, liquidity) };
}

export function feesFromGrowth(
  liquidity: bigint,
  growthNow: bigint,
  growthLast: bigint,
) {
  if (liquidity === 0n || growthNow <= growthLast) return 0n;
  return ((growthNow - growthLast) * liquidity) / Q128;
}

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

export function nearestUsableTick(tick: number, spacing: number) {
  const rounded = Math.round(tick / spacing) * spacing;
  if (rounded < MIN_TICK) return Math.ceil(MIN_TICK / spacing) * spacing;
  if (rounded > MAX_TICK) return Math.floor(MAX_TICK / spacing) * spacing;
  return rounded;
}

export function fullRangeTicks(spacing: number) {
  return {
    tickLower: nearestUsableTick(MIN_TICK, spacing),
    tickUpper: nearestUsableTick(MAX_TICK, spacing),
  };
}

export function priceToTick(price: number) {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(Math.log(price) / Math.log(1.0001));
}

export function tickToPrice(tick: number) {
  return 1.0001 ** tick;
}

export function pTokenPriceFromTick(tick: number, pTokenIs0: boolean) {
  const raw = tickToPrice(tick);
  if (raw <= 0) return 0;
  return pTokenIs0 ? raw : 1 / raw;
}

export function ticksFromEthRange(
  minEth: number,
  maxEth: number,
  pTokenIs0: boolean,
  spacing: number,
) {
  const lo = Math.min(minEth, maxEth);
  const hi = Math.max(minEth, maxEth);
  if (!(lo > 0) || !(hi > 0)) return fullRangeTicks(spacing);
  const a = pTokenIs0 ? lo : 1 / hi;
  const b = pTokenIs0 ? hi : 1 / lo;
  let tickLower = nearestUsableTick(priceToTick(a), spacing);
  let tickUpper = nearestUsableTick(priceToTick(b), spacing);
  if (tickLower >= tickUpper) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

export function ticksAroundPct(
  midEth: number,
  pct: number,
  pTokenIs0: boolean,
  spacing: number,
) {
  if (!(midEth > 0) || !(pct > 0)) return fullRangeTicks(spacing);
  return ticksFromEthRange(midEth * (1 - pct), midEth * (1 + pct), pTokenIs0, spacing);
}

export function priceToSqrtX96(price: number): bigint {
  if (!Number.isFinite(price) || price <= 0) return 0n;
  return BigInt(Math.floor(Math.sqrt(price) * 2 ** 96));
}

export function sqrtX96ToPrice(sqrt: bigint): number {
  if (sqrt <= 0n) return 0;
  const x = Number(sqrt) / 2 ** 96;
  return x * x;
}

/** Human price of 1 pTOKEN in ETH, given token1/token0 sqrt price. */
export function pTokenPriceEth(sqrt: bigint, pTokenIs0: boolean): number {
  const raw = sqrtX96ToPrice(sqrt);
  if (raw <= 0) return 0;
  return pTokenIs0 ? raw : 1 / raw;
}

export function floorToSqrtX96(floorEth: number, pTokenIs0: boolean): bigint {
  if (!Number.isFinite(floorEth) || floorEth <= 0) return 0n;
  return priceToSqrtX96(pTokenIs0 ? floorEth : 1 / floorEth);
}

function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (lo === 0n || hi <= lo || amount0 <= 0n) return 0n;
  return (amount0 * lo * hi) / (Q96 * (hi - lo));
}

function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint) {
  const [lo, hi] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (hi <= lo || amount1 <= 0n) return 0n;
  return (amount1 * Q96) / (hi - lo);
}

export function liquidityForAmounts(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  amount0: bigint,
  amount1: bigint,
) {
  const sqrtA = tickToSqrtPriceX96(tickLower);
  const sqrtB = tickToSqrtPriceX96(tickUpper);
  if (sqrtPrice <= sqrtA) return liquidityForAmount0(sqrtA, sqrtB, amount0);
  if (sqrtPrice >= sqrtB) return liquidityForAmount1(sqrtA, sqrtB, amount1);
  const liq0 = liquidityForAmount0(sqrtPrice, sqrtB, amount0);
  const liq1 = liquidityForAmount1(sqrtA, sqrtPrice, amount1);
  return liq0 < liq1 ? liq0 : liq1;
}
