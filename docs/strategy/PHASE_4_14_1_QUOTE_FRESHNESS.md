# PHASE 4.14.1 — Quote Freshness & Micro-Latency Disaggregation

> **PHASE STATUS**: FORENSIC RESEARCH PATCH  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION STATE**: STRICTLY LOCKED (PHASE 5 BLOCKED)

---

## 1. Quote Freshness Policy Framework

In cross-venue high-resolution microstructure research, comparing an off-chain Central Limit Order Book (CLOB) against an automated market maker (AMM) requires establishing the temporal freshness of the evaluated states. 

A quote that is several hundred milliseconds old cannot be represented as "simultaneous" with a live WebSocket feed.

### Multi-Tier Freshness Thresholds:
To prevent arbitrary cutoffs, Phase 4.14.1 evaluates quote freshness across six standardized latency tiers:

| Threshold ($T_{\text{thresh}}$) | Analytical Meaning | Classification Rationale |
|---|---|---|
| **$\le 50\text{ ms}$** | Ultra-Low Latency / Co-located | Professional searcher / private builder interface threshold |
| **$\le 100\text{ ms}$** | Sub-Sequencer High-Frequency | Intra-block priority ordering window |
| **$\le 250\text{ ms}$** | Single L2 Block Window | Standard Base L2 block interval ($\approx 2.0\text{ s}$) sub-slice |
| **$\le 500\text{ ms}$** | Sub-Second Benchmark | Target boundary for Phase 4.14 sub-second research |
| **$\le 1{,}000\text{ ms}$ ($1.0\text{ s}$)** | Bounded Intra-Round Window | Upper bound for within-round contemporaneous sampling |
| **$\le 2{,}000\text{ ms}$ ($2.0\text{ s}$)** | Single-Block Horizon | Maximum age corresponding to a single Base block time |

---

## 2. Empirical Quote Age Distribution

Across all 144 evaluations recorded in `scanner/data/cex_dex_phase414_results.json`, quote age was computed as:
$$\text{QuoteAge}_{\text{ms}} = |T_{\text{CEX, recv}} - T_{\text{DEX, recv}}|$$

### Statistical Summary:
- **Minimum Quote Age**: **519 ms**
- **25th Percentile**: **767 ms**
- **Median Quote Age**: **836 ms**
- **75th Percentile**: **1,024 ms**
- **Mean Quote Age**: **911.4 ms**
- **Maximum Quote Age**: **1,535 ms**

### Threshold Compliance Table:

| Freshness Tier | Evaluation Count ($N$) | Percentage of Sample | Economic Verdict |
|---|---|---|---|
| **$\le 50\text{ ms}$** | **0** | 0.0% | Zero evaluations achieved co-located latency |
| **$\le 100\text{ ms}$** | **0** | 0.0% | Zero evaluations achieved sub-sequencer timing |
| **$\le 250\text{ ms}$** | **0** | 0.0% | Zero evaluations fell within quarter-second window |
| **$\le 500\text{ ms}$** | **0** | 0.0% | **Zero evaluations met the sub-second benchmark** |
| **$\le 1{,}000\text{ ms}$** | **112** | **77.8%** | Contemporaneous intra-round evaluations |
| **$\le 2{,}000\text{ ms}$** | **144** | **100.0%** | All evaluations within single-block horizon |

---

## 3. Disaggregation by Centralized Venue

| Venue | Symbol | Evaluations ($N$) | Min Age (ms) | Median Age (ms) | Mean Age (ms) | Max Age (ms) |
|---|---|---|---|---|---|---|
| **Binance** | `ETHUSDC` | 48 | 767 ms | 836 ms | 862.3 ms | 999 ms |
| **Coinbase** | `ETH-USD` | 48 | 519 ms | 842 ms | 965.3 ms | 1,535 ms |
| **Kraken** | `ETH/USDC` | 48 | 835 ms | 842 ms | 906.7 ms | 1,049 ms |

### Architectural Driver of the ~500–1,500 ms Latency Floor:
1. **Public RPC Network Round-Trip**: Dispatched `eth_call` queries to `https://mainnet.base.org` exhibit a 280–420 ms transport round-trip latency floor.
2. **Sequential Dual Quotes**: Each round required two consecutive queries (WETH $\to$ USDC and USDC $\to$ WETH), compounding to ~600–800 ms of cumulative RPC duration before order-book evaluation began.
3. **Sequential Venue Processing**: Books for Binance, Coinbase, and Kraken were evaluated in sequence, naturally increasing the quote age for later venues.

---

## 4. Economic Distributions: Fresh vs Cached Populations

In strict compliance with Directive 11 & 12, the evaluations are partitioned into discrete populations rather than combined into a single statistic:

### Population A1: Immediate Initial Direct Evaluations ($N = 6$)
The single first evaluation performed immediately following each round's quote pair (1 evaluation per round $\times$ direction):
- **Sample Size**: $N = 6$
- **Gross Spread Distribution (bps)**:
  - Min: -7.3892
  - P25: -7.1022
  - Median: **-5.5382**
  - P75: -3.9742
  - P90: -3.8179
  - Max: **-3.6871**
  - Mean: -5.5382
- **Net Spread Distribution (bps)**: Min: -45.9148, Median: -44.0638, Max: -42.2127, Mean: -44.0638
- **Positive Candidates**: **0**

### Population A2: Contemporaneous Intra-Round ($\le 1{,}000\text{ ms}$, $N = 112$)
- **Sample Size**: $N = 112$ (77.8% of sample)
- **Gross Spread Distribution (bps)**:
  - Min: -9.1676
  - P25: -8.3410
  - Median: **-6.9738**
  - P75: -4.0511
  - P90: -3.6871
  - Max: **-2.7754**
  - Mean: -6.2342
- **Net Spread Distribution (bps)**: Min: -47.6931, Median: -28.7224, Max: -22.8124, Mean: -30.3376
- **Positive Candidates**: **0**

### Population B: Stale / Cached ($> 1{,}000\text{ ms}$, $N = 32$)
- **Sample Size**: $N = 32$ (22.2% of sample)
- **Gross Spread Distribution (bps)**:
  - Min: -11.3336
  - P25: -8.0251
  - Median: **-6.1449**
  - P75: -5.0735
  - Max: **-4.1913**
  - Mean: -6.9537
- **Net Spread Distribution (bps)**: Min: -49.8591, Median: -28.9238, Max: -24.2284, Mean: -31.0571
- **Positive Candidates**: **0**

### Core Conclusion:
Across **all** populations (direct initial, contemporaneous $\le 1.0\text{ s}$, and stale $> 1.0\text{ s}$), **100% of evaluations produced strictly negative gross and net spreads**. Freshness filtering confirms that no hidden arbitrage edge existed in the contemporaneous data.
