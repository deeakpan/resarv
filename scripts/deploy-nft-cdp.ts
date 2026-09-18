import { promises as fs } from "fs";
import path from "path";
import { ethers } from "hardhat";

/** Live Robinhood collections — same CAs as lib/collections.ts */
const RH_COLLECTIONS = [
  "0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0", // Stonk Brokers
  "0x2cb61a81cec32534de271666fa020c89c2dd1920", // The Robin Hood
  "0x6581b6fa83e714956935cd1e16ac8f6f5c44c484", // MonkeyHood
] as const;

async function deploy(name: string, ...args: unknown[]) {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const short = name.includes(":") ? name.split(":").pop()! : name;
  console.log(`${short}: ${address}`);
  return contract;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Deployer ${deployer.address} on chain ${chainId}`);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(bal)} ETH`);

  const priceSigner =
    process.env.PRICE_SIGNER_ADDRESS || deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  // Optional: wire an existing RSRV later via setStaking. Launch skips token + staking.
  const existingRsrv = (process.env.RSRV_TOKEN_ADDRESS || "").trim();
  const existingStaking = (process.env.RSRV_STAKING_ADDRESS || "").trim();
  const skipStaking =
    process.env.DEPLOY_STAKING === "0" ||
    (!existingRsrv && !existingStaking && process.env.DEPLOY_STAKING !== "1");

  const rusd = await deploy("contracts/resarv/RUSD.sol:RUSD");

  let rsrvAddress = ethers.ZeroAddress;
  let stakingAddress = ethers.ZeroAddress;

  if (!skipStaking) {
    if (existingRsrv) {
      rsrvAddress = existingRsrv;
      console.log(`Using existing RSRV: ${rsrvAddress}`);
    } else {
      const rsrv = await deploy(
        "contracts/resarv/RSRV.sol:RSRV",
        ethers.parseEther("100000000"),
      );
      rsrvAddress = await rsrv.getAddress();
    }

    if (existingStaking) {
      stakingAddress = existingStaking;
      console.log(`Using existing staking: ${stakingAddress}`);
    } else {
      const staking = await deploy(
        "contracts/resarv/RSRVStaking.sol:RSRVStaking",
        rsrvAddress,
        await rusd.getAddress(),
      );
      stakingAddress = await staking.getAddress();
    }
  } else {
    console.log("Skipping RSRV + staking deploy (staking disabled at launch)");
  }

  const stabilityPool = await deploy(
    "contracts/resarv/StabilityPool.sol:StabilityPool",
    await rusd.getAddress(),
  );
  const cdp = await deploy(
    "contracts/resarv/NFTCDP.sol:NFTCDP",
    await rusd.getAddress(),
    stakingAddress, // zero → stakingEnabled=false
    await stabilityPool.getAddress(),
    treasury,
    priceSigner,
  );

  await (await rusd.setMinter(await cdp.getAddress())).wait();
  await (await stabilityPool.setFeeSource(await cdp.getAddress())).wait();
  await (await stabilityPool.setCDP(await cdp.getAddress())).wait();

  if (stakingAddress !== ethers.ZeroAddress) {
    const staking = await ethers.getContractAt(
      "contracts/resarv/RSRVStaking.sol:RSRVStaking",
      stakingAddress,
    );
    await (await staking.setFeeSource(await cdp.getAddress())).wait();
    await (await cdp.setStaking(stakingAddress, true)).wait();
    console.log(`Staking enabled: ${stakingAddress}`);
  } else {
    console.log("Staking left disabled (setStaking later when RSRV is ready)");
  }

  const deployMock =
    process.env.DEPLOY_MOCK_NFT === "1" && chainId !== 1 && chainId !== 130;
  let mockNft = ethers.ZeroAddress;
  const mintedTokenIds: number[] = [];

  if (deployMock) {
    const nft = await deploy(
      "contracts/resarv/mocks/MockERC721.sol:MockERC721",
      "Resarv Mock Brokers",
      "rMBRK",
    );
    mockNft = await nft.getAddress();
    await (await cdp.setSupportedCollection(mockNft, true)).wait();
    console.log(`Mock collection enabled: ${mockNft}`);

    const mintCount = Number(process.env.MOCK_NFT_MINT_COUNT || "5");
    for (let id = 1; id <= mintCount; id++) {
      const tx = await nft.mint(deployer.address, id);
      await tx.wait();
      mintedTokenIds.push(id);
      console.log(`Minted tokenId ${id} → ${deployer.address}`);
    }
  }

  const extras = (process.env.SUPPORTED_COLLECTIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const collections = [
    ...(chainId === 4663 ? RH_COLLECTIONS : []),
    ...extras,
  ].filter(
    (c, i, arr) =>
      arr.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i,
  );

  const supportedCollections: string[] = [];
  for (const c of collections) {
    await (await cdp.setSupportedCollection(c, true)).wait();
    supportedCollections.push(c);
    console.log(`Enabled collection ${c}`);
  }

  const addresses = {
    rusd: await rusd.getAddress(),
    rsrv: rsrvAddress,
    rsrvStaking: stakingAddress,
    stabilityPool: await stabilityPool.getAddress(),
    nftCdp: await cdp.getAddress(),
    priceSigner,
    treasury,
    mockNft,
    mintedTokenIds,
    supportedCollections,
    stakingEnabled: stakingAddress !== ethers.ZeroAddress,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  await fs.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, "nft-cdp-addresses.json");

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    /* first deploy */
  }
  existing[String(chainId)] = {
    chainId,
    addresses,
    deployedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(existing, null, 2));
  console.log(`Wrote ${filePath}`);
  console.log(addresses);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
