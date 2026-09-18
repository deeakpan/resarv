process.env.TS_NODE_PROJECT = require("path").join(
  __dirname,
  "tsconfig.hardhat.json"
);
require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

const privateKey = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : `0x${process.env.PRIVATE_KEY}`
  : undefined;

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.15",
    settings: { optimizer: { enabled: true, runs: 800 } },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    unichainSepolia: {
      url: process.env.RPC_URL || "https://unichain-sepolia-rpc.publicnode.com",
      chainId: 1301,
      accounts: privateKey ? [privateKey] : [],
      timeout: 180000,
    },
    robinhood: {
      url: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts: privateKey ? [privateKey] : [],
      timeout: 180000,
    },
  },
};
