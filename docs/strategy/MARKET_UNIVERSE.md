# SAHIKARA — Multi-Pair Research Universe (Phase 1F)

> **STATUS**: ACTIVE RESEARCH UNIVERSE
> **CHAIN**: Base Mainnet (`chain_id: 8453`)
> **MODE**: Read-Only Observation & Econometric Modeling

---

## 1. Research Universe Overview

Rather than scanning hundreds of unvetted, low-liquidity pairs, Phase 1F establishes a disciplined research universe of **7 high-conviction candidate pairs** spanning different market regimes:
1. **Major Liquid Asset**: `WETH/USDC`
2. **Protocol Governance**: `AERO/USDC`
3. **Ecosystem & Social Tokens**: `DEGEN/WETH`, `VIRTUAL/WETH`
4. **Wrapped BTC Asset**: `cbBTC/WETH`
5. **Stablecoin Pegged Pair**: `USDC/USDbC`
6. **Liquid Staking Yield Asset**: `wstETH/WETH`

---

## 2. Token Specification & On-Chain Verification

| Symbol | Contract Address | Decimals | On-Chain Bytecode | Truth Tier | Role in Universe |
|---|---|---|---|---|---|
| **WETH** | `0x4200000000000000000000000000000000000006` | 18 | 4,084 bytes | `[FACT]` | Primary base asset & liquidity benchmark |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 | 3,706 bytes | `[FACT]` | Native Circle USD quote currency |
| **USDbC** | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | 6 | 3,706 bytes | `[FACT]` | Bridged USD (legacy peg tracking) |
| **AERO** | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 | 9,474 bytes | `[FACT]` | Aerodrome governance token |
| **DEGEN** | `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` | 18 | 23,218 bytes | `[FACT]` | Base ecosystem high-volatility token |
| **VIRTUAL** | `0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b` | 18 | 29,700 bytes | `[FACT]` | Virtuals Protocol AI agent asset |
| **cbBTC** | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 | 3,102 bytes | `[FACT]` | Coinbase Wrapped BTC on Base |
| **wstETH** | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` | 18 | 6,594 bytes | `[FACT]` | Lido Wrapped Staked ETH |

---

## 3. Pair Configurations & Multi-DEX Coverage

### 1. `WETH/USDC` (Baseline Active)
- **Pools Registered**: 4 distinct pools across 3 DEXs:
  - Uniswap v3 (0.05% fee, `0xd0b5...`)
  - Aerodrome Volatile (0.30% fee, `0xcDAC...`)
  - Aerodrome Slipstream (0.05% fee / ts=50, `0x3FE0...`)
  - PancakeSwap v3 (0.05% fee, `0xB775...`)
- **Key Cross-DEX Combinations**:
  - UniV3 ↔ Slipstream: **10 bps total fee friction** (vs 35 bps in Phase 1D)
  - UniV3 ↔ PancakeSwap v3: **10 bps total fee friction**
  - PancakeSwap v3 ↔ Slipstream: **10 bps total fee friction**
  - UniV3 ↔ Aerodrome Volatile: **35 bps baseline friction**

### 2. `AERO/USDC` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.30% fee, `0x2426...`)
  - Aerodrome Volatile (0.30% fee, `0x6cDc...`)
- **Friction**: 60 bps total round-trip fee friction.
- **Thesis**: Native DEX governance token frequently experiences dislocation between Uniswap and Aerodrome during reward distribution cycles.

### 3. `DEGEN/WETH` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.30% fee, `0xc903...`)
  - Aerodrome Volatile (0.30% fee, `0x2C49...`)
- **Friction**: 60 bps total round-trip fee friction.
- **Thesis**: Meme and ecosystem momentum token with sharp retail volume spikes.

### 4. `VIRTUAL/WETH` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.30% fee, `0x1D4d...`)
  - Aerodrome Volatile (0.30% fee, `0x2159...`)
- **Friction**: 60 bps total round-trip fee friction.
- **Thesis**: Rapidly growing volume on Base with divergent liquidity pools.

### 5. `cbBTC/WETH` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.05% fee, `0x7AeA...`)
  - Aerodrome Volatile (0.30% fee, `0x2578...`)
  - Aerodrome Slipstream (0.01% fee / ts=10, `0x42d4...`)
- **Friction**:
  - UniV3 ↔ Slipstream: **6 bps total fee friction**!
- **Thesis**: Extremely low swap friction on high-value asset pair.

### 6. `USDC/USDbC` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.01% fee, `0x0695...`)
  - Aerodrome Stable (0.05% fee, `0x27a8...`)
- **Friction**: 6 bps total round-trip fee friction.
- **Thesis**: Stablecoin peg dislocation research under tight bands.

### 7. `wstETH/WETH` (Research Candidate)
- **Pools Registered**:
  - Uniswap v3 (0.01% fee, `0x20E0...`)
- **Status**: Registered, paired against upcoming Slipstream liquid staking pool.

---

## 4. Route Generation Rules
- Routes are generated deterministically by `RouteGenerator.ts`.
- Self-loops (`poolA.address === poolB.address`) are strictly rejected.
- Each pair produces bidirectional 2-hop round trips:
  - Leg 1: Base Token -> Quote Token on Pool A
  - Leg 2: Quote Token -> Base Token on Pool B
- Total combinatorial routes generated across active pools: **18 distinct round-trip routes**.
