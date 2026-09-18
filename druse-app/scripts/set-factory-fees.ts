import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");
const VAULT_FEE = ethers.parseEther("0.01"); // 1% of 1 pTOKEN

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
  const factory = await ethers.getContractAt(
    "DruseVaultFactory",
    d.druse.factory,
    wallet
  );
  const nonce = await wallet.provider!.getTransactionCount(me, "latest");
  const tx = await factory.setFactoryFees(VAULT_FEE, VAULT_FEE, VAULT_FEE, {
    nonce,
  });
  await tx.wait();
  console.log("factory", d.druse.factory);
  console.log("factoryMintFee", (await factory.factoryMintFee()).toString());
  console.log("factoryRedeemFee", (await factory.factoryRedeemFee()).toString());
  console.log("factorySwapFee", (await factory.factorySwapFee()).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
