# SAHIKARA Phase 2 — Real-Time Event-Driven Market Intelligence & Opportunity Detection

> **STATUS**: PHASE 2 IMPLEMENTATION & CONTROLLED EMPIRICAL VALIDATION  
> **CHAIN**: Base Mainnet (`chain_id: 8453`)  
> **DIRECTIVE**: Strictly read-only research. Zero private keys, zero wallet signing, zero live trading. Execution remains LOCKED.

---

## 1. Executive Summary

Phase 1 established our multi-pair, multi-DEX market discovery baseline across 7 verified token pairs and 16 on-chain pools on Base Mainnet. While Phase 1F successfully activated low-fee pools (10 bps round-trip friction across Uniswap V3, Aerodrome Slipstream, and PancakeSwap V3), its **periodic sequential polling architecture** (evaluating all 26 routes sequentially every ~50 seconds) introduced an unavoidable architectural limitation:

> **The Polling Latency Barrier**: In competitive on-chain markets, price dislocations created by large swaps or volatility spikes are transient—often corrected within 1–3 blocks (2–6 seconds on Base). A sequential polling scanner running on a 30–50s cycle is mathematically blind to opportunities that appear and disappear between polling intervals.

**Phase 2 breaks the polling latency barrier by implementing an event-driven market intelligence engine**:
1. **Real-Time Streaming**: Ingests `Swap` and `Sync` event logs and new block headers via Base WebSockets (`wss://...`) with automated heartbeat, exponential backoff reconnection, and fallback to HTTP event log polling.
2. **Selective Route Inversion**: Rather than polling all 26 routes, an inverted pool index (`routesByPool`) maps each event to **only the affected routes** (e.g. 6 routes for WETH/USDC, a 76.9% reduction in quote volume).
3. **Sub-Second Detection Latency**: End-to-end detection latency (event receipt $\to$ selective re-quoting $\to$ atomic round-trip evaluation $\to$ deterministic classification $\to$ candidate persistence) operates within sub-second to low-second windows.
4. **State Consistency & Zero Block Drift**: Every quote is pinned to the exact `blockNumber` of the triggering event, guaranteeing both legs evaluate against identical state.
5. **Candidate Persistence**: Introduces the `opportunity_candidates` table in SQLite, persisting complete reconstruction context for every candidate.
6. **Deterministic Event Replay**: Guarantees that historical event streams replayed through the engine produce bitwise reproducible route selections, fee calculations, and classifications.

---

## 2. Event-Driven Architecture vs Sequential Polling

```
─────────────────────────────────────────────────────────────────────────────
PHASE 1F: PERIODIC SEQUENTIAL POLLING (~50,000ms Cycle Time)
─────────────────────────────────────────────────────────────────────────────
[Timer: 30s] ──► Query Block ──► Route 1 ──► Route 2 ──► ... ──► Route 26 ──► Store
               (All 26 routes queried regardless of whether pool state changed)
               Total Quotes: 156 calls | Execution Window: ~50 seconds

─────────────────────────────────────────────────────────────────────────────
PHASE 2: REAL-TIME EVENT-DRIVEN DISPATCH (Sub-Second Latency)
─────────────────────────────────────────────────────────────────────────────
[Pool Swap Event] (e.g. WETH/USDC UniV3 5bps)
        │
        ▼ (t = 0ms)
[MarketEventWatcher] ──► Deduplication Filter ──► In-Order Sorter
        │
        ▼ (t = 12ms)
[Inverted Pool Index] ──► Identifies 6 Affected Routes (20 Unaffected Routes Bypassed)
        │
        ▼ (t = 45ms)
[Block-Pinned Quoting] ──► Pinned to Event BlockNumber ──► Multicall3 Fault Isolation
        │
        ▼ (t = 180ms)
[Round-Trip Evaluator] ──► Gross Diff ──► Fees ──► Gas ──► Slippage
        │
        ▼ (t = 220ms)
[8 Classifications] ──► If CANDIDATE ──► Persist to opportunity_candidates Table
```

### Quantitative Architectural Comparison

| Dimension | Phase 1F (Sequential Polling) | Phase 2 (Event-Driven) | Improvement |
| :--- | :--- | :--- | :--- |
| **Trigger Mechanism** | Wall-clock timer (`pollIntervalMs`) | On-chain `Swap`/`Sync` event logs & block headers | Real-time reactivity |
| **Routes Evaluated** | All 26 routes indiscriminately | Only affected routes touching the event pool | **76.9% reduction** |
| **Quotes per Trigger** | 156 quotes (26 routes × 3 sizes × 2 legs) | 36 quotes (6 routes × 3 sizes × 2 legs) | **76.9% reduction** |
| **Detection Lag** | 15–50 seconds average | Sub-second to ~3 seconds | **>90% latency reduction** |
| **Block Drift Risk** | Moderate (block may increment during 50s cycle) | Zero (quotes pinned to triggering `blockNumber`) | State consistency |
| **RPC Efficiency** | Exhausts free tier quickly on tight intervals | Bounded strictly to actual pool trading activity | High compute efficiency |

---

## 3. Opportunity Classification Framework

Phase 2 preserves the 8 mutually exclusive deterministic classifications:

1. `NO_OPPORTUNITY`: Gross round trip difference $\le 0$ (prices within friction/equilibrium).
2. `SPREAD_TOO_SMALL`: Gross spread positive, but net profit $\le \Pi_{\text{min}}$ ($0.05 USD).
3. `QUOTE_FAILED`: Adapter call reverted or pool lacks quoting mechanism.
4. `INSUFFICIENT_LIQUIDITY`: Input amount exceeds pool depth (zero output).
5. `GAS_TOO_HIGH`: Gas costs exceed gross round trip gain.
6. `SLIPPAGE_TOO_HIGH`: Price impact on either leg exceeds threshold (100 bps).
7. `RISK_REJECTED`: Fails configured risk parameters or token transfer policies.
8. `POTENTIAL_CANDIDATE`: Passes all cost deductions and constraints with net expected profit $> \Pi_{\text{min}}$.

---

## 4. Fault Tolerance & Resilience Specifications

The `MarketEventWatcher` implements strict defensive mechanisms against adversarial and network failure modes:

- **Sliding Window Deduplication**: Sliding LRU cache (10,000 entries) of `${txHash}:${logIndex}` ensures that duplicate WebSocket deliveries or duplicate block logs are rejected.
- **Stale Block Filter**: Events with `blockNumber < highestBlockSeen - 2` are dropped immediately, preventing outdated state from triggering phantom quotes.
- **Intra-Block Ordering**: Event logs arriving within the same block are sorted ascending by `logIndex` before dispatch, guaranteeing deterministic execution order.
- **Dual Transport Failover**: If the primary WebSocket stream drops, the watcher automatically backs off exponentially (1s, 2s, 4s, up to 10s) and transparently falls back to HTTP log polling.
- **Candidate Persistence**: Candidates are stored in SQLite with full event metadata (`detection_latency_ms`, `trigger_event_type`, `trigger_pool_address`, `raw_details_json`).

---

## 5. Security & Invariant Enforcement

- Execution remains **LOCKED**.
- Zero private keys or mnemonics exist in the codebase.
- Zero wallet clients or signing functions are imported or invoked.
- Zero live transactions are submitted to any mempool or RPC relay.
- Capital deployed: **₹0.00 / $0.00**.
