# PHASE 4.11 — FULL ROUTE COVERAGE CAMPAIGN RESULTS
## Exhaustive Empirical Evaluation of 78 Routes Across 8 Trade Sizes

> **STATUS**: COMPLETED / STRICT FORENSIC STANDARD  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (EXECUTION LOCKED)  
> **SAMPLING BIAS**: ZERO (100% ROUTE UNIVERSE EVALUATED)  
> **GATE STATE**: PHASE 5 BLOCKED

---

## 1. Campaign Overview & Execution Parameters

Phase 4.11 executed an exhaustive multi-size empirical campaign across all 78 valid generated routes within the 4-chain monitored universe (Base, Arbitrum One, Optimism, Polygon PoS). 

Unlike Phase 4.10, which evaluated a 16-route representative sample (128 evaluations), Phase 4.11 evaluated **100% of the valid route inventory** across all 8 discrete sizing tiers:

$$\text{Total Matrix} = 78 \text{ routes} \times 8 \text{ trade sizes} = 624 \text{ route-size evaluations}$$

### Execution Parameters:
- **Chains**: Base (8453), Arbitrum One (42161), Optimism (10), Polygon PoS (137)
- **Trade Sizing Tiers**: $\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$
- **Routing Engine**: `GraphRouteGenerator` (Canonical Multigraph Cycle Extraction)
- **Evaluation Engine**: `roundTripEvaluator.ts` (Exact BigInt Token Amounts, Live RPC Quoting)
- **Fee Accounting Standard**: Native protocol quote inclusion (zero double-counting)
- **Safety Gate**: Execution engine strictly **LOCKED**; zero live capital deployed ($₹0.00 / \$0.00$).

---

## 2. Route Inventory & Chain Breakdown

The 78 generated routes represent every valid same-chain cycle that can be constructed from the 43 active verified pools:

| Chain | 2-Hop Cross-DEX Cycles | 3-Hop Triangular Cycles | Total Routes | Active Pools |
| :--- | :---: | :---: | :---: | :---: |
| **Base (8453)** | 34 | 0 | 34 | 17 |
| **Arbitrum One (42161)** | 12 | 2 | 14 | 8 |
| **Optimism (10)** | 4 | 8 | 12 | 8 |
| **Polygon PoS (137)** | 8 | 10 | 18 | 10 |
| **TOTAL** | **58** | **20** | **78** | **43** |

- **Route Coverage**: 78 / 78 (**100.0%**)
- **Exclusions**: 0 valid routes excluded or pruned.

---

## 3. High-Level Campaign Statistics

Across the 624 nominal route-size evaluations:

| Metric | Observed Count | Percentage |
| :--- | :---: | :---: |
| **Total Route-Size Attempts** | **624** | 100.0% |
| **Successful Executable Evaluations** | **592** | **94.87%** |
| **Failed Evaluations** | **32** | **5.13%** |
| **Gross-Positive Observations ($\text{grossSpreadBps} > 0$)** | **0** | **0.00%** |
| **Net-Positive Observations ($\text{netExpectedProfitUsd} > 0$)** | **0** | **0.00%** |
| **Revalidated Candidates** | **0** | **0.00%** |
| **False Positives** | **0** | **0.00%** |
| **Opportunity Persistence** | **UNKNOWN** | (Zero candidates to track) |

---

## 4. Failure Taxonomy & Attribution

Across all 8 trade sizes, exactly 4 specific routes consistently produced structured failures ($4 \times 8 = 32$ total failures):

| Failure Category | Failure Count | Root Cause Analysis |
| :--- | :---: | :--- |
| `QUOTE_FAILURE` / `CONTRACT_REVERT` | 32 | Reverts from on-chain QuoterV2 or pair contracts on specific low-liquidity pairs where tick spacing or reserve ratios revert for directional swaps. |
| `RPC_ERROR` | 0 | Zero unhandled network timeouts or connection drops. |
| `DECIMAL_ERROR` | 0 | Zero decimal mismatch or unhandled scaling defects. |
| `UNSUPPORTED_POOL_TYPE` | 0 | Zero unsupported pool types routed. |

**Crucial Epistemic Finding**: In strict compliance with SAHIKARA rules, these 32 failures were recorded as structured errors and **never** coerced to $0\text{ bps}$ or $-10,000\text{ bps}$ in the economic spread distributions.

---

## 5. Economic Spread Distributions by Trade Size

Statistical distributions for gross spread (in basis points) across the 592 successful evaluations:

| Trade Size | Successful Evals | Median Gross Spread | Mean Gross Spread | p25 (bps) | p75 (bps) | Min (bps) | Max (bps) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **$1** | 74 | -38.48 bps | -41.44 bps | -58.82 bps | -20.00 bps | -193.48 bps | -0.67 bps |
| **$5** | 74 | -41.70 bps | -44.57 bps | -60.79 bps | -20.58 bps | -193.70 bps | -4.97 bps |
| **$10** | 74 | -48.24 bps | -47.26 bps | -61.41 bps | -21.20 bps | -193.99 bps | -4.97 bps |
| **$25** | 74 | -51.38 bps | -56.08 bps | -69.34 bps | -22.67 bps | -206.29 bps | -4.97 bps |
| **$50** | 74 | -53.39 bps | -70.31 bps | -72.57 bps | -26.04 bps | -298.63 bps | -4.98 bps |
| **$100** | 74 | -56.44 bps | -98.28 bps | -88.16 bps | -30.88 bps | -474.79 bps | -5.00 bps |
| **$250** | 74 | -71.14 bps | -178.02 bps | -123.50 bps | -47.13 bps | -960.62 bps | -5.03 bps |
| **$500** | 74 | -94.62 bps | -300.16 bps | -233.59 bps | -55.17 bps | -1701.72 bps | -5.08 bps |

### Analysis of Multi-Size Curve:
1. **Monotonic Price Impact Drag**: As trade size increases from $\$1$ to $\$500$, median gross spread degrades monotonically from $-38.48\text{ bps}$ to $-94.62\text{ bps}$, and mean spread degrades from $-41.44\text{ bps}$ to $-300.16\text{ bps}$.
2. **Fee Floor Dominance**: The upper bound of the distribution ($\text{Max}$) remains negative across all sizes ($-0.67\text{ bps}$ at $\$1$, degrading to $-5.08\text{ bps}$ at $\$500$). This proves that even in the closest cross-DEX price alignments, AMM swap fees ($5–30\text{ bps}$ per leg) create an impenetrable economic barrier.
3. **Absence of Gross Inversion**: Not a single route exhibited gross price inversion ($\text{grossSpreadBps} > 0$).

---

## 6. Economic Spread Distributions by Chain

| Chain | Successful Evals | Median Gross Spread | Mean Gross Spread | p25 (bps) | p75 (bps) | Max Gross Spread |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Base** | 240 | -43.93 bps | -65.12 bps | -66.74 bps | -21.47 bps | -0.67 bps |
| **Arbitrum One** | 112 | -56.44 bps | -54.40 bps | -68.58 bps | -21.72 bps | -9.77 bps |
| **Optimism** | 96 | -68.17 bps | -203.47 bps | -154.15 bps | -36.52 bps | -12.31 bps |
| **Polygon PoS** | 144 | -58.54 bps | -143.56 bps | -96.64 bps | -33.89 bps | -5.97 bps |

- **Base** exhibited the tightest spreads (median $-43.93\text{ bps}$, max $-0.67\text{ bps}$), driven by the ultra-low 5 bps fee tiers on Aerodrome volatile pairs and 1 bps on Aerodrome stable pools.
- **Arbitrum, Optimism, and Polygon** exhibited wider negative spreads due to prevailing 30 bps fee tiers on Camelot, Velodrome, QuickSwap, and SushiSwap V2 pairs.

---

## 7. Economic Spread Distributions by Route Topology

| Route Topology | Successful Evals | Median Gross Spread | Mean Gross Spread | Max Gross Spread |
| :--- | :---: | :---: | :---: | :---: |
| **2-Hop Cross-DEX Cycles** | 432 | -50.55 bps | -72.18 bps | -0.67 bps |
| **3-Hop Triangular Cycles** | 160 | -65.35 bps | -192.16 bps | -9.77 bps |

- 3-hop triangular cycles suffer **nearly double to triple the negative spread** of 2-hop cycles (mean $-192.16\text{ bps}$ vs $-72.18\text{ bps}$). Each additional hop introduces an extra $5–30\text{ bps}$ protocol swap fee plus incremental price impact, heavily compounding the negative return.

---

## 8. Final Empirical Conclusion

The full-matrix evaluation of all 78 valid generated routes across 8 trade sizes conclusively establishes:
1. **Zero Positive Gross Opportunities**: Across 592 successful live on-chain round-trip quotes, exactly 0 produced a positive gross return.
2. **Zero Positive Net Opportunities**: After deducting modeled L1/L2 gas costs, price impact, and policy buffers, 100% of evaluations resulted in net losses.
3. **Sampling Bias Eliminated**: The hypothesis that Phase 4.10's negative findings were an artifact of sampling only 16 routes is **REFUTED**. Full route coverage yields identical market physics.
4. **Phase 5 Remains Blocked**: In accordance with the Project Operating Model and Risk Policy, Phase 5 (live execution) remains strictly **BLOCKED**.
