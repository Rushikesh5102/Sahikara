# PHASE 4.13B.1 — Fee-Tier, Gas & Risk Sensitivity Analysis

> **PHASE ID**: Phase 4.13B.1  
> **SCOPE**: Empirical Sensitivity Modeling on Observed Discrepancy Candidates  
> **STATUS**: COMPLETED  
> **AUTHORITY**: Directive 4.13B.1  
> **CAPITAL ALLOCATION**: strictly ₹0.00 / $0.00  
> **EXECUTION STATUS**: LOCKED  

---

## 1. Objective & Methodology

In Phase 4.13B, all 12 observed gross-positive price dislocations produced strictly negative net returns under baseline parameters (10 bps CEX taker fee, Base L2 gas drag, and 10 bps risk buffer).

The objective of this sensitivity analysis is to determine mathematically:
1. At what fee level the observed gross dislocations would cross the zero-net threshold.
2. How the risk buffer and on-chain gas costs impact net realization.
3. Whether hypothetical profitability under discounted tiers constitutes evidence of real-world executability.

> [!IMPORTANT]
> **Strict Semantic Boundary**:
> Any candidate that yields a mathematically positive return under modified simulation parameters is classified strictly as **`HYPOTHETICAL_NET_POSITIVE`**. Under no circumstances is it classified as an `AUTHENTIC_NET_POSITIVE` or an executable opportunity.

---

## 2. Baseline Candidate Characteristics

The 12 candidates evaluated were observed during Phase 4.13B on Coinbase (`ETH-USD`) versus Base Uniswap V3 (`WETH/USDC`, fee tier 500 bps).
- **Direction**: CEX $\to$ DEX (Buy on Coinbase at VWAP ask; Sell on DEX at executable bid quote)
- **Gross Spreads**: Ranged from $+0.0254\text{ bps}$ to $+0.3506\text{ bps}$ (mean $+0.2223\text{ bps}$)
- **Notional Sizes**: $10, $25, $50, $100, $250, $500, $1,000

---

## 3. CEX Taker Fee Sensitivity Matrix

Holding the risk buffer constant at 10 bps and using baseline Base L2 gas:

### Table 3.1: Net Spread Across CEX Taker Fee Tiers

| CEX Fee Tier (bps) | Description / Target Tier | Hypothetical Net Positives / 12 | Mean Net Spread (bps) | Net Spread Range (bps) |
| :--- | :--- | :--- | :--- | :--- |
| **10.0 bps** | Standard Retail Baseline (< $10k vol) | **0 / 12 (0%)** | -25.16 bps | [-38.22, -20.16] bps |
| **5.0 bps** | Mid-tier Active Trader ($50k–$100k vol) | **0 / 12 (0%)** | -20.16 bps | [-33.22, -15.16] bps |
| **2.0 bps** | VIP / Institutional Tier ($1M+ vol) | **0 / 12 (0%)** | -17.16 bps | [-30.22, -12.16] bps |
| **1.0 bps** | High-Frequency Market Maker Taker Tier | **0 / 12 (0%)** | -16.16 bps | [-29.22, -11.16] bps |
| **0.5 bps** | Ultra-VIP Prime Brokerage | **0 / 12 (0%)** | -15.66 bps | [-28.72, -10.66] bps |
| **0.0 bps** | Theoretical Zero-Fee Limit | **0 / 12 (0%)** | -15.16 bps | [-28.22, -10.16] bps |

### Mathematical Deduction:
Because the maximum observed gross spread is only $+0.3506\text{ bps}$, reducing the CEX fee to zero while maintaining a 10 bps risk buffer and gas costs still leaves **100% of candidates net negative** (maximum net spread is $-10.16\text{ bps}$).

---

## 4. Risk Buffer Sensitivity Matrix

Holding the CEX fee constant at the baseline 10 bps and using baseline Base L2 gas:

### Table 4.1: Net Spread Across Risk Buffer Assumptions

| Risk Buffer (bps) | Policy Description | Hypothetical Net Positives / 12 | Mean Net Spread (bps) | Net Spread Range (bps) |
| :--- | :--- | :--- | :--- | :--- |
| **20.0 bps** | Highly Conservative / High Volatility | **0 / 12 (0%)** | -35.16 bps | [-48.22, -30.16] bps |
| **10.0 bps** | Standard SAHIKARA Baseline Policy | **0 / 12 (0%)** | -25.16 bps | [-38.22, -20.16] bps |
| **5.0 bps** | Moderate Risk Policy | **0 / 12 (0%)** | -20.16 bps | [-33.22, -15.16] bps |
| **2.0 bps** | Minimal Execution Drift Allowance | **0 / 12 (0%)** | -17.16 bps | [-30.22, -12.16] bps |
| **0.0 bps** | Theoretical Zero-Buffer Limit | **0 / 12 (0%)** | -15.16 bps | [-28.22, -10.16] bps |

---

## 5. Gas Cost Sensitivity Matrix

On Layer 2 networks like Base, gas cost consists of execution gas plus L1 rollup data availability fees. For a standard Uniswap V3 swap (150,000 gas units @ 0.05 Gwei), gas costs $\approx \$0.0185$.
- On a $10 notional trade, gas is $18.45\text{ bps}$.
- On a $1,000 notional trade, gas is $0.18\text{ bps}$.

### Table 5.1: Gas Cost Scaling Sensitivity (Baseline Fee = 10 bps, Risk Buffer = 10 bps)

| Gas Scale | Effective Gas Cost ($) | Hypothetical Net Positives / 12 | Mean Net Spread (bps) |
| :--- | :--- | :--- | :--- |
| **5.0$\times$** | ~$0.092 (High Congestion) | **0 / 12 (0%)** | -46.75 bps |
| **2.0$\times$** | ~$0.037 (Moderate Congestion) | **0 / 12 (0%)** | -30.56 bps |
| **1.0$\times$** | ~$0.0185 (Baseline Observed) | **0 / 12 (0%)** | -25.16 bps |
| **0.5$\times$** | ~$0.009 (Subsidized L2 Gas) | **0 / 12 (0%)** | -22.46 bps |
| **0.1$\times$** | ~$0.0018 (Ultra-Low L2 Gas) | **0 / 12 (0%)** | -20.30 bps |

---

## 6. Multi-Variable Threshold Frontier

To identify the exact parameter frontier where any observed candidate could theoretically cross zero, a multi-variable grid evaluation was conducted:

### Table 6.1: Multi-Variable Grid Evaluation on 12 Candidates

| CEX Fee (bps) | Risk Buffer (bps) | Gas Scale | Hypothetical Net Positives / 12 | Max Net Spread (bps) | Status Classification |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **1.0** | 2.0 | 1.0$\times$ | 0 / 12 | -3.1591 bps | NET_NEGATIVE |
| **1.0** | 0.0 | 1.0$\times$ | 0 / 12 | -1.1591 bps | NET_NEGATIVE |
| **1.0** | 0.0 | 0.0$\times$ | 0 / 12 | -0.6494 bps | NET_NEGATIVE |
| **0.5** | 0.0 | 1.0$\times$ | 0 / 12 | -0.6591 bps | NET_NEGATIVE |
| **0.5** | 0.0 | 0.0$\times$ | 0 / 12 | -0.1494 bps | NET_NEGATIVE |
| **0.0** | 2.0 | 0.0$\times$ | 0 / 12 | -1.6494 bps | NET_NEGATIVE |
| **0.0** | 0.0 | 1.0$\times$ | 0 / 12 | -0.1591 bps | NET_NEGATIVE |
| **0.0** | 0.0 | 0.1$\times$ | **6 / 12** | **+0.1955 bps** | `HYPOTHETICAL_NET_POSITIVE` |
| **0.0** | 0.0 | 0.0$\times$ | **12 / 12** | **+0.3506 bps** | `HYPOTHETICAL_NET_POSITIVE` |

### Key Discovery:
The gross price dislocations observed (+0.025 to +0.35 bps) are so narrow that:
1. **Zero candidates survive even a 0.5 bps CEX fee** (even assuming zero risk buffer and zero gas).
2. **Zero candidates survive baseline L2 gas alone** at 0 bps fee and 0 bps risk buffer (max net is $-0.1591\text{ bps}$).
3. Only when CEX fees are strictly zero, risk buffer is strictly zero, and gas costs are suppressed by $90\%$ do 6 out of 12 candidates produce positive numbers.

---

## 7. Sensitivity vs. Executability: Critical Distinction

The emergence of hypothetical positives under extreme parameters (0 fee, 0 risk, 0 gas) **does NOT prove that CEX–DEX arbitrage is executable or viable**.

1. **Volume Barrier**: Achieving 0 to 1 bps taker fees on major centralized exchanges requires tens to hundreds of millions in 30-day trading volume. SAHIKARA operates with ₹0 capital.
2. **Physics of Blockchain Gas**: On-chain swaps cannot execute with zero gas on Base, Arbitrum, or Polygon. Gas is an unavoidable protocol cost.
3. **Execution Drift**: Operating with a zero risk buffer is fatal in cross-venue execution. Because CEX and DEX legs are non-atomic, price movements during the order flight time will cause adverse fills that easily exceed 0.35 bps.
4. **Order Book Depletion**: At higher notionals ($5,000), order book depth consumption immediately erases the top-of-book gross spread.
