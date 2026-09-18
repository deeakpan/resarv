import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");

function getWallet() {
  const rpcUrl =
    process.env.RPC_URL || "https://unichain-sepolia-rpc.publicnode.com";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;

  class FetchJsonRpcProvider extends ethers.JsonRpcApiProvider {
    readonly rpcUrl: string;
    constructor(url: string) {
      super(ethers.Network.from(1301), { staticNetwork: true });
      this.rpcUrl = url;
    }
    async _send(payload: unknown) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      try {
        const resp = await fetch(this.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await resp.json();
        return Array.isArray(result) ? result : [result];
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return new ethers.Wallet(key, new FetchJsonRpcProvider(rpcUrl));
}

async function main() {
  const wallet = getWallet();
  const me = await wallet.getAddress();
  const d = JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"))["1301"];
  const target = (process.env.FEE_WHITELIST || d.deployer || me) as string;
  if (!ethers.isAddress(target)) throw new Error(`Bad FEE_WHITELIST ${target}`);
  const factory = await ethers.getContractAt("DruseVaultFactory", d.druse.factory, wallet);
  const already = await factory.excludedFromFees(target);
  if (already) {
    console.log("already whitelisted", target);
    return;
  }
  const nonce = await wallet.provider!.getTransactionCount(me, "latest");
  const tx = await factory.setFeeExclusion(target, true, { nonce });
  await tx.wait();
  console.log("factory", d.druse.factory);
  console.log("whitelisted", target, await factory.excludedFromFees(target));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
