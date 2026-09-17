# PHASE 4.14 — Empirical Research Results & Distribution Tables

> **PHASE STATUS**: RESEARCH-ONLY  
> **CAPITAL**: ₹0.00 | **EXECUTION**: LOCKED | **AUTHENTICATION**: NONE

---

## 1. Executive Research Summary

Phase 4.14 conducted high-resolution CEX–DEX microstructure research connecting live public WebSocket streams from Binance, Coinbase, and Kraken with live on-chain quotes from Uniswap V3 on Base.

### High-Level Empirical Metrics:
- **WebSocket Messages Received**: 1,688 (Binance: 118, Coinbase: 234, Kraken: 1,336)
- **Order-Book Updates Processed**: 1,474 (Binance: 118, Coinbase: 34, Kraken: 1,322)
- **Sequence Gaps / Resync Events**: 0
- **DEX Quotes Executed**: 7 (Uniswap V3 Base WETH/USDC 0.05%)
- **Cross-Venue Evaluations**: 144
- **Historical Baseline Max Gross Spread (Phase 4.13B)**: **+0.3506 bps**
- **Phase 4.14 Max Gross Spread**: **-2.7754 bps**
- **Raw Gross Positives**: 0
- **Authentic Gross Positives**: 0
- **Authentic Net Positives**: 0

---

## 2. Statistical Distributions

### 2.1 Gross Spread Distribution (bps)
The gross price difference between executable CEX VWAP and executable DEX on-chain swap before friction:

| Statistic | Observed Value (bps) | Description |
|---|---|---|
| **Minimum** | -11.3336 bps | Widest observed cross-venue dislocation against execution |
| **25th Percentile (P25)** | -8.3410 bps | Lower quartile |
| **Median (P50)** | -6.9223 bps | Central tendency across all evaluations |
| **75th Percentile (P75)** | -4.1913 bps | Upper quartile |
| **90th Percentile (P90)** | -3.6871 bps | Top decile |
| **95th Percentile (P95)** | -3.6871 bps | Near-tail distribution |
| **99th Percentile (P99)** | -2.7754 bps | Extreme tail distribution |
| **Maximum** | **-2.7754 bps** | Tightest observed spread (strictly negative) |
| **Mean** | -6.3941 bps | Sample arithmetic mean |

### 2.2 Net Spread Distribution (bps)
The net economic return after deducting CEX fees (10 bps), DEX pool fee (5 bps), gas friction ($0.0185 / swap), and risk buffer (10 bps):

| Statistic | Observed Value (bps) | Description |
|---|---|---|
| **Minimum** | -49.8591 bps | Heaviest friction (low notional with gas drag) |
| **25th Percentile (P25)** | -32.0746 bps | Lower quartile |
| **Median (P50)** | -28.7749 bps | Central net result |
| **75th Percentile (P75)** | -26.1086 bps | Upper quartile |
| **90th Percentile (P90)** | -24.4216 bps | Top decile |
| **95th Percentile (P95)** | -24.0881 bps | Near-tail distribution |
| **99th Percentile (P99)** | -23.1459 bps | Extreme tail distribution |
| **Maximum** | **-22.8124 bps** | Best-case net result (strictly negative) |
| **Mean** | -30.4975 bps | Sample arithmetic mean |

---

## 3. Microstructure Metrics Distributions

| Metric | Min | P25 | Median | P75 | P90 | P95 | P99 | Max | Mean |
|---|---|---|---|---|---|---|---|---|---|
| **CEX Bid-Ask Spread (bps)** | 0.0405 | 0.0405 | 1.2544 | 1.9013 | 4.4929 | 4.4929 | 4.4929 | 6.6761 | 1.7535 |
| **CEX Depth Imbalance** | -0.3939 | -0.1564 | -0.0001 | 0.0000 | 0.1603 | 0.1603 | 0.1603 | 0.9774 | +0.0176 |

---

## 4. Breakdown by Trading Direction

Evaluations were symmetrically distributed between the two execution directions:

| Direction | Evaluations ($N$) | Mean Gross Spread (bps) | Max Gross Spread (bps) | Mean Net Spread (bps) | Max Net Spread (bps) |
|---|---|---|---|---|---|
| **`DEX_TO_CEX`** (Buy DEX, Sell CEX) | 72 | -6.84 bps | -3.12 bps | -30.94 bps | -23.15 bps |
| **`CEX_TO_DEX`** (Buy CEX, Sell DEX) | 72 | -5.95 bps | -2.78 bps | -30.05 bps | -22.81 bps |

---

## 5. Breakdown by Centralized Venue

| Venue | Subscribed Pair | Evaluations ($N$) | Mean Gross Spread (bps) | Max Gross Spread (bps) | Mean Net Spread (bps) |
|---|---|---|---|---|---|
| **Binance** | `ETHUSDC` | 48 | -6.42 bps | -2.81 bps | -30.52 bps |
| **Coinbase** | `ETH-USD` | 48 | -6.38 bps | -2.78 bps | -30.48 bps |
| **Kraken** | `ETH/USDC` | 48 | -6.39 bps | -2.79 bps | -30.49 bps |

---

## 6. Threshold Tracking

Across all standard tracked hurdle thresholds:

| Hurdle Threshold | Observed Count | Percentage |
|---|---|---|
| $\ge 0.0\text{ bps}$ | 0 | 0.00% |
| $\ge 0.5\text{ bps}$ | 0 | 0.00% |
| $\ge 1.0\text{ bps}$ | 0 | 0.00% |
| $\ge 2.0\text{ bps}$ | 0 | 0.00% |
| $\ge 5.0\text{ bps}$ | 0 | 0.00% |
| $\ge 10.0\text{ bps}$ | 0 | 0.00% |
| $\ge 25.0\text{ bps}$ | 0 | 0.00% |
| $\ge 50.0\text{ bps}$ | 0 | 0.00% |
| $\ge 100.0\text{ bps}$ | 0 | 0.00% |

---

## 7. Comparative Assessment with Phase 4.13B Baseline

| Parameter | Phase 4.13B (REST Polling) | Phase 4.14 (WebSocket Streaming) | Microstructure Impact |
|---|---|---|---|
| **Sampling Mechanism** | Periodic REST snapshots | Continuous WebSocket streams (100ms & tick-level) | Sub-second order-book continuity |
| **Total Evaluations** | 192 | 144 | Bounded multi-round campaign |
| **Max Gross Spread** | **+0.3506 bps** | **-2.7754 bps** | No expansion observed |
| **Median Gross Spread** | -5.58 bps | -6.92 bps | Consistent tight equilibrium |
| **Max Net Spread** | -25.75 bps | -22.81 bps | Consistently negative across both phases |
| **Authentic Net Positives** | 0 | 0 | 0 in both phases |

**Core Finding**: High-resolution continuous WebSocket feeds did not uncover hidden, large gross price dislocations. The markets remained tightly integrated with the maximum gross spread remaining strictly negative ($-2.7754\text{ bps}$), below the Phase 4.13B historical maximum of $+0.3506\text{ bps}$.
