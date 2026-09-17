# PHASE 4.13B.1 — Forensic Audit of CEX–DEX Empirical Evidence

> **PHASE ID**: Phase 4.13B.1  
> **SCOPE**: Forensic Audit, Mathematical Recalculation & Semantic Rectification  
> **STATUS**: COMPLETED  
> **AUTHORITY**: Directive 4.13B.1  
> **CAPITAL ALLOCATION**: strictly ₹0.00 / $0.00  
> **EXECUTION STATUS**: LOCKED  

---

## 1. Executive Summary & Objective

The objective of Phase 4.13B.1 is to conduct a forensic audit of the data, mathematical calculations, model assumptions, and semantic interpretations generated during Phase 4.13B ("CEX–DEX Arbitrage Research & Feasibility").

Phase 4.13B evaluated 192 multi-notional scenarios across three centralized exchanges (Binance, Coinbase, Kraken) against on-chain DEX quoter states on Base Uniswap V3. It reported 12 gross-positive price dislocations (+0.025 to +0.35 bps) and 0 net-positive opportunities after accounting for standard baseline fees, gas drag, and risk buffers.

This audit:
1. Recalculates every single reported gross-positive candidate independently.
2. Rectifies overbroad or unproven terminology regarding false positives, price discovery lead/lag, transfer completion, and inventory requirements.
3. Audits parameter provenance and establishes clear boundaries between empirical observation and simulation modeling.
4. Confirms that all medians and distributions are derived directly from raw records without hardcoding.

---

## 2. Independent Recalculation of the 12 Gross-Positive Candidates

All 12 gross-positive candidates reported in Phase 4.13B were extracted from the canonical dataset (`scanner/data/cex_dex_phase413b_results.json`) and independently re-evaluated using exact floating-point mathematics:

$$\text{Gross Spread (CEX}\to\text{DEX)} = \left(\frac{\text{DEX Executable Price} - \text{CEX VWAP Price}}{\text{CEX VWAP Price}}\right) \times 10{,}000\text{ bps}$$

### Table 2.1: Independent Candidate Recalculation Matrix

| Candidate ID | Venue | Symbol | Direction | Notional ($) | CEX VWAP ($) | DEX Quote ($) | Reported Gross (bps) | Recalculated Gross (bps) | Difference (bps) | Validation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cand #1** | Coinbase | ETH-USD | CEX $\to$ DEX | $10 | 2459.9400 | 2460.0263 | +0.350631 | +0.350631 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #2** | Coinbase | ETH-USD | CEX $\to$ DEX | $25 | 2459.9400 | 2460.0263 | +0.350631 | +0.350631 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #3** | Coinbase | ETH-USD | CEX $\to$ DEX | $50 | 2459.9400 | 2460.0263 | +0.350631 | +0.350631 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #4** | Coinbase | ETH-USD | CEX $\to$ DEX | $100 | 2459.9400 | 2460.0263 | +0.350631 | +0.350631 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #5** | Coinbase | ETH-USD | CEX $\to$ DEX | $250 | 2459.9600 | 2460.0263 | +0.269296 | +0.269296 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #6** | Coinbase | ETH-USD | CEX $\to$ DEX | $500 | 2460.0000 | 2460.0263 | +0.106708 | +0.106708 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #7** | Coinbase | ETH-USD | CEX $\to$ DEX | $1000 | 2460.0200 | 2460.0263 | +0.025413 | +0.025413 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #8** | Coinbase | ETH-USD | CEX $\to$ DEX | $10 | 2459.9400 | 2459.9958 | +0.226709 | +0.226709 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #9** | Coinbase | ETH-USD | CEX $\to$ DEX | $25 | 2459.9400 | 2459.9958 | +0.226709 | +0.226709 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #10** | Coinbase | ETH-USD | CEX $\to$ DEX | $50 | 2459.9400 | 2459.9958 | +0.226709 | +0.226709 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #11** | Coinbase | ETH-USD | CEX $\to$ DEX | $100 | 2459.9400 | 2459.9958 | +0.226709 | +0.226709 | 0.0000e+0 | AUTHENTIC_GROSS |
| **Cand #12** | Coinbase | ETH-USD | CEX $\to$ DEX | $250 | 2459.9600 | 2459.9958 | +0.145376 | +0.145376 | 0.0000e+0 | AUTHENTIC_GROSS |

### Audit Finding:
The difference between the originally reported gross spread and the independent recalculation is exactly **0.0000 bps** for all 12 candidates. There are **zero silent calculation discrepancies**.

---

## 3. Rectification of "Zero False Positives"

The Phase 4.13B report noted "0 false positives." While technically accurate within the scope of the 12 candidates that passed the initial filters, stating "the system has zero false positives" is an overbroad generalization.

### Rectified Standard Wording:
> "No false positives were identified among the 12 candidates that passed the implemented validation gates."

The validation suite successfully defended against known historical pitfalls:
- Canonical asset verification confirmed that native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) was matched, preventing bridged token decimals confusion.
- Order-book validation verified ask $> $ bid, preventing crossed-book artifacts.
- Bid/ask orientation was verified: `BUY` consumed asks from lowest price upward, while `SELL` consumed bids from highest price downward.

---

## 4. Verification of Sample Size & Statistical Medians

The empirical campaign in Phase 4.13B was a bounded research run consisting of 10 evaluation rounds over approximately 15.2 seconds, evaluating 192 total permutations.

### Table 4.1: Statistical Metric Verification

| Metric | Phase 4.13B Summary | Independent DB Recalculation | Discrepancy Status |
| :--- | :--- | :--- | :--- |
| **Total Evaluations** | 192 | 192 | Exact Match |
| **Gross Positives** | 12 | 12 | Exact Match |
| **Net Positives** | 0 | 0 | Exact Match |
| **Overall Gross Median** | -7.67 bps | -7.67 bps | Exact Match |
| **Overall Net Median** | -29.66 bps | -29.66 bps | Exact Match |
| **DEX $\to$ CEX Net Median** | -32.18 bps (array median) | -32.18 bps | Verified |
| **CEX $\to$ DEX Net Median** | -22.74 bps (array median) | -22.74 bps | Verified |

*(Note: In the preliminary console output of Phase 4.13B, directional percentiles reflected round-level aggregation rather than pooled array medians. The canonical dataset correctly preserves the pooled array medians of $-32.18\text{ bps}$ and $-22.74\text{ bps}$).*

### Bounded Non-Extrapolation Invariant:
This bounded dataset represents conditions observed during a 15.2-second window. It must **not** be extrapolated to daily trade frequencies, monthly profit estimates, or universal market characteristics.

---

## 5. Provenance Audit of Economic Parameters

Every economic parameter used in the evaluation model has been classified according to its epistemological source:

### Table 5.1: Parameter Provenance Taxonomy

| Parameter | Value | Unit | Provenance Classification | Notes / Justification |
| :--- | :--- | :--- | :--- | :--- |
| **CEX Taker Fee** | 10.0 | bps | `[MODEL ASSUMPTION]` | Standard entry-level retail taker tier on Binance & Coinbase ($< \$10\text{k}$ volume). |
| **DEX Pool Fee** | 5.0 | bps | `[EMBEDDED IN QUOTE]` | Directly captured by Uniswap V3 Quoter contract execution output. Zero double counting. |
| **DEX Gas Units** | 150,000 | units | `[ESTIMATED SIMULATION]` | Standard Uniswap V3 swap gas consumption on Base L2. |
| **Gas Price** | 0.05 | Gwei | `[OBSERVED NETWORK STATE]` | Live Base sequencer gas price observed during campaign. |
| **Risk Buffer** | 10.0 | bps | `[POLICY ASSUMPTION]` | Conservative hurdle for execution drift and slippage. |
| **Inventory Multiplier** | 10.0 | $\times$ | `[MODEL ASSUMPTION]` | Buffer allocation for Model B pre-positioned liquidity. |
| **Base Confirmation** | 12 | blocks | `[MODEL ASSUMPTION]` | Theoretical protocol confirmation assumption (~24s). |
| **End-to-End Transfer** | UNKNOWN | seconds | `[UNOBSERVABLE]` | Exchange deposit crediting and hot wallet delays cannot be observed without live accounts. |

---

## 6. Semantic Rectifications

The following semantic corrections are formally adopted across all project documentation:

1. **Price Discovery & Causality**:
   - *Previous*: "CEX and DEX price discovery operate with slight lead/lag differentials."
   - *Rectified*: "Small cross-venue price differences were observed during the bounded observation window."
   - *Rationale*: Without sub-millisecond atomic clock synchronization between exchange servers and blockchain sequencers, causality and temporal lead/lag cannot be asserted.

2. **Profitability Claims**:
   - *Previous*: "CEX–DEX arbitrage is universally unprofitable."
   - *Rectified*: "All evaluated Phase 4.13B candidates were net-negative under the specified fee, gas, inventory and risk assumptions."
   - *Rationale*: A bounded observation under retail fee tiers does not prove universal impossibility across all volume tiers or market regimes.

3. **DEX–DEX Baseline**:
   - *Previous*: "DEX–DEX arbitrage has zero positive spreads."
   - *Rectified*: "No validated positive opportunity was observed within the previously evaluated SAHIKARA DEX universe and research windows."
   - *Rationale*: Preserves proper empirical boundaries regarding evaluated pool coverage (137 pools, 300 routes).

4. **Persistence vs. Lifetime**:
   - *Previous*: "Sub-second opportunity lifetime."
   - *Rectified*: "Gross price discrepancies were observed across consecutive 1-second sample intervals; exact sub-second dissipation lifetime remains UNKNOWN."
   - *Rationale*: Public REST polling cannot measure sub-second order-book lifecycle dynamics.
