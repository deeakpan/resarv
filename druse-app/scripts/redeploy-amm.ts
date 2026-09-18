import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/** afterInitialize | beforeSwap | beforeSwapReturnDelta */
const HOOK_FLAGS = 0x1088n;
const HOOK_FLAG_MASK = 0x3fffn;

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");

function loadAddresses() {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"));
}

function saveAddresses(all: Record<string, unknown>) {
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(all, null, 2) + "\n");
}

function mineHookSalt(
  deployer: string,
  initCodeHash: string
): { salt: string; address: string } {
  for (let i = 0; i < 1_000_000; i++) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
    const address = ethers.getCreate2Address(deployer, salt, initCodeHash);
    if ((BigInt(address) & HOOK_FLAG_MASK) === HOOK_FLAGS) {
      return { salt, address };
    }
  }
  throw new Error("Could not mine a DruseHook CREATE2 address");
}

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
      for (let attempt = 0; attempt < 4; attempt++) {
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
        } catch (e) {
          if (attempt === 3) throw e;
        } finally {
          clearTimeout(timer);
        }
      }
      throw new Error("rpc failed");
    }
  }

  return new ethers.Wallet(key, new FetchJsonRpcProvider(rpcUrl));
}

async function send(txPromise: Promise<{ wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  if (!receipt) throw new Error("missing receipt");
}

async function main() {
  const wallet = getWallet();
  const deployerAddr = await wallet.getAddress();
  const chainId = Number((await wallet.provider!.getNetwork()).chainId);
  const chainKey = String(chainId);
  let nonce = await wallet.provider!.getTransactionCount(deployerAddr, "latest");
  const take = () => nonce++;

  const all = loadAddresses();
  const chain = all[chainKey];
  if (!chain?.uniswapV4?.poolManager || !chain.uniswapV4.weth || !chain.druse) {
    throw new Error(`Missing 1301 druse deployment in ${ADDRESSES_PATH}`);
  }

  const { weth: wethAddr, poolManager: poolManagerAddr } = chain.uniswapV4;
  const create2Addr = chain.druse.create2;
  const factoryAddr = chain.druse.factory;
  const feeSplitAddr = chain.druse.feeSplit;

  console.log("network", chainId);
  console.log("deployer", deployerAddr);
  console.log("starting nonce", nonce);

  const PoolLauncher = (await ethers.getContractFactory("PoolLauncher")).connect(
    wallet
  );
  const launcher = await PoolLauncher.deploy(poolManagerAddr, wethAddr, {
    nonce: take(),
  });
  await launcher.deploymentTransaction()!.wait();
  await launcher.waitForDeployment();
  const launcherAddr = await launcher.getAddress();
  console.log("PoolLauncher", launcherAddr);

  const DruseHook = await ethers.getContractFactory("DruseHook");
  const hookArgs = [poolManagerAddr, feeSplitAddr, wethAddr, launcherAddr] as const;
  const initCode = ethers.concat([
    DruseHook.bytecode,
    DruseHook.interface.encodeDeploy(hookArgs),
  ]);
  const { salt, address: hookAddr } = mineHookSalt(
    create2Addr,
    ethers.keccak256(initCode)
  );
  console.log("mined hook", hookAddr, "salt", salt);

  const create2 = await ethers.getContractAt("Create2Deployer", create2Addr, wallet);
  await send(create2.deploy(salt, initCode, { nonce: take() }));
  await send(launcher.setHook(hookAddr, { nonce: take() }));

  const factory = await ethers.getContractAt(
    "DruseVaultFactory",
    factoryAddr,
    wallet
  );
  await send(factory.setPoolOracle(launcherAddr, { nonce: take() }));

  all[chainKey] = {
    ...chain,
    updatedAt: new Date().toISOString(),
    druse: {
      ...chain.druse,
      launcher: launcherAddr,
      hook: hookAddr,
      hookSalt: salt,
    },
  };
  saveAddresses(all);
  console.log("factory.setPoolOracle ->", launcherAddr);
  console.log("wrote", ADDRESSES_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
