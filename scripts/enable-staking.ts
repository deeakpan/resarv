/**
 * Wire RSRV + staking after launch.
 *
 * Env:
 *   RSRV_TOKEN_ADDRESS=0x…          (required)
 *   RSRV_STAKING_ADDRESS=0x…        (optional — deploys RSRVStaking if unset)
 *
 * Usage:
 *   npx hardhat run scripts/enable-staking.ts --network rhMainnet
 */
import { promises as fs } from "fs";
import path from "path";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const rsrvAddr = (process.env.RSRV_TOKEN_ADDRESS || "").trim();
  if (!rsrvAddr || !ethers.isAddress(rsrvAddr)) {
    throw new Error("Set RSRV_TOKEN_ADDRESS to the live RSRV token");
  }

  const filePath = path.join(__dirname, "..", "deployments", "nft-cdp-addresses.json");
  const file = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<
    string,
    {
      addresses: {
        rusd: string;
        nftCdp: string;
        rsrv?: string;
        rsrvStaking?: string;
        stakingEnabled?: boolean;
      };
    }
  >;
  const row = file[String(chainId)];
  if (!row?.addresses?.nftCdp || !row.addresses.rusd) {
    throw new Error(`No nftCdp/rusd for chain ${chainId}`);
  }

  console.log(`Enabling staking on chain ${chainId} as ${deployer.address}`);

  let stakingAddr = (process.env.RSRV_STAKING_ADDRESS || "").trim();
  if (!stakingAddr) {
    const factory = await ethers.getContractFactory(
      "contracts/resarv/RSRVStaking.sol:RSRVStaking",
    );
    const staking = await factory.deploy(rsrvAddr, row.addresses.rusd);
    await staking.waitForDeployment();
    stakingAddr = await staking.getAddress();
    console.log(`Deployed RSRVStaking: ${stakingAddr}`);
    await (await staking.setFeeSource(row.addresses.nftCdp)).wait();
  } else {
    const staking = await ethers.getContractAt(
      "contracts/resarv/RSRVStaking.sol:RSRVStaking",
      stakingAddr,
    );
    await (await staking.setFeeSource(row.addresses.nftCdp)).wait();
    console.log(`Using existing staking: ${stakingAddr}`);
  }

  const cdp = await ethers.getContractAt(
    "contracts/resarv/NFTCDP.sol:NFTCDP",
    row.addresses.nftCdp,
  );
  await (await cdp.setStaking(stakingAddr, true)).wait();
  console.log(`CDP staking enabled → ${stakingAddr}`);

  row.addresses.rsrv = rsrvAddr;
  row.addresses.rsrvStaking = stakingAddr;
  row.addresses.stakingEnabled = true;
  await fs.writeFile(filePath, JSON.stringify(file, null, 2));
  console.log(`Updated ${filePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
