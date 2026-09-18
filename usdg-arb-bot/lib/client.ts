import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhood } from "@/lib/chain";

export function getPublicClient() {
  return createPublicClient({
    chain: robinhood,
    transport: http(
      process.env.RH_RPC_URL ||
        process.env.NEXT_PUBLIC_RH_RPC_URL ||
        "https://rpc.mainnet.chain.robinhood.com",
    ),
  });
}

export function getWalletClient() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY is not set");
  const account = privateKeyToAccount(
    (key.startsWith("0x") ? key : `0x${key}`) as Hex,
  );
  return createWalletClient({
    account,
    chain: robinhood,
    transport: http(
      process.env.RH_RPC_URL ||
        process.env.NEXT_PUBLIC_RH_RPC_URL ||
        "https://rpc.mainnet.chain.robinhood.com",
    ),
  });
}
