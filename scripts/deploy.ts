import { promises as fs } from "fs";
import path from "path";
import { ethers } from "hardhat";

const ZERO = "0x0000000000000000000000000000000000000000";

async function deploy(name: string, ...args: unknown[]) {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${name}: ${address}`);
  return contract;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId === 31337) {
    throw new Error("Pass --network rhTestnet or --network rhMainnet");
  }

  console.log(`Deployer ${deployer.address} on chain ${chainId}`);

  const activePool = await deploy("ActivePool");
  const borrowerOperations = await deploy("BorrowerOperations");
  const troveManager = await deploy("TroveManager");
  const collSurplusPool = await deploy("CollSurplusPool");
  const communityIssuance = await deploy("CommunityIssuance");
  const defaultPool = await deploy("DefaultPool");
  const hintHelpers = await deploy("HintHelpers");
  const lockupContractFactory = await deploy("LockupContractFactory");
  const lqtyStaking = await deploy("LQTYStaking");
  const priceFeed = await deploy("PriceFeedTestnet");
  const sortedTroves = await deploy("SortedTroves");
  const stabilityPool = await deploy("StabilityPool");
  const gasPool = await deploy("GasPool");
  const unipool = await deploy("Unipool");

  const lusdToken = await deploy(
    "LUSDToken",
    await troveManager.getAddress(),
    await stabilityPool.getAddress(),
    await borrowerOperations.getAddress()
  );

  const uniToken = await deploy(
    "ERC20Mock",
    "Mock Uniswap V2",
    "UNI-V2",
    deployer.address,
    0
  );

  const lqtyToken = await deploy(
    "LQTYToken",
    await communityIssuance.getAddress(),
    await lqtyStaking.getAddress(),
    await lockupContractFactory.getAddress(),
    deployer.address,
    await unipool.getAddress(),
    deployer.address
  );

  const multiTroveGetter = await deploy(
    "MultiTroveGetter",
    await troveManager.getAddress(),
    await sortedTroves.getAddress()
  );

  const addr = {
    activePool: await activePool.getAddress(),
    borrowerOperations: await borrowerOperations.getAddress(),
    troveManager: await troveManager.getAddress(),
    collSurplusPool: await collSurplusPool.getAddress(),
    communityIssuance: await communityIssuance.getAddress(),
    defaultPool: await defaultPool.getAddress(),
    hintHelpers: await hintHelpers.getAddress(),
    lockupContractFactory: await lockupContractFactory.getAddress(),
    lqtyStaking: await lqtyStaking.getAddress(),
    priceFeed: await priceFeed.getAddress(),
    sortedTroves: await sortedTroves.getAddress(),
    stabilityPool: await stabilityPool.getAddress(),
    gasPool: await gasPool.getAddress(),
    unipool: await unipool.getAddress(),
    lusdToken: await lusdToken.getAddress(),
    lqtyToken: await lqtyToken.getAddress(),
    uniToken: await uniToken.getAddress(),
    multiTroveGetter: await multiTroveGetter.getAddress(),
  };

  console.log("Connecting contracts...");

  await (
    await sortedTroves.setParams(1_000_000, addr.troveManager, addr.borrowerOperations)
  ).wait();
  await (
    await troveManager.setAddresses(
      addr.borrowerOperations,
      addr.activePool,
      addr.defaultPool,
      addr.stabilityPool,
      addr.gasPool,
      addr.collSurplusPool,
      addr.priceFeed,
      addr.lusdToken,
      addr.sortedTroves,
      addr.lqtyToken,
      addr.lqtyStaking
    )
  ).wait();
  await (
    await borrowerOperations.setAddresses(
      addr.troveManager,
      addr.activePool,
      addr.defaultPool,
      addr.stabilityPool,
      addr.gasPool,
      addr.collSurplusPool,
      addr.priceFeed,
      addr.sortedTroves,
      addr.lusdToken,
      addr.lqtyStaking
    )
  ).wait();
  await (
    await stabilityPool.setAddresses(
      addr.borrowerOperations,
      addr.troveManager,
      addr.activePool,
      addr.lusdToken,
      addr.sortedTroves,
      addr.priceFeed,
      addr.communityIssuance
    )
  ).wait();
  await (
    await activePool.setAddresses(
      addr.borrowerOperations,
      addr.troveManager,
      addr.stabilityPool,
      addr.defaultPool
    )
  ).wait();
  await (
    await defaultPool.setAddresses(addr.troveManager, addr.activePool)
  ).wait();
  await (
    await collSurplusPool.setAddresses(
      addr.borrowerOperations,
      addr.troveManager,
      addr.activePool
    )
  ).wait();
  await (
    await hintHelpers.setAddresses(addr.sortedTroves, addr.troveManager)
  ).wait();
  await (
    await lqtyStaking.setAddresses(
      addr.lqtyToken,
      addr.lusdToken,
      addr.troveManager,
      addr.borrowerOperations,
      addr.activePool
    )
  ).wait();
  await (await lockupContractFactory.setLQTYTokenAddress(addr.lqtyToken)).wait();
  await (
    await communityIssuance.setAddresses(addr.lqtyToken, addr.stabilityPool)
  ).wait();
  await (
    await unipool.setParams(addr.lqtyToken, addr.uniToken, 2 * 30 * 24 * 60 * 60)
  ).wait();

  await (await priceFeed.setPrice(ethers.parseEther("2000"))).wait();

  const out = {
    chainId,
    deployer: deployer.address,
    deploymentDate: Date.now(),
    _priceFeedIsTestnet: true,
    addresses: { ...addr, frontendTag: ZERO },
  };

  const file = path.join(__dirname, "..", "deployments", "addresses.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  existing[String(chainId)] = out;
  await fs.writeFile(file, JSON.stringify(existing, null, 2));
  console.log(`Wrote ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
