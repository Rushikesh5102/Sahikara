# REAL_TIME_EVENT_INGESTION.md — Real-Time Event Ingestion Technical Blueprint

> **COMPONENT**: `scanner/src/events/`  
> **STATUS**: RATIFIED & IMPLEMENTED (Phase 2)  
> **TARGET CHAIN**: Base Mainnet (`chain_id: 8453`)

---

## 1. Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BASE MAINNET                                        │
│  Uniswap v3 (5bps/30bps) │ Aerodrome Volatile/Stable │ Slipstream │ PancakeSwap v3    │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                        WebSocket / HTTP Event Logs (Swap, Sync, Blocks)
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MarketEventWatcher                                     │
│  - WebSocket Connection & Heartbeat                                                    │
│  - Auto-Reconnect with Exponential Backoff (1s -> 2s -> 4s -> 10s)                     │
│  - HTTP Event Log Polling Fallback                                                     │
│  - Deduplication Engine (txHash:logIndex LRU Cache)                                    │
│  - Stale Block Filter (highestBlockSeen - 2)                                           │
│  - Intra-Block Log Index Sorter                                                        │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                               PoolStateChangeEvent
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                EventRouteDispatcher                                    │
│  - Inverted Pool Index (routesByPool)                                                  │
│  - Filter Affected Routes ONLY (e.g. 6 of 26 routes)                                   │
│  - Pin Block Number to Event Block                                                     │
│  - Batch eth_call Quotes with Multicall3                                               │
│  - Atomic Round-Trip Evaluation & Classification                                       │
│  - Latency Measurement (Date.now() - event.receiptTimestampMs)                         │
└────────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
┌─────────────────────────────────┐     ┌────────────────────────────────────────────────┐
│        ObservationStore         │     │             Opportunity Candidates             │
│  - round_trip_observations DB   │     │  - opportunity_candidates DB Table             │
│  - Logical Pool Deduplication   │     │  - Full Event Reconstruction Context           │
│  - SQLite WAL Mode              │     │  - Historical Replay Engine (EventReplayer)    │
└─────────────────────────────────┘     └────────────────────────────────────────────────┘
```

---

## 2. Inverted Pool Index Mathematics

Given a universe of $N_{\text{pairs}}$ and $M_{\text{pools}}$, the `RouteGenerator` dynamically constructs bidirectional 2-hop spatial arbitrage cycles:

$$\mathcal{R} = \{ R_1, R_2, \dots, R_k \}$$

Where each route $R_i$ comprises:
- $\text{Leg}_1$: Pool $P_{i,1}$, Token $\text{In}_1 \to \text{Out}_1$
- $\text{Leg}_2$: Pool $P_{i,2}$, Token $\text{In}_2 \to \text{Out}_2$

In Phase 1, evaluating all routes required $2 \cdot |\mathcal{R}| \cdot S$ quote calls per cycle (where $S$ is the number of trade sizes).

In Phase 2, `EventRouteDispatcher` constructs the inverted mapping:

$$\mathcal{I}: P \mapsto \{ R \in \mathcal{R} \mid P \in \{ \text{Pool}(R.\text{leg}_1), \text{Pool}(R.\text{leg}_2) \} \}$$

When pool $P^*$ emits a state transition event $E$:

$$\text{RoutesToEvaluate} = \mathcal{I}(P^*)$$

For Base Mainnet ($|\mathcal{R}| = 26$):
- A swap on `WETH/USDC` Uniswap V3 (5 bps) triggers exactly **6 routes**:
  - `UniV3 ↔ Aero Volatile` (2 routes)
  - `UniV3 ↔ Aero Slipstream` (2 routes)
  - `UniV3 ↔ PancakeSwap V3` (2 routes)
- The remaining **20 routes** are untouched, eliminating **76.9% of redundant RPC traffic** and shrinking cycle time to sub-second durations.

---

## 3. End-to-End Latency Profile

The total detection latency $\tau_{\text{det}}$ is measured deterministically from packet receipt to database commit:

$$\tau_{\text{det}} = t_{\text{commit}} - t_{\text{receipt}}$$

Where:
1. $t_{\text{receipt}}$: Timestamp when WebSocket message arrives in Node.js event loop.
2. $t_{\text{index}}$: Inverted pool index resolution ($<1\text{ ms}$).
3. $t_{\text{quote}}$: Parallel / batched `eth_call` round trips to Base L2 RPC ($150–350\text{ ms}$).
4. $t_{\text{eval}}$: Off-chain exact math, pool fee deduction, gas pricing, and classification ($<2\text{ ms}$).
5. $t_{\text{commit}}$: SQLite WAL atomic write ($<3\text{ ms}$).

Total detection latency targets:
- $\text{p50} < 400\text{ ms}$
- $\text{p90} < 800\text{ ms}$
- $\text{p99} < 1,500\text{ ms}$
