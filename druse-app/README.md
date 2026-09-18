# Druse

NFT floor liquidity. Deposit a piece into its collection vault, receive 1 pTOKEN, and trade that token for ETH at the Uniswap v4 pool. Redeem 1 pTOKEN to take an NFT back. No listing, no auction.

Built for Robinhood Chain. The live testnet is Unichain Sepolia (chain 1301).

## What it does

- **Vaults.** Mint and redeem 1:1. One NFT in is one pTOKEN out (pSTONK, pMANCER, and so on).
- **Swap.** Sell, buy, or hop collections at floor through Uniswap v4.
- **Pools.** Add ETH and pTOKEN liquidity, or open a pool if none exists yet.
- **Stake.** Stake DRUSE. Protocol fees route into staking and the collection pools.
- **Positions.** Track vault pTOKEN and LP NFTs.

A Druse Uniswap v4 hook takes a cut on pool swaps. Vault mint and redeem take a cut in ETH. Fee-excluded addresses skip the vault fee.

## Stack

Next.js 16 App Router, wagmi, viem, Reown AppKit. Solidity 0.8.15 on Hardhat. Official Uniswap v4 contracts on the target chain (pool manager, position manager, quoter, Universal Router, Permit2, WETH).

## Run the app

```bash
npm install
```

Copy `.env.example` to `.env` and set:

- `PRIVATE_KEY` and `RPC_URL` for contract scripts
- `NEXT_PUBLIC_REOWN_PROJECT_ID` for wallet connect (dummy zeros 403 AppKit)
- `NEXT_PUBLIC_DEMO=true` for mintable testnet NFTs with collection art

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

## Contracts

Sources live in `contracts/`. Addresses live in `deployments/addresses.json` (Uniswap v4 plus the Druse factory, hook, vaults, and demo NFTs). The app reads that file. Do not hardcode addresses.

```bash
npm run compile
npm run deploy:unichain
npm run e2e:unichain
```

`npm run deploy:unichain` writes a fresh Unichain Sepolia deployment into `deployments/addresses.json`, mints demo NFTs 1 through 10, and fee-excludes the deployer.

## Layout

- `app/`: pages, API routes, UI
- `lib/`: chain reads, quotes, formatting
- `config/`: AppKit, Uniswap v4 addresses
- `contracts/`: vaults, factory, hook, staking, fees
- `scripts/`: deploy and maintenance
- `deployments/addresses.json`: canonical addresses per chain
