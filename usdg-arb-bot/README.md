# USDG Peg Arb Bot (Robinhood Chain)

Standalone Next.js app that:

1. Discovers **Uniswap v4** pools involving **USDG** on **Robinhood Chain (4663)**
2. Quotes a **USDG ↔ PEG** path (your 1:1 stable pair)
3. When the rate drifts from **1:1** beyond a threshold, flash-borrows **USDG** and swaps to restore the peg

## Stack

- Next.js App Router
- viem
- Uniswap v4 Quoter / StateView / PoolManager on RH
- Optional `PegArbFlash.sol` executor for atomic flash + swap

## Addresses (Robinhood mainnet)

| Contract | Address |
|----------|---------|
| USDG | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` |
| PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| Quoter | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` |
| Universal Router | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |

Known USDG pools (ETH/USDG, WETH/USDG) are seeded; DexScreener / GeckoTerminal discovery fills more.

## Setup

```bash
cd usdg-arb-bot
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Env

| Key | Purpose |
|-----|---------|
| `RH_RPC_URL` | Robinhood RPC |
| `PRIVATE_KEY` | Bot signer (server only) |
| `PEG_TOKEN_ADDRESS` | Stable paired with USDG for the 1:1 peg (required for quotes) |
| `PEG_TOKEN_DECIMALS` | Default `6` |
| `ARB_THRESHOLD_BPS` | Trigger when \|rate−1\| ≥ this (default 20) |
| `TRADE_SIZE_USDG` | Notional to quote / flash |
| `DRY_RUN` | `1` = quote only (default) |
| `PEG_ARB_EXECUTOR` | Deployed `PegArbFlash` address for live txs |

## API

- `GET /api/pools` — USDG Uniswap v4 pools
- `GET /api/quote` — USDG→PEG rate vs 1:1
- `GET /api/scan` — full scan + opportunity
- `POST /api/execute` — dry-run or live flash arb

## Live execution

1. Deploy `contracts/PegArbFlash.sol` with PoolManager + USDG
2. Implement `_swap` with Universal Router / v4 path (skeleton reverts until wired)
3. Set `PEG_ARB_EXECUTOR`, `DRY_RUN=0`, fund gas
4. `POST /api/execute`

## Peg note

There is no on-chain rUSD on Robinhood today (Resarv rUSD is on Somnia). Point `PEG_TOKEN_ADDRESS` at whatever USD stable you keep 1:1 with USDG on RH (e.g. U), or a bridged rUSD when that exists.
