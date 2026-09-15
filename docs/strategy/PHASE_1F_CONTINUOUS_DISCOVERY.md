# SAHIKARA Phase 1F — Continuous Multi-Pair Market Discovery & Quote Validation

> **STATUS**: PHASE 1F EXECUTION & CONTROLLED VALIDATION
> **CHAIN**: Base Mainnet (`chain_id: 8453`)
> **SECURITY DIRECTIVE**: Strictly read-only research. Zero private keys, zero wallet signing, zero transaction dispatch. SAHIKARA execution remains LOCKED.

---

## 1. Executive Summary

Phase 1D established our single-pair baseline on Base Mainnet for **WETH/USDC** (Uniswap v3 5 bps + Aerodrome Volatile 30 bps = **35 bps total fee friction**). Over a continuous 30.8-hour observation window (43,500 one-way quotes, 17,370 round-trips), the baseline proved that:
- Zero positive gross round trips occurred across 17,370 observations.
- Swap friction of 35 bps completely dwarfed transient spread dislocations between classical AMMs.

Phase 1E expanded the architecture to support multi-pair routing, multi-DEX abstraction, and Multicall3 batching.

**Phase 1F transforms this architecture into an active multi-pair discovery engine** by:
1. **Resolving PancakeSwap V3**: Diagnosed the root cause of `0x` reverts (misconfigured address with 0 bytecode), deployed verified canonical QuoterV2 (`0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`) and active pool (`0xB775272E537cc670C65DC852908aD47015244EaF`).
2. **Activating Aerodrome Slipstream**: Upgraded adapter from `NOT_READY` stub to live quoting engine using verified MixedQuoterV3 (`0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555`) with `tickSpacing` parameterization.
3. **Slashing Pool Fee Friction by ~71%**: Connecting UniV3 (5 bps) ↔ Aero Slipstream (5 bps) ↔ PancakeSwap V3 (5 bps), lowering total pool friction from **35 bps to 10 bps**.
4. **Expanding Universe to 7 High-Conviction Pairs**: Covering major liquid assets, protocol tokens, memecoins, wrapped BTC, and stablecoins across 16 verified pools.
5. **Standardizing Opportunity Classifications**: Introducing 8 deterministic classifications (`NO_OPPORTUNITY`, `SPREAD_TOO_SMALL`, `QUOTE_FAILED`, `INSUFFICIENT_LIQUIDITY`, `GAS_TOO_HIGH`, `SLIPPAGE_TOO_HIGH`, `RISK_REJECTED`, `POTENTIAL_CANDIDATE`).
6. **Executing Controlled Validation & Review Matrices**: Generating Pair, Pair Profitability, and DEX Matrices before extended continuous collection.

---

## 2. Multi-DEX Architecture & Low-Friction Routing

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SAHIKARA OBSERVER (Base)                        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Uniswap v3     │       │  Aero Slipstream │       │  PancakeSwap v3  │
│     (5 bps)      │◄─────►│   (ts=50 / 5bps) │◄─────►│     (5 bps)      │
└────────┬─────────┘       └─────────┬────────┘       └─────────┬────────┘
         │ 10 bps total              │ 10 bps total             │
         │ friction                  │ friction                 │
         └───────────────────────────┴──────────────────────────┘
                         10 bps total friction
```

By concentrating research across concentrated liquidity AMMs on Base:
- **Phase 1D Friction**: 35 bps (Uniswap v3 5 bps + Aerodrome Volatile 30 bps).
- **Phase 1F Friction**: 10 bps (Uniswap v3 5 bps + Aerodrome Slipstream 5 bps, or Uniswap v3 5 bps + PancakeSwap v3 5 bps).
- **Net Improvement**: Requires only **10 bps price dislocation** to produce a positive gross round trip, compared to 35 bps previously.

---

## 3. Data Integrity & Storage Management

1. **Logical Pool-Level Deduplication**:
   - Unique index `idx_rt_logical_pool_unique ON round_trip_observations (pool_leg1, pool_leg2, amount_in, block_number)`.
   - Guaranteed zero duplicate entries across multiple cycles observing the same block.
2. **Storage Growth Model**:
   - 26 routes × 3 trade sizes = 78 round trips per cycle (~2.5 KB uncompressed per cycle).
   - At 12-second polling intervals: ~750 KB per hour (~18 MB per 24 hours).
   - Node.js native `node:sqlite` in WAL mode handles concurrent read/write seamlessly.
3. **Automated Backups & Health**:
   - SQLite online VACUUM backup script (`npm run backup`) guarantees point-in-time recovery without database locks.
   - Comprehensive health script (`npm run health`) monitors DB size, WAL size, activity age, error counts, and duplicate integrity.

---

## 4. Preparation for AI Research Agents

The collected observation dataset in SQLite provides structured feature vectors designed for future consumption by AI research agents:
- `route`: specific pair and pool path
- `dex_leg1` & `dex_leg2`: DEX combination
- `gross_spread_bps`: raw market price difference
- `pool_fees`: total swap friction
- `gas_cost`: L2 execution cost
- `net_profit_bps`: theoretical net return
- `latency`: RPC response time
- `status` & `rejection_reason`: deterministic gate result

Future AI agents can analyze these distributions to propose hypothesis-driven experiments (e.g. "Monitor DEGEN/WETH volatility spikes around US market open"). Deterministic SAHIKARA independently verifies and executes the observation protocol without granting autonomous execution authority.
