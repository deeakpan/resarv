# Liquity CDP on Robinhood Chain

Cloned from [liquity/dev](https://github.com/liquity/dev) (Liquity v1, GPL-3.0). Contracts live in `packages/contracts`. The public Dev UI lives in `packages/dev-frontend`.

Robinhood Chain is wired into Hardhat as:

| Hardhat network | Chain ID | RPC | Explorer |
| --- | --- | --- | --- |
| `rhMainnet` | `4663` | `https://rpc.mainnet.chain.robinhood.com` | https://robinhoodchain.blockscout.com |
| `rhTestnet` | `46630` | `https://rpc.testnet.chain.robinhood.com` | https://explorer.testnet.chain.robinhood.com |

There is no Chainlink ETH/USD feed on Robinhood yet, so deploys use Liquity's `PriceFeedTestnet`. Set the price from the Dev UI after deploy.

## Setup

```bash
cd cdp-app
cp .env.example .env
```

Put a funded deployer key in `.env`. Then install and compile:

```bash
yarn install
yarn compile
```

If Yarn 3 is missing, compile from the contracts package (verified on Node 24):

```bash
cd packages/contracts
npm install --no-workspaces --legacy-peer-deps --ignore-scripts
npx hardhat compile
node scripts/set-version.js
```

## Deploy

Always target a named Robinhood network. Omitting `--network` deploys to a throwaway local Hardhat chain.

```bash
# from cdp-app/
yarn deploy:rh-testnet
yarn deploy:rh-mainnet
```

That writes `packages/lib-ethers/deployments/default/rhTestnet.json` (or `rhMainnet.json`) and copies it next to the other deployment manifests so the UI can load it.

## Dev UI

```bash
yarn start-dev-frontend
```

Connect a wallet to Robinhood Chain (4663) or Robinhood Chain Testnet (46630). Open a Trove, deposit ETH, mint LUSD, and use the Stability Pool from the cloned Liquity interface.

## License

Liquity v1 is GPL-3.0. Keep `LICENSE` with any distribution of these contracts or UI.
