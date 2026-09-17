# PHASE 4.13B — Empirical Observation Campaign Results

> **DATA PROVENANCE**: All statistics derived directly from `scanner/data/cex_dex_phase413b_results.json` gathered during live execution on 2026-09-17.

---

## 1. Campaign Telemetry & Volume

| Metric | Measured Value | Provenance |
| :--- | :--- | :--- |
| **CEX Messages Received** | 15 | `[OBSERVED_NETWORK_TELEMETRY]` |
| **CEX Order Book Snapshots** | 12 | `[OBSERVED_NETWORK_TELEMETRY]` |
| **DEX Quotes Executed** | 9 | `[OBSERVED_RPC_TELEMETRY]` |
| **Cross-Venue Evaluations** | 192 | `[DETERMINISTIC_MATRIX_EVALUATION]` |
| **Raw Gross Positives** | 12 | `[OBSERVED_DATA]` |
| **Authentic Gross Positives** | 12 | `[FORENSICALLY_VALIDATED]` |
| **Raw Net Positives** | 0 | `[OBSERVED_DATA]` |
| **Authentic Net Positives** | 0 | `[OBSERVED_DATA]` |
| **Revalidated Net Positives** | 0 | `[OBSERVED_DATA]` |

---

## 2. Statistical Distributions

### Gross Spread Distribution (Basis Points)
- **Min**: $-11.93\text{ bps}$
- **P25**: $-10.55\text{ bps}$
- **Median**: $-7.67\text{ bps}$
- **P75**: $-0.99\text{ bps}$
- **P95**: $+0.11\text{ bps}$
- **P99**: $+0.35\text{ bps}$
- **Max**: $+0.35\text{ bps}$
- **Mean**: $-5.68\text{ bps}$

### Net Spread Distribution (Basis Points)
- **Min**: $-50.38\text{ bps}$
- **P25**: $-32.98\text{ bps}$
- **Median**: $-29.66\text{ bps}$
- **P75**: $-22.74\text{ bps}$
- **P95**: $-20.39\text{ bps}$
- **P99**: $-20.06\text{ bps}$
- **Max**: $-20.06\text{ bps}$
- **Mean**: $-29.76\text{ bps}$

---

## 3. Directional Asymmetry Analysis

| Direction | Sample Size ($N$) | Gross Median | Net Median | Max Gross | Max Net |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEX → CEX** (Buy DEX, Sell CEX) | 96 | $-10.55\text{ bps}$ | $-32.18\text{ bps}$ | $-7.67\text{ bps}$ | $-27.86\text{ bps}$ |
| **CEX → DEX** (Buy CEX, Sell DEX) | 96 | $-0.99\text{ bps}$ | $-22.74\text{ bps}$ | $+0.35\text{ bps}$ | $-20.06\text{ bps}$ |

**Observation**: The `CEX -> DEX` direction consistently exhibited tighter spreads than `DEX -> CEX` (gross median of $-0.99\text{ bps}$ vs $-10.55\text{ bps}$), reflecting deeper CEX liquidity and tighter bid/ask pricing on centralized venues compared to on-chain pool swap curves.
