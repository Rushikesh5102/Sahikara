# PHASE 4.13B — Cross-Venue Inventory Allocation & Atomicity Forensics

> **CRITICAL ARCHITECTURAL DIVIDE**: Cross-venue CEX–DEX arbitrage is fundamentally non-atomic. Capital cannot move instantaneously between off-chain central ledgers and on-chain state machines.

---

## 1. Model A: Sequential Transfer Arbitrage

In Model A, an operator holds capital in a single location (e.g. on a DEX wallet or CEX balance) and initiates an on-chain transfer or exchange withdrawal only after observing a price discrepancy.

### Operational Constraints & Failure Mode
1. **Deposit Confirmation Latency**:
   - Centralized exchanges require confirmation thresholds before crediting deposits:
     - Base: 12 blocks ($\approx 24.0\text{ s}$)
     - Arbitrum One: 64 blocks ($\approx 16.0\text{ s}$)
     - Polygon PoS: 128 blocks ($\approx 256.0\text{ s}$)
2. **Directional Delta Exposure**:
   - Cryptocurrency spot prices change by several basis points every second.
   - During a 16-to-256 second confirmation window, the observed 0.35 bps or 10.0 bps price discrepancy will inevitably dissipate or reverse, exposing the operator to unhedged market volatility.
3. **Formal Verdict**:
   - **Model A is structurally non-executable for latency-sensitive arbitrage.**
   - Formally classified as `NOT_ATOMIC` and `LATENCY_IMPAIRED`.

---

## 2. Model B: Pre-Positioned Dual Inventory

In Model B, the operator maintains pre-funded balances on both venues simultaneously:
- Venue 1 (CEX): USD cash balance + Crypto spot balance.
- Venue 2 (DEX): Stablecoin cash balance + Wrapped crypto balance.

### Capital Allocation & Drag Formulation
For a maximum trade size $S$, maintaining a safety buffer multiplier of $M = 2.5\times$:
$$\text{Total Committed Capital} = 4 \times M \times S = 10 \times S$$

| Trade Size ($S$) | Buffer Multiplier ($M$) | Per-Bucket Allocation | Total Committed Capital ($10 \times S$) | Capital Utilization Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **$10** | $2.5\times$ | $25.00$ | **$100.00** | 10.0% |
| **$100** | $2.5\times$ | $250.00$ | **$1,000.00** | 10.0% |
| **$1,000** | $2.5\times$ | $2,500.00$ | **$10,000.00** | 10.0% |
| **$5,000** | $2.5\times$ | $12,500.00$ | **$50,000.00** | 10.0% |

### Return on Committed Capital Dilution
Because 90% of committed capital sits idle to absorb bidirectional imbalance, any net return per executed trade is diluted by a factor of 10:
$$\text{Yield}_{\text{committed}} = \frac{\text{NetProfit}}{10 \times S} = \frac{\text{NetSpread}_{\text{trade}}}{10}$$

Even if a trade generated a nominal net spread of $+20.0\text{ bps}$, the effective yield on total deployed capital would be only $+2.0\text{ bps}$, before accounting for periodic rebalancing withdrawal fees.
