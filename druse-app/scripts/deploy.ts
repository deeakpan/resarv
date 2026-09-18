import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/** Snipe premium starts at 50% of floor (was 500%) and decays over 10 hours. */
const PREMIUM_MAX = ethers.parseEther("0.5");
const PREMIUM_DURATION = 10 * 60 * 60;
const DEPOSITOR_PREMIUM_SHARE = ethers.parseEther("0.3");
const TWAP_INTERVAL = 20 * 60;

/** afterInitialize | beforeSwap | beforeSwapReturnDelta */
const HOOK_FLAGS = 0x1088n;
const HOOK_FLAG_MASK = 0x3fffn;

const ADDRESSES_PATH = path.join(__dirname, "..", "deployments", "addresses.json");

type ChainAddresses = {
  name?: string;
  uniswapV4?: {
    poolManager: string;
    positionManager?: string;
    quoter?: string;
    stateView?: string;
    universalRouter?: string;
    poolSwapTest?: string;
    poolModifyLiquidityTest?: string;
    permit2?: string;
    weth: string;
  };
  [key: string]: unknown;
};

function loadAddresses(): Record<string, ChainAddresses> {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"));
}

function saveAddresses(all: Record<string, ChainAddresses>) {
  fs.mkdirSync(path.dirname(ADDRESSES_PATH), { recursive: true });
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
  const chainId = Number(process.env.CHAIN_ID || 4663);
  const rpcHost =
    process.env.RPC_HOST || "rpc.mainnet.chain.robinhood.com";
  const rpcUrl =
    process.env.RPC_URL || `https://${rpcHost}`;
  /** Optional fixed IP when local DNS cannot resolve robinhood.com. */
  const rpcIp = process.env.RPC_IP || "";
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;

  class FetchJsonRpcProvider extends ethers.JsonRpcApiProvider {
    readonly rpcUrl: string;
    readonly rpcHost: string;
    readonly rpcIp: string;
    constructor(url: string, host: string, ip: string) {
      super(ethers.Network.from(chainId), { staticNetwork: true });
      this.rpcUrl = url;
      this.rpcHost = host;
      this.rpcIp = ip;
    }
    async _send(payload: unknown) {
      const body = JSON.stringify(payload);
      let result: unknown;
      if (this.rpcIp) {
        const https = await import("https");
        result = await new Promise((resolve, reject) => {
          const req = https.request(
            {
              hostname: this.rpcIp,
              servername: this.rpcHost,
              method: "POST",
              path: "/",
              headers: {
                host: this.rpcHost,
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              },
              timeout: 60_000,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => {
                try {
                  resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
                } catch (err) {
                  reject(err);
                }
              });
            },
          );
          req.on("error", reject);
          req.end(body);
        });
      } else {
        const resp = await fetch(this.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        result = await resp.json();
      }
      return Array.isArray(result) ? result : [result];
    }
  }

  const provider = new FetchJsonRpcProvider(rpcUrl, rpcHost, rpcIp);
  return new ethers.Wallet(key, provider);
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

  console.log("network", chainId);
  console.log("deployer", deployerAddr);
  console.log("starting nonce", nonce);

  const all = loadAddresses();
  const chain = all[chainKey];
  if (!chain?.uniswapV4?.poolManager || !chain.uniswapV4.weth) {
    throw new Error(
      `No Uniswap v4 addresses for chain ${chainId} in deployments/addresses.json`
    );
  }

  const { weth: wethAddr, poolManager: poolManagerAddr } = chain.uniswapV4;
  const treasury = process.env.TREASURY || deployerAddr;
  const dev = process.env.DEV || deployerAddr;
  console.log("treasury", treasury);
  console.log("dev", dev);

  async function deployContract(name: string, ...args: unknown[]) {
    const factory = (await ethers.getContractFactory(name)).connect(wallet);
    const contract = await factory.deploy(...args, { nonce: take() });
    const tx = contract.deploymentTransaction();
    if (!tx) throw new Error(`${name} missing deployment tx`);
    await tx.wait();
    await contract.waitForDeployment();
    console.log(name, await contract.getAddress());
    return contract;
  }

  const stakeTokenAddr = (
    process.env.STAKE_TOKEN ||
    process.env.DRUSE_TOKEN ||
    ""
  ).trim();
  if (!ethers.isAddress(stakeTokenAddr)) {
    throw new Error(
      "Set STAKE_TOKEN (or DRUSE_TOKEN) to the live $DRUSE address; mock token deploy is disabled.",
    );
  }
  const stakeCode = await wallet.provider!.getCode(stakeTokenAddr);
  if (!stakeCode || stakeCode === "0x") {
    throw new Error(`STAKE_TOKEN has no code on chain ${chainId}: ${stakeTokenAddr}`);
  }
  console.log("stakeToken (existing)", stakeTokenAddr);

  const staking = await deployContract("Staking", stakeTokenAddr, wethAddr);

  const feeSplit = await deployContract(
    "FeeSplit",
    wethAddr,
    await staking.getAddress(),
    treasury,
    dev
  );
  await send(
    staking.setNotifier(await feeSplit.getAddress(), { nonce: take() })
  );

  const launcher = await deployContract("PoolLauncher", poolManagerAddr, wethAddr);
  const create2 = await deployContract("Create2Deployer");

  const DruseHook = await ethers.getContractFactory("DruseHook");
  const hookArgs = [
    poolManagerAddr,
    await feeSplit.getAddress(),
    wethAddr,
    await launcher.getAddress(),
  ] as const;
  const initCode = ethers.concat([
    DruseHook.bytecode,
    DruseHook.interface.encodeDeploy(hookArgs),
  ]);
  const { salt, address: hookAddr } = mineHookSalt(
    await create2.getAddress(),
    ethers.keccak256(initCode)
  );
  console.log("mined hook", hookAddr, "salt", salt);
  await send(create2.deploy(salt, initCode, { nonce: take() }));
  await send(launcher.setHook(hookAddr, { nonce: take() }));

  const vaultImpl = await deployContract("DruseVault", wethAddr);
  const factory = await deployContract("DruseVaultFactory");
  await send(
    factory.__DruseVaultFactory_init(
      await vaultImpl.getAddress(),
      TWAP_INTERVAL,
      PREMIUM_DURATION,
      PREMIUM_MAX,
      DEPOSITOR_PREMIUM_SHARE,
      { nonce: take() }
    )
  );
  await send(
    factory.setFeeSplit(await feeSplit.getAddress(), { nonce: take() })
  );
  await send(factory.setFeeExclusion(deployerAddr, true, { nonce: take() }));
  await send(
    factory.setPoolOracle(await launcher.getAddress(), { nonce: take() })
  );
  await send(launcher.setFactory(await factory.getAddress(), { nonce: take() }));

  const eligibility = await deployContract("EligibilityManager");
  await send(eligibility.__EligibilityManager_init({ nonce: take() }));
  await send(
    factory.setEligibilityManager(await eligibility.getAddress(), {
      nonce: take(),
    })
  );

  const stonk = await deployContract("MockERC721", "StonkBrokers", "STONK");
  await send(stonk.mintBatch(deployerAddr, 1, 10, { nonce: take() }));

  const mancer = await deployContract("MockERC721", "Chain Mancers", "MANCER");
  await send(mancer.mintBatch(deployerAddr, 1, 10, { nonce: take() }));

  const pyo = await deployContract("MockERC721", "pyopyopyopyo", "PYO");
  await send(pyo.mintBatch(deployerAddr, 1, 10, { nonce: take() }));

  const stonkNft = await stonk.getAddress();
  const mancerNft = await mancer.getAddress();
  const pyoNft = await pyo.getAddress();

  await send(
    factory.createVault("StonkBrokers", "pSTONK", stonkNft, false, true, {
      nonce: take(),
    })
  );
  await send(
    factory.createVault("Chain Mancers", "pMANCER", mancerNft, false, true, {
      nonce: take(),
    })
  );

  const vaultCount = await factory.numVaults();
  const stonkVault = await factory.vault(vaultCount - 2n);
  const mancerVault = await factory.vault(vaultCount - 1n);

  all[chainKey] = {
    ...chain,
    deployer: deployerAddr,
    updatedAt: new Date().toISOString(),
    druse: {
      stakeToken: stakeTokenAddr,
      staking: await staking.getAddress(),
      feeSplit: await feeSplit.getAddress(),
      launcher: await launcher.getAddress(),
      create2: await create2.getAddress(),
      hook: hookAddr,
      hookSalt: salt,
      vaultImpl: await vaultImpl.getAddress(),
      factory: await factory.getAddress(),
      eligibility: await eligibility.getAddress(),
    },
    nfts: {
      stonkbrokers: stonkNft,
      "chain-mancers": mancerNft,
      pyopyopyopyo: pyoNft,
    },
    vaults: {
      stonkbrokers: stonkVault,
      "chain-mancers": mancerVault,
    },
    demo: {
      collections: [
        { id: "stonkbrokers", nft: stonkNft, vault: stonkVault },
        { id: "chain-mancers", nft: mancerNft, vault: mancerVault },
        { id: "pyopyopyopyo", nft: pyoNft, vault: null },
      ],
    },
    minted: {
      stonkbrokers: "tokenIds 1-10",
      "chain-mancers": "tokenIds 1-10",
      pyopyopyopyo: "tokenIds 1-10, no vault",
    },
  };

  saveAddresses(all);
  console.log(all[chainKey]);
  console.log("wrote", ADDRESSES_PATH, "key", chainKey);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
