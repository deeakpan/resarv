process.env.TS_NODE_PROJECT = require("path").join(
  __dirname,
  "tsconfig.hardhat.json"
);
require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");

const rawKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const privateKey =
  rawKey &&
  (() => {
    const k = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    // 32-byte hex key only — ignore placeholders like 0xYOUR_...
    return /^0x[0-9a-fA-F]{64}$/.test(k) ? k : undefined;
  })();

const accounts = privateKey ? [privateKey] : [];

const optimizer = { enabled: true, runs: 100 };

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      { version: "0.4.23", settings: { optimizer } },
      { version: "0.5.17", settings: { optimizer } },
      {
        version: "0.6.11",
        settings: { evmVersion: "istanbul", optimizer },
      },
      {
        version: "0.8.20",
        settings: { optimizer, evmVersion: "paris" },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    somniaTestnet: {
      url:
        process.env.SOMNIA_TESTNET_RPC ||
        process.env.RPC_URL ||
        "https://api.infra.testnet.somnia.network",
      chainId: 50312,
      accounts,
      timeout: 180000,
    },
    unichainSepolia: {
      url:
        process.env.UNICHAIN_SEPOLIA_RPC ||
        "https://sepolia.unichain.org",
      chainId: 1301,
      accounts,
      timeout: 180000,
    },
    rhMainnet: {
      url:
        process.env.RH_MAINNET_RPC ||
        "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
      timeout: 180000,
    },
    rhTestnet: {
      url:
        process.env.RH_TESTNET_RPC ||
        "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts,
      timeout: 180000,
    },
    robinhood: {
      url:
        process.env.RPC_URL ||
        process.env.RH_MAINNET_RPC ||
        "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
      timeout: 180000,
    },
  },
  etherscan: {
    apiKey: {
      somniaTestnet: "empty",
      unichainSepolia: process.env.ETHERSCAN_API_KEY || "empty",
      rhMainnet: "blockscout",
      rhTestnet: "blockscout",
      robinhood: "blockscout",
    },
    customChains: [
      {
        network: "somniaTestnet",
        chainId: 50312,
        urls: {
          apiURL: "https://shannon-explorer.somnia.network/api",
          browserURL: "https://shannon-explorer.somnia.network",
        },
      },
      {
        network: "unichainSepolia",
        chainId: 1301,
        urls: {
          apiURL: "https://api-sepolia.uniscan.xyz/api",
          browserURL: "https://sepolia.uniscan.xyz",
        },
      },
      {
        network: "rhMainnet",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "rhTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};
