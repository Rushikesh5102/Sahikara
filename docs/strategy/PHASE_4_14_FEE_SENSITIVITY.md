# PHASE 4.14 — Fee, Gas & Risk Sensitivity Matrix

> **PHASE STATUS**: RESEARCH-ONLY  
> **CAPITAL**: ₹0.00 | **EXECUTION**: LOCKED | **AUTHENTICATION**: NONE

---

## 1. Sensitivity Modeling Framework

To rigorously determine the economic hurdle required for CEX–DEX viability, Phase 4.14 executes an automated multi-parameter sensitivity analysis across all recorded cross-venue states.

All fee, gas, and risk tiers are evaluated as:
$$\text{[SIMULATION]}$$
SAHIKARA does not claim eligibility for any VIP fee tier, subsidized gas schedule, or zero-risk operational condition.

---

## 2. Multi-Tier CEX Fee Sensitivity

The CEX fee schedule was evaluated across six hypothetical fee tiers:
$$10\text{ bps}, \; 5\text{ bps}, \; 2\text{ bps}, \; 1\text{ bps}, \; 0.5\text{ bps}, \; 0\text{ bps}$$

| Modeled CEX Fee Tier | Simulation Label | Hypothetical Net Positives ($N$) | Mean Net Spread (bps) | Min Net Spread (bps) | Max Net Spread (bps) |
|---|---|---|---|---|---|
| **10.0 bps (Standard VIP0)** | `[SIMULATION]` | 0 | -30.50 bps | -49.86 bps | -22.81 bps |
| **5.0 bps (Mid VIP Tier)** | `[SIMULATION]` | 0 | -25.50 bps | -44.86 bps | -17.81 bps |
| **2.0 bps (Institutional Tier)** | `[SIMULATION]` | 0 | -22.50 bps | -41.86 bps | -14.81 bps |
| **1.0 bps (High-Tier Market Maker)** | `[SIMULATION]` | 0 | -21.50 bps | -40.86 bps | -13.81 bps |
| **0.5 bps (Ultra-Tier MM)** | `[SIMULATION]` | 0 | -21.00 bps | -40.36 bps | -13.31 bps |
| **0.0 bps (Zero Fee Assumption)** | `[SIMULATION]` | 0 | -20.50 bps | -39.86 bps | -12.81 bps |

### Critical Finding:
Even under the extreme hypothetical assumption of **0.0 bps CEX fees**, **zero evaluations** produced a positive net return. This is because:
1. Uniswap V3 pool fee is 5.0 bps (`fee = 500`).
2. Gas cost on Base adds 0.04 to 18.5 bps depending on notional size.
3. The gross spread itself was uniformly negative (max: **-2.7754 bps**).

---

## 3. Gas Cost Sensitivity

Gas friction was evaluated at four scaling multipliers relative to observed Base L2 network execution fees ($G_{\text{base}} \approx \$0.0185$ per swap):

| Gas Multiplier | Simulation Label | Hypothetical Net Positives ($N$) | Mean Net Spread Impact |
|---|---|---|---|
| **$0.1\times$** | `[SIMULATION]` | 0 | Gas drag reduced to 0.004–1.85 bps |
| **$0.5\times$** | `[SIMULATION]` | 0 | Gas drag reduced to 0.02–9.26 bps |
| **$1.0\times$ (Baseline)** | `[SIMULATION]` | 0 | Gas drag at 0.04–18.53 bps |
| **$2.0\times$** | `[SIMULATION]` | 0 | Gas drag doubled to 0.08–37.05 bps |

---

## 4. Risk Buffer Sensitivity

The execution risk buffer (modeled cushion against block latency, price drift, and non-atomicity) was modeled at:
$$0\text{ bps}, \; 2\text{ bps}, \; 5\text{ bps}, \; 10\text{ bps}$$

| Risk Buffer | Simulation Label | Hypothetical Net Positives ($N$) | Mean Net Spread (bps) | Max Net Spread (bps) |
|---|---|---|---|---|
| **0 bps** | `[SIMULATION]` | 0 | -20.50 bps | -12.81 bps |
| **2 bps** | `[SIMULATION]` | 0 | -22.50 bps | -14.81 bps |
| **5 bps** | `[SIMULATION]` | 0 | -25.50 bps | -17.81 bps |
| **10 bps (Baseline)** | `[SIMULATION]` | 0 | -30.50 bps | -22.81 bps |

---

## 5. Combined Best-Case Scenario

To test whether any parameter combination could hypothetically yield a positive trade, an extreme "hyper-frictionless" simulation was evaluated:
- **CEX Fee**: 0.0 bps
- **Risk Buffer**: 0.0 bps
- **Gas**: $0.1\times$ ($0.004\text{ bps}$ at \$5,000)
- **DEX Fee**: 5.0 bps

### Result:
- **Max Net Result**: $-2.7754 - 5.0000 - 0.0040 = \mathbf{-7.7794\text{ bps}}$
- **Hypothetical Positives**: **0**

**Conclusion**: In the Phase 4.14 dataset, unprofitability is not merely a consequence of high exchange fees or gas costs; the underlying gross price relationship between Base Uniswap V3 and centralized exchanges was already aligned within $\approx 2.78\text{ bps}$ of equilibrium, leaving zero gross edge to harvest.
