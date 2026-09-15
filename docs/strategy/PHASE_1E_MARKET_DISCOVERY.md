# PHASE_1E_MARKET_DISCOVERY.md — Multi-Pair & Multi-DEX Market Discovery Engine

> **STATUS**: **IMPLEMENTED & VALIDATED**  
> **SCOPE**: Research & Observation Only (Phase 1E)  
> **EXECUTION**: **LOCKED** (Zero live trading, zero transaction signing, zero private keys, zero capital deployment)  
> **EPISTEMIC TAGGING**: [FACT] = verified code/data, [ASSUMPTION] = hypothesis requiring validation, [PROVISIONAL] = working heuristic, [ESTIMATE] = model calculation  

---

## 1. Executive Summary & Mission

Phase 1E transforms SAHIKARA from a single-pair (WETH/USDC) two-venue (Uniswap V3 vs. Aerodrome Volatile) observation experiment into an extensible, multi-pair, multi-DEX market discovery and execution modeling engine.

### The Problem Solved
In Phase 1D, empirical baseline collection established that WETH/USDC on Base between Uniswap V3 (5 bps) and Aerodrome Volatile (30 bps) offered zero qualifying arbitrage opportunities across 17,370 round-trips over 30.8 hours. All observations were rejected because the pool fee hurdle (35 bps total) exceeded the gross market spread. 

Phase 1E removes the architectural bottlenecks that prevented broader market observation by introducing:
1. **Dynamic Multi-Pair Universe**: Configurable token pairs (`pairs.ts`) with research lifecycle statuses (`BASELINE_ACTIVE`, `RESEARCH_CANDIDATE`, `UNVERIFIED`).
2. **Multi-DEX Pool Registry & Adapters**: Structured registry supporting Uniswap V3, Aerodrome Volatile/Stable, PancakeSwap V3, and Aerodrome Slipstream (stub/`NOT_READY`).
3. **RPC Abstraction & Provider Management**: Resilient provider routing with URL credential masking, latency percentiles (p50/p90/p99), health tracking, rate-limit/timeout handling, bounded retries, and circuit breaker.
4. **Multicall3 Batching**: Standardized multicall integration (`0xca11bde05977b3631167028862be2a173976ca11`) with per-call error isolation (`allowFailure: true`) and throughput metrics.
5. **Deterministic Dynamic Route Generation**: Pairwise 2-hop route generator supporting arbitrary cross-DEX topologies without combinatorial explosion.
6. **Granular Pool-Level Observation Identity**: Deduplication based on `(pool_leg1, pool_leg2, amount_in, block_number)`, preventing collisions across different fee tiers or factories.

---

## 2. Market Discovery Architecture

```
                 Pool Registry (pools.ts)
                           │
                           ▼
               Token Universe (pairs.ts)
                           │
                           ▼
               RouteGenerator (RouteGenerator.ts)
              (Pairwise 2-Hop Distinct DEX Routes)
                           │
                           ▼
          MarketDiscoveryEngine / MarketObserver
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         Leg 1 Quote               Leg 2 Quote
     (DEX A Quoter/Router)     (DEX B Quoter/Router)
              │                         │
              └────────────┬────────────┘
                           ▼
               Round-Trip Economics Engine
                 - Gross Profit = Out - In
                 - Quoted fees included in output
                 - Gas estimation (2-hop)
                 - Risk buffer deduction
                           │
                           ▼
               ObservationStore (SQLite WAL)
             Unique: (pool1, pool2, size, block)
```

---

## 3. Supported Venues & Protocols (Base Mainnet)

| Protocol | Pool Type | Status | Quote Mechanism | Fee Model |
| :--- | :--- | :--- | :--- | :--- |
| **Uniswap V3** | Concentrated Liquidity | **ACTIVE** [FACT] | QuoterV2 `quoteExactInputSingle` via `eth_call` | Dynamic / Tiered (500, 3000, 10000) |
| **Aerodrome Volatile** | Standard Constant Product AMM | **ACTIVE** [FACT] | Aerodrome Router `getAmountsOut` via `eth_call` | Fixed pool fee (30 bps) |
| **Aerodrome Stable** | StableSwap Curve AMM | **ACTIVE** [FACT] | Aerodrome Router `getAmountsOut` via `eth_call` | Fixed pool fee (1-5 bps) |
| **PancakeSwap V3** | Concentrated Liquidity | **INTEGRATED** [FACT] | QuoterV2 `quoteExactInputSingle` via `eth_call` | Tiered (100, 500, 2500, 10000) |
| **Aerodrome Slipstream** | Concentrated Liquidity (CL200) | **STUB / NOT_READY** [PROVISIONAL] | Adapter stub returns `NOT_READY`; zero quotes fabricated | Tiered (tick spacing) |

---

## 4. Separation of Discovery vs. Executable Profitability

A core directive of SAHIKARA is strict epistemic separation:
- **Spot Price Discrepancy**: A mathematical difference in zero-size marginal prices between two venues. Does NOT imply executable profit.
- **Quoted Executable Difference**: The difference in token output returned by on-chain quoter contracts for a specific trade size, already factoring in slippage and pool fees.
- **Net Round-Trip Profit**: Executable token return minus gas execution costs and safety risk buffers.

In Phase 1E:
```
grossRoundTripPnL = finalAmountOut - initialAmountIn
netExpectedPnL = grossRoundTripPnL - gasCost - riskBuffer
```
Pool fees are **never double-counted**: because quoter contracts return net output after pool fees, fee metadata is retained for attribution but not subtracted a second time.

---

## 5. Phase 1E Validation Results

Short read-only validation was executed against live Base Mainnet across 3 consecutive cycles:
- **Blocks Observed**: Head block advancing through 51357778
- **Pools Scanned**: 4 configured active pools
- **Routes Evaluated**: 6 distinct cross-DEX routes per trade size (18 total evaluations per cycle)
- **Trade Sizes**: $1.00, $5.00, $10.00 USD
- **Quoter Accuracy**:
  - Uniswap V3: Successful live executable quotes
  - Aerodrome: Successful live executable quotes
  - PancakeSwap V3: Handled contract revert safely (`QUOTE_FAILED`), zero fabricated data
  - Slipstream: Safely bypassed via `supports() === false`
- **Database Insertion**: 54 one-way quotes and 54 round-trips persisted idempotently
- **Integrity**: 0 logical duplicates, 0 data corruption, 100% PRAGMA pass.
