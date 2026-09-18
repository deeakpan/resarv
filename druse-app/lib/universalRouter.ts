import { concat, encodeAbiParameters, pad, toHex, type Address, type Hex } from "viem";
import { DRUSE_LP_FEE, DRUSE_TICK_SPACING } from "@/config/uniswap";

/** Uniswap Universal Router `execute`. */
export const UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const PERMIT2_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

/** Universal Router command bytes. */
export const Command = {
  V4_SWAP: 0x10,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
} as const;

/** v4 Planner actions. */
export const V4Action = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SETTLE: 0x0b,
  SETTLE_ALL: 0x0c,
  TAKE: 0x0e,
  TAKE_ALL: 0x0f,
} as const;

export const ADDRESS_THIS = "0x0000000000000000000000000000000000000002" as Address;
export const MSG_SENDER = "0x0000000000000000000000000000000000000001" as Address;

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export type PathHop = {
  intermediateCurrency: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  hookData?: Hex;
};

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

export function drusePoolKey(
  pToken: Address,
  weth: Address,
  hook: Address,
): PoolKey {
  const token0 = pToken.toLowerCase() < weth.toLowerCase() ? pToken : weth;
  const token1 = token0.toLowerCase() === pToken.toLowerCase() ? weth : pToken;
  return {
    currency0: token0,
    currency1: token1,
    fee: DRUSE_LP_FEE,
    tickSpacing: DRUSE_TICK_SPACING,
    hooks: hook,
  };
}

function actionBytes(actions: number[]): Hex {
  return concat(actions.map((a) => pad(toHex(a), { size: 1 })));
}

function v4SwapInput(actions: number[], params: Hex[]): Hex {
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actionBytes(actions), params],
  );
}

export function encodeExactInSingle(args: {
  key: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  hookData?: Hex;
}): { commands: Hex; inputs: Hex[] } {
  const hookData = args.hookData ?? "0x";
  const tokenIn = args.zeroForOne ? args.key.currency0 : args.key.currency1;
  const tokenOut = args.zeroForOne ? args.key.currency1 : args.key.currency0;

  const swapParams = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: [...poolKeyComponents] },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey: args.key,
        zeroForOne: args.zeroForOne,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        hookData,
      },
    ],
  );

  const settle = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [tokenIn, args.amountIn],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [tokenOut, args.amountOutMinimum],
  );

  return {
    commands: toHex(Command.V4_SWAP, { size: 1 }),
    inputs: [
      v4SwapInput(
        [V4Action.SWAP_EXACT_IN_SINGLE, V4Action.SETTLE_ALL, V4Action.TAKE_ALL],
        [swapParams, settle, take],
      ),
    ],
  };
}

/** Multi-hop through Uniswap v4 (e.g. vA → WETH → vB). */
export function encodeExactInPath(args: {
  currencyIn: Address;
  path: PathHop[];
  amountIn: bigint;
  amountOutMinimum: bigint;
}): { commands: Hex; inputs: Hex[] } {
  const last = args.path[args.path.length - 1];
  if (!last) throw new Error("path required");

  const swapParams = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currencyIn", type: "address" },
          {
            name: "path",
            type: "tuple[]",
            components: [
              { name: "intermediateCurrency", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
              { name: "hookData", type: "bytes" },
            ],
          },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
        ],
      },
    ],
    [
      {
        currencyIn: args.currencyIn,
        path: args.path.map((h) => ({
          intermediateCurrency: h.intermediateCurrency,
          fee: h.fee,
          tickSpacing: h.tickSpacing,
          hooks: h.hooks,
          hookData: h.hookData ?? "0x",
        })),
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
      },
    ],
  );

  const settle = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [args.currencyIn, args.amountIn],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [last.intermediateCurrency, args.amountOutMinimum],
  );

  return {
    commands: toHex(Command.V4_SWAP, { size: 1 }),
    inputs: [
      v4SwapInput(
        [V4Action.SWAP_EXACT_IN, V4Action.SETTLE_ALL, V4Action.TAKE_ALL],
        [swapParams, settle, take],
      ),
    ],
  };
}

export function deadlineSeconds(fromNow = 3600): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + fromNow);
}

export function encodeWrapEth(recipient: Address, amount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [recipient, amount],
  );
}

export function encodeUnwrapWeth(recipient: Address, amountMin: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [recipient, amountMin],
  );
}

function encodeSettle(currency: Address, amount: bigint, payerIsUser: boolean): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
    [currency, amount, payerIsUser],
  );
}

function encodeTake(currency: Address, recipient: Address, amount: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [currency, recipient, amount],
  );
}

function swapExactInSingleParams(args: {
  key: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  hookData?: Hex;
}): Hex {
  const hookData = args.hookData ?? "0x";
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: [...poolKeyComponents] },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey: args.key,
        zeroForOne: args.zeroForOne,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        hookData,
      },
    ],
  );
}

export function buildExactInSwap(args: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOutMin: bigint;
  weth: Address;
  hook: Address;
  hops?: PathHop[];
  nativeIn?: boolean;
  nativeOut?: boolean;
}): { commands: Hex; inputs: Hex[]; value: bigint } {
  const hops = args.hops ?? [];
  const commands: number[] = [];
  const inputs: Hex[] = [];

  if (args.nativeIn) {
    commands.push(Command.WRAP_ETH);
    inputs.push(encodeWrapEth(ADDRESS_THIS, args.amountIn));
  }

  if (hops.length > 1) {
    commands.push(Command.V4_SWAP);
    inputs.push(
      encodeExactInPath({
        currencyIn: args.tokenIn,
        path: hops,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMin,
      }).inputs[0]!,
    );
  } else {
    const pToken =
      args.tokenIn.toLowerCase() === args.weth.toLowerCase() ? args.tokenOut : args.tokenIn;
    const key = drusePoolKey(pToken, args.weth, args.hook);
    const zeroForOne = args.tokenIn.toLowerCase() === key.currency0.toLowerCase();
    const settle = args.nativeIn
      ? encodeSettle(args.tokenIn, args.amountIn, false)
      : encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [args.tokenIn, args.amountIn],
        );
    const take = args.nativeOut
      ? encodeTake(args.tokenOut, ADDRESS_THIS, args.amountOutMin)
      : encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [args.tokenOut, args.amountOutMin],
        );
    commands.push(Command.V4_SWAP);
    inputs.push(
      v4SwapInput(
        [
          V4Action.SWAP_EXACT_IN_SINGLE,
          args.nativeIn ? V4Action.SETTLE : V4Action.SETTLE_ALL,
          args.nativeOut ? V4Action.TAKE : V4Action.TAKE_ALL,
        ],
        [
          swapExactInSingleParams({
            key,
            zeroForOne,
            amountIn: args.amountIn,
            amountOutMinimum: args.amountOutMin,
          }),
          settle,
          take,
        ],
      ),
    );
  }

  if (args.nativeOut) {
    commands.push(Command.UNWRAP_WETH);
    inputs.push(encodeUnwrapWeth(MSG_SENDER, args.amountOutMin));
  }

  return {
    commands: concat(commands.map((c) => pad(toHex(c), { size: 1 }))),
    inputs,
    value: args.nativeIn ? args.amountIn : 0n,
  };
}
