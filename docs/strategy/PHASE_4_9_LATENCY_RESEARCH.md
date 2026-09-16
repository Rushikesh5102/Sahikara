# PHASE 4.9 — LATENCY RESEARCH & COMPONENT DISAGGREGATION
## Independent Measurement of Network RPC, Event Observation, Contract Quote & Local Math Latency

> **STATUS**: COMPLETE — EMPIRICALLY MEASURED  
> **SCOPE**: Separation of Network Round-Trip Overhead from EVM Simulation Duration  
> **DATASET PRESERVED**: [`scanner/data/rpc_latency_benchmark_phase49.json`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/data/rpc_latency_benchmark_phase49.json)  
> **SAFETY INVARIANT**: Capital at risk remains strictly **₹0.00 / $0.00**. Execution strictly locked. Phase 5 strictly blocked.

---

## 1. Executive Summary & Epistemic Boundary

In Phase 4.8, the duration required to fetch multi-leg DEX quotes (550 ms to 1,975 ms) was loosely termed "Public RPC latency". This conflated:
1. Physical network round-trip packet transmission (ping/HTTP connection).
2. JSON-RPC serialization and deserialization.
3. Node-internal EVM execution of complex Quoter contracts traversing tick arrays.
4. Local in-memory mathematics and risk filtering.

To satisfy the Phase 4.9 master directive, the [`RpcLatencyBenchmark`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/rpc/RpcLatencyBenchmark.ts) disaggregated these layers and independently benchmarked five core JSON-RPC methods across Base, Arbitrum One, Optimism, and Polygon PoS.

---

## 2. Empirical Benchmark: Five Core RPC Methods

The benchmark executed live calls against canonical public endpoints, recording request timestamp, response timestamp, duration, block height, and response status.

```
┌──────────┬─────────────────────────────┬───────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬────────────────┐
│ Chain    │ Public Provider URL         │ Block     │ eth_blockNum │ eth_getBlock │ eth_call     │ multicall    │ eth_getLogs  │ Median Net RPC │
├──────────┼─────────────────────────────┼───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ Base     │ https://mainnet.base.org    │ 51402653  │ 416 ms       │ 366 ms       │ 273 ms       │ 272 ms       │ 261 ms       │ 273 ms         │
│ Arbitrum │ https://arb1.arbitrum.io/rpc│ 505887697 │ 508 ms       │ 287 ms       │ 284 ms       │ 329 ms       │ 287 ms       │ 287 ms         │
│ Optimism │ https://mainnet.optimism.io │ 134591240 │ 674 ms       │ 898 ms       │ 405 ms       │ 467 ms       │ 496 ms       │ 496 ms         │
│ Polygon  │ https://polygon-bor-rpc...  │ 93924102  │ 319 ms       │ 306 ms       │ 276 ms       │ 271 ms       │ 285 ms       │ 285 ms         │
└──────────┴─────────────────────────────┴───────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴────────────────┘
```

### Key Analytical Insights
1. **Raw Network RPC Latency**:
   - The median network latency across simple read calls (`eth_call` on `slot0`, `multicall`, `eth_getLogs`) ranges between **271 ms and 496 ms**.
   - `eth_blockNumber` and `eth_getBlockByNumber` exhibit occasional outlier spikes (up to 898 ms on Optimism) due to public endpoint caching and load-balancer routing delays.
2. **Quote Simulation Latency**:
   - A single-hop Uniswap v3 / Slipstream Quoter call requires the node to instantiate an EVM state machine, step through ticks, calculate square root price limits, and accumulate token fees.
   - For a 2-hop route, compound simulation requires 540 ms to 810 ms.
   - For a 3-hop triangular route, sequential simulation requires 850 ms to 1,975 ms.
3. **Local Evaluation Latency**:
   - Once raw quote outputs are received, SAHIKARA's in-memory BigInt arithmetic, fee accounting, gas modeling, and candidate validation takes **$\le 1.0$ ms**.
   - Local processing latency is statistically negligible compared to network and EVM simulation delays.

---

## 3. Disaggregated Latency Component Breakdown

```
┌──────────────────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Latency Component                    │ Base        │ Arbitrum    │ Optimism    │ Polygon     │
├──────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ 1. Raw Network RPC Latency (Median)  │ 273 ms      │ 287 ms      │ 496 ms      │ 285 ms      │
│ 2. Event Observation Latency (Logs)  │ 1,278 ms    │ 2,296 ms    │ 2,917 ms    │ 41 ms       │
│ 3. Compound Quote Simulation (2-hop) │ 546 ms      │ 568 ms      │ 810 ms      │ 552 ms      │
│ 4. Economic Evaluation Latency       │ 1 ms        │ 1 ms        │ 1 ms        │ 1 ms        │
├──────────────────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Total Detection-to-Evaluation        │ 820 ms      │ 856 ms      │ 1,307 ms    │ 838 ms      │
└──────────────────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

> [!NOTE]
> **Event Observation Latency on Rollups**:
> On Base, Arbitrum, and Optimism, the timestamp in block headers reflects the moment the sequencer cut the block. Because public RPC nodes receive blocks via P2P gossip after sequencer commitment and batching, public event arrival lags the sequencer's internal timestamp by 1.2 to 2.9 seconds. On Polygon PoS Bor, block propagation is direct P2P (41 ms lag).

---

## 4. Latency Replay & Opportunity Half-Life ($0\text{ms}$ to $5\text{s}$)

### 4.1 Latency Replay Protocol
The Phase 4.9 directive mandates evaluating opportunity decay where subsequent observed states exist across the interval spectrum:
$$\Delta t \in \{0\text{ms}, 10\text{ms}, 25\text{ms}, 50\text{ms}, 100\text{ms}, 250\text{ms}, 500\text{ms}, 1\text{s}, 2\text{s}, 5\text{s}\}$$

#### Critical Negative Finding
- **Zero Sub-Second Re-Quotes Exist in Public Datasets**: Public RPC rate limits (HTTP 429) enforce minimum request spacing of 250 ms to 1,000 ms. Consequently, **no historical empirical state pair exists in SAHIKARA's dataset with $\Delta t < 250\text{ms}$**.
- **No Positive Net Opportunity Repeated Across Time**: Across all 1,493 evaluations in Phase 4.7 and Phase 4.8, exactly 0 positive net opportunities were ever observed.
- In Phase 4.7, 4 gross-positive micro-spreads were observed at block $N$, but in block $N+1$ or upon immediate re-quote ($\Delta t \approx 1,200\text{ms}$ to $2,800\text{ms}$), gross spread had either decayed or remained negative net.

```
┌─────────────┬──────────────────────────┬──────────────────────────┬─────────────────────────────┐
│ Offset Δt   │ Empirical Data Available │ Observed Net PnL         │ Status                      │
├─────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ 0 ms        │ YES (Initial Quote)      │ Negative Net (-$0.0001)  │ REJECTED                    │
│ 10 ms       │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 25 ms       │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 50 ms       │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 100 ms      │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 250 ms      │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 500 ms      │ NO                       │ UNKNOWN                  │ INSUFFICIENT EMPIRICAL DATA │
│ 1,000 ms    │ YES (Block N+1 Requote)  │ Negative Net (-$0.0805)  │ REJECTED                    │
│ 2,000 ms    │ YES (Block N+2 Requote)  │ Negative Net (-$0.0856)  │ REJECTED                    │
│ 5,000 ms    │ YES (Window Expiry)      │ Negative Net (-$0.0890)  │ REJECTED                    │
└─────────────┴──────────────────────────┴──────────────────────────┴─────────────────────────────┘
```

### 4.2 Rejection of Modeled Half-Life Fabrication
In Phase 4.8, a modeled half-life of $T_{\text{half}} \approx 250\text{ms}$ was derived from an assumed exponential decay model:
$$\text{PnL}(t + \Delta t) = \text{PnL}_0 \cdot e^{-\lambda \Delta t}$$

The Phase 4.9 directive strictly forbids presenting this modeled decay as empirical reality. 

Because **no positive net opportunity has ever repeated across successive blocks in SAHIKARA's empirical record**, the only scientifically honest determination is:
$$\mathbf{OPPORTUNITY\ LIFETIME = UNKNOWN}$$

Fabricating an exact half-life from an assumed mathematical curve without underlying empirical observations violates Directive 5 of [`AGENTS.md`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/AGENTS.md).
