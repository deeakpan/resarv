import { ethers } from "hardhat";
import { promises as fs } from "fs";
import path from "path";

const COLLECTIONS = [
  "0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0", // Stonk Brokers
  "0x2cb61a81cec32534de271666fa020c89c2dd1920", // The Robin Hood
  "0x6581b6fa83e714956935cd1e16ac8f6f5c44c484", // MonkeyHood
] as const;

const DISABLE = [
  "0xebb7c860d3b0886a3202979af129d022fe7fe8ae", // stale monkeyhood CA
] as const;

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Enabling collections on chain ${chainId} as ${signer.address}`);

  const filePath = path.join(__dirname, "..", "deployments", "nft-cdp-addresses.json");
  const file = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<
    string,
    { addresses: { nftCdp?: string; mockNft?: string; supportedCollections?: string[] } }
  >;
  const row = file[String(chainId)];
  if (!row?.addresses?.nftCdp) {
    throw new Error(`No nftCdp for chain ${chainId}`);
  }

  const cdp = await ethers.getContractAt(
    "contracts/resarv/NFTCDP.sol:NFTCDP",
    row.addresses.nftCdp,
  );

  for (const c of COLLECTIONS) {
    const tx = await cdp.setSupportedCollection(c, true);
    await tx.wait();
    console.log(`Enabled ${c}`);
  }

  for (const c of DISABLE) {
    const tx = await cdp.setSupportedCollection(c, false);
    await tx.wait();
    console.log(`Disabled ${c}`);
  }

  // Ensure mock stays disabled if set
  if (
    row.addresses.mockNft &&
    row.addresses.mockNft !== ethers.ZeroAddress
  ) {
    const tx = await cdp.setSupportedCollection(row.addresses.mockNft, false);
    await tx.wait();
    console.log(`Disabled mock ${row.addresses.mockNft}`);
  }

  row.addresses.supportedCollections = [...COLLECTIONS];
  row.addresses.mockNft = ethers.ZeroAddress;
  await fs.writeFile(filePath, JSON.stringify(file, null, 2));
  console.log(`Updated ${filePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
