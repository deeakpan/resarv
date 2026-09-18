import { encodeFunctionData, type Abi, type Address } from "viem";
import { publicClient } from "@/lib/rpc";

export async function nativeHave(account: Address) {
  return publicClient.getBalance({ address: account });
}

export async function gasPriceWei() {
  try {
    const fees = await publicClient.estimateFeesPerGas();
    return fees.maxFeePerGas ?? fees.gasPrice ?? 1n;
  } catch {
    return 1_000_000n;
  }
}

export async function gasForCall(args: {
  account: Address;
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  fallbackGas: bigint;
}) {
  try {
    const gas = await publicClient.estimateGas({
      account: args.account,
      to: args.to,
      data: encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      }),
      value: args.value,
    });
    return (gas * 120n) / 100n;
  } catch {
    return args.fallbackGas;
  }
}

export async function estimateTxCost(args: {
  account: Address;
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  fallbackGas?: bigint;
}) {
  const price = await gasPriceWei();
  let gas = args.fallbackGas ?? 400_000n;
  try {
    gas = await publicClient.estimateGas({
      account: args.account,
      to: args.to,
      data: encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      }),
      value: args.value,
    });
  } catch {
    /* simulate often fails before approvals; use fallback */
  }
  return (gas * price * 130n) / 100n;
}

export async function nativeNeed(spendWei: bigint, gasCostWei: bigint) {
  return spendWei + gasCostWei;
}

export function coverError(have: bigint, need: bigint, kind: "token" | "gas") {
  if (have >= need) return null;
  return kind === "gas" ? "Not enough ETH for gas" : "Insufficient balance";
}
