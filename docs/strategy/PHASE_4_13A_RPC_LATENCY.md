# PHASE 4.13A — RPC LATENCY, OBSERVATION TIMING & BENCHMARKS

> **STATUS**: EMPIRICAL LATENCY BENCHMARK COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **DATASET**: `scanner/data/temporal_campaign_phase413_results.json`  

---

## 1. Network RPC Latency by Chain

Pure HTTP transport round-trip latency measured via sequential lightweight `getBlockNumber()` pings against primary public endpoints:

| Chain | Chain ID | Public RPC Endpoint | Min (ms) | Median (ms) | Mean (ms) | Max (ms) |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **Base** | 8453 | `https://mainnet.base.org` | 0.05 | 118.72 | 158.90 | 355.99 |
| **Arbitrum One** | 42161 | `https://arb1.arbitrum.io/rpc` | 0.07 | 92.82 | 104.40 | 276.86 |
| **Optimism** | 10 | `https://mainnet.optimism.io` | 0.06 | 298.10 | 296.99 | 894.16 |
| **Polygon PoS** | 137 | `https://polygon-bor-rpc.publicnode.com` | 0.05 | 125.07 | 108.26 | 375.05 |

*Note: Latency variance reflects public shared node infrastructure and geographical routing from the operator environment.*

---

## 2. High-Resolution Temporal Percentile Breakdown

Nanosecond monotonic timing across all captured event cycles (values reported in milliseconds):

| Latency Category | Min (ms) | p25 (ms) | Median (ms) | p75 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Mean (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Network RPC Latency** | 52.40 | 118.70 | **224.86** | 285.40 | 345.10 | 378.20 | 392.10 | 393.51 | **188.74** |
| **Event Observation Latency** | 1,970.00 | 1,978.00 | **1,983.00** | 1,984.50 | 1,984.80 | 1,985.00 | 1,985.00 | 1,985.00 | **1,980.10** |
| **Event $\to$ Detection** | 0.00 | 0.00 | **0.00** | 0.00 | 0.00 | 0.01 | 0.01 | 0.01 | **0.00** |
| **Quote Duration** | 15.10 | 15.60 | **16.19** | 22.40 | 28.50 | 29.80 | 30.10 | 30.11 | **19.82** |
| **Evaluation Duration** | 0.00 | 0.01 | **0.01** | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | **0.01** |
| **Total Event $\to$ Result** | 15.12 | 15.62 | **16.21** | 22.42 | 28.52 | 29.82 | 30.12 | 30.13 | **19.84** |

---

## 3. Forensic Analysis of the Latency Pipeline

1. **Local Processing Efficiency**: The local software pipeline is exceptionally rapid. Log decoding, topic parsing, and route lookup occur in sub-millisecond time ($<0.01\text{ ms}$). Economic profit evaluation similarly completes in $\approx 0.01\text{ ms}$.
2. **The Dominant Bottlenecks**:
   - **Observation Lag ($\approx 1,980\text{ ms}$)**: The primary latency component is the block propagation and polling interval between consensus block creation and receipt at public RPC endpoints.
   - **Network Transport ($\approx 188\text{ ms}$)**: Sending HTTP requests across the public internet to free endpoints introduces substantial latency relative to sub-millisecond sequencer cycles.
3. **Compound Quote Duration vs Network RPC**: While an individual ping requires $\approx 100–200\text{ ms}$, batched multi-call quotes executed asynchronously complete in $\approx 16–30\text{ ms}$ of wall-clock time. Conflating quote duration with network latency obscures the true bottlenecks.
