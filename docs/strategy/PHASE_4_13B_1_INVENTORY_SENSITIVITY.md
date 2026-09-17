# PHASE 4.13B.1 — Inventory Model & Capital Allocation Sensitivity

> **PHASE ID**: Phase 4.13B.1  
> **SCOPE**: Capital Allocation, Buffer Multipliers & Operational Constraints  
> **STATUS**: COMPLETED  
> **AUTHORITY**: Directive 4.13B.1  
> **CAPITAL ALLOCATION**: strictly ₹0.00 / $0.00  
> **EXECUTION STATUS**: LOCKED  

---

## 1. Audit of the "10× Inventory Requirement" Claim

In the Phase 4.13B report, Model B was described as requiring "10× committed capital."

### Audit Finding on Derivation:
In `scanner/src/crossvenue/InventoryModel.ts`, the total capital allocation for Model B was computed as:

$$\text{CEX Cash} = S \times 2.5, \quad \text{CEX Crypto} = S \times 2.5, \quad \text{DEX Cash} = S \times 2.5, \quad \text{DEX Crypto} = S \times 2.5$$

$$\text{Total Capital Allocated} = 4 \times (2.5 \times S) = 10 \times S$$

where $S$ is the trade size.

### Provenance Classification:
The 10× multiplier is **strictly a `[MODEL ASSUMPTION]` / `[SIMULATION CONFIGURATION]`**, selected by engineering heuristic to allow 2 to 3 consecutive executions in the same direction without triggering immediate rebalancing. 

It is **NOT** an empirical fact, blockchain consensus rule, or exchange constraint.

---

## 2. Separation of Capital Dimensions

To prevent semantic conflation, three distinct dimensions of inventory management are established:

1. **`CAPITAL_REQUIRED` (Nominal Committed Capital)**:
   The total dollar value of cash and crypto assets held across both venues to enable execution.
2. **`CAPITAL_UTILIZATION` (Utilization Ratio)**:
   The proportion of committed capital deployed in a single arbitrage trade:
   $$\text{Capital Utilization} = \frac{\text{Trade Notional Size } (S)}{\text{Total Committed Capital}} = \frac{1}{\text{Multiple}}$$
3. **`REBALANCING_REQUIREMENT`**:
   The frequency and cost of transferring funds between venues to reset depleted inventory buckets.

---

## 3. Inventory Multiplier Sensitivity Matrix

The table below evaluates hypothetical capital requirements, utilization rates, and annual yield dilution across buffer multiples ($1\times$ to $20\times$) for a simulated $1,000 trade:

### Table 3.1: Inventory Multiplier Sensitivity Analysis

| Buffer Multiple | CEX Cash / Crypto ($) | DEX Cash / Crypto ($) | Total Committed Capital ($) | Capital Utilization (%) | Effective Yield Dilution | Rebalancing Frequency |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1.0$\times$** | $250 / $250 | $250 / $250 | $1,000 | 100.0% | $1.0\times$ (No dilution) | Immediate (after 1 trade) |
| **2.0$\times$** | $500 / $500 | $500 / $500 | $2,000 | 50.0% | $0.5\times$ (2x dilution) | High (after ~1-2 trades) |
| **3.0$\times$** | $750 / $750 | $750 / $750 | $3,000 | 33.3% | $0.33\times$ (3x dilution) | Moderate (after ~2 trades) |
| **5.0$\times$** | $1,250 / $1,250 | $1,250 / $1,250 | $5,000 | 20.0% | $0.20\times$ (5x dilution) | Low-Moderate (~3-4 trades) |
| **10.0$\times$** (Baseline) | $2,500 / $2,500 | $2,500 / $2,500 | $10,000 | 10.0% | $0.10\times$ (10x dilution) | Low (~5-7 trades) |
| **20.0$\times$** | $5,000 / $5,000 | $5,000 / $5,000 | $20,000 | 5.0% | $0.05\times$ (20x dilution) | Very Low (~10-15 trades) |

---

## 4. Operational Requirements: Model A vs. Model B

### Model A: Sequential Cross-Venue Transfer
- **Capital Committed**: $1\times$ trade size ($S$).
- **Capital Utilization**: $100\%$.
- **Operational Reality**: **`NOT_ATOMIC` and `LATENCY_IMPAIRED`**.
- **Execution Breakdown**:
  1. Operator detects DEX price $>$ CEX price.
  2. Buy on CEX.
  3. Submit CEX withdrawal to Base network.
  4. Wait for withdrawal processing + L2 confirmation (16 to 256+ seconds).
  5. Receive token on-chain.
  6. Sell on DEX.
- **Flaw**: Over a 20-to-200 second transfer delay, cryptocurrency market prices drift by tens to hundreds of basis points. A 0.35 bps gross spread is completely overwhelmed by directional market drift. Model A is unviable for high-frequency price discrepancies.

### Model B: Pre-Positioned Dual-Venue Inventory
- **Capital Committed**: $M \times S$ (where $M \in [2, 20]$).
- **Capital Utilization**: $\frac{1}{M} \times 100\%$.
- **Operational Reality**: Allows simultaneous leg dispatch (buy on CEX, sell on DEX concurrently).
- **Flaw**: 
  1. **Yield Dilution**: If a trade earns 5 bps net on trade size, but requires a $10\times$ inventory buffer, the return on committed capital is only $0.5\text{ bps}$.
  2. **Inventory Asymmetry**: As observed in Phase 4.13B, all gross-positive opportunities were strictly unidirectional (`CEX -> DEX`). This continuously drains CEX cash and DEX crypto, forcing regular cross-venue rebalancing and incurring fixed withdrawal fees ($0.50–$2.50) and bridging delays.

---

## 5. Conclusion & Operational Standards

1. The exact inventory multiple required for a live strategy cannot be determined theoretically; it depends on order flow symmetry and rebalancing policies. Where exact values are not empirically established, they are classified as **`UNKNOWN`**.
2. Neither Model A nor Model B transforms non-atomic CEX–DEX arbitrage into atomic arbitrage.
3. Pre-positioning capital introduces significant balance-sheet drag that must be factored into return-on-equity calculations.
