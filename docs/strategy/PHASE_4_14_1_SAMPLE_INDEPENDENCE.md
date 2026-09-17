# PHASE 4.14.1 — Sample Independence & Effective Sample Size Forensics

> **PHASE STATUS**: FORENSIC RESEARCH PATCH  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION STATE**: STRICTLY LOCKED (PHASE 5 BLOCKED)

---

## 1. Nominal vs Effective Sample Size

In scientific reporting, a critical statistical failure mode is presenting repeated observations of the same underlying market state as independent samples.

Phase 4.14 reported:
- **Nominal Evaluations**: **144**
- **LOW Volatility Evaluations**: **96**
- **ELEVATED Volatility Evaluations**: **48**

This document provides a forensic audit of the **effective independent sample size** ($N_{\text{eff}}$).

---

## 2. Decomposition of the Evaluation Matrix

Each of the 144 evaluations in Phase 4.14 is a permutation of four dimensions:
$$\text{Evaluations} = N_{\text{rounds}} \times N_{\text{venues}} \times N_{\text{directions}} \times N_{\text{sizes}}$$
$$144 = 3 \times 3 \times 2 \times 8$$

| Dimension | Count | Nature of Variation | Statistical Independence |
|---|---|---|---|
| **Sampling Rounds ($N_{\text{rounds}}$)** | **3** | Temporal interval (~2 seconds apart) | **INDEPENDENT** (distinct block & order-book arrival) |
| **CEX Venues ($N_{\text{venues}}$)** | **3** | Binance, Coinbase, Kraken | Correlated (cross-exchange arbitrage couples CLOBs) |
| **Trade Directions ($N_{\text{directions}}$)** | **2** | `DEX_TO_CEX`, `CEX_TO_DEX` | Inverse facets of the same price pair |
| **Notional Sizes ($N_{\text{sizes}}$)** | **8** | \$10 to \$5,000 | Co-dependent traversal of the same order book |

### Critical Finding:
Within a single round $r$:
- The DEX price was identical for all 48 evaluations.
- The CEX order books were sampled at the same snapshot moment.
- Evaluating 8 different trade sizes on the same order book does **not** create 8 independent market observations; it tests depth slippage on a single order-book state.
- Therefore, the **effective independent market sample size is $N_{\text{eff}} = 3$ rounds**, spanning 3 consecutive Base L2 blocks.

---

## 3. Disaggregation of Volatility Regime Claims

The Phase 4.14 report stated:
- `LOW`: $N = 96$
- `ELEVATED`: $N = 48$

### The Forensic Reality:
- **`LOW` Regime**: Comprises Round 1 and Round 3.
  - $N_{\text{nominal}} = 48 + 48 = 96$ evaluations.
  - **$N_{\text{independent}} = 2$ market states**.
- **`ELEVATED` Regime**: Comprises Round 2.
  - $N_{\text{nominal}} = 48$ evaluations.
  - **$N_{\text{independent}} = 1$ market state**.
- **`NORMAL` & `HIGH` Regimes**:
  - $N_{\text{nominal}} = 0$, $N_{\text{independent}} = 0$.

### Epistemic Correction:
It is mathematically invalid to conclude that "volatility has been comprehensively tested across 144 independent observations." 
The corrected statement is:
> *"Across 3 independent market state rounds (2 in LOW regime, 1 in ELEVATED regime), no gross-positive cross-venue candidate was observed."*

---

## 4. Comparison with Phase 4.13B

| Parameter | Phase 4.13B (REST) | Phase 4.14 (WebSocket) | Phase 4.14.1 Forensic Classification |
|---|---|---|---|
| **Total Evaluations** | 192 | 144 | Bounded evaluations |
| **Independent Sampling Rounds** | 4 | 3 | Equivalent small-sample bounds |
| **Independent DEX Quotes** | 9 | 6 (3 buy, 3 sell) | Bounded on-chain sample |
| **Max Gross Spread** | +0.3506 bps | -2.7754 bps | Strictly negative in Phase 4.14 |
| **Authentic Net Positives** | 0 | 0 | 0 across both phases |

**Conclusion**: Neither phase represents a continuous multi-day campaign. Both represent controlled, bounded forensic snapshots demonstrating tight cross-venue coupling on ETH/USDC.
