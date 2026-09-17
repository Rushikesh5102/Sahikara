# PHASE 4.14 — Order-Book Dynamics & Multi-Notional VWAP Analysis

> **PHASE STATUS**: RESEARCH-ONLY  
> **CAPITAL**: ₹0.00 | **EXECUTION**: LOCKED | **AUTHENTICATION**: NONE

---

## 1. Multi-Notional VWAP Traversal Methodology

A recurring failure mode in naive arbitrage research is relying on top-of-book (BBO) prices to claim execution viability. In high-resolution market microstructure, executable price is a function of order size $S$ and book depth:

$$\text{VWAP}(S) = \frac{\sum_{i=1}^m p_i \cdot q_i}{S}, \quad \text{where } \sum_{i=1}^m q_i = S$$

In Phase 4.14, every incoming order book was deterministically traversed across eight standardized notional tiers:
$$\$10, \; \$25, \; \$50, \; \$100, \; \$250, \; \$500, \; \$1{,}000, \; \$5{,}000$$

Both `BUY` (walking asks upward) and `SELL` (walking bids downward) executions were evaluated.

---

## 2. Empirical VWAP Slippage Across Notionals

Across the live evaluated books on Binance, Coinbase, and Kraken, liquidity depth was sufficient to fill up to $5,000 without liquidity exhaustion. The table below illustrates the observed VWAP progression for `ETHUSDC` on Binance around a representative mid-price of \$2,471.04:

| Notional Tier | Bid BBO (\$) | Sell VWAP (\$) | Sell Slippage (bps) | Ask BBO (\$) | Buy VWAP (\$) | Buy Slippage (bps) |
|---|---|---|---|---|---|---|
| **\$10** | 2,471.04 | 2,471.0400 | 0.000 | 2,471.05 | 2,471.0500 | 0.000 |
| **\$25** | 2,471.04 | 2,471.0400 | 0.000 | 2,471.05 | 2,471.0500 | 0.000 |
| **\$50** | 2,471.04 | 2,471.0400 | 0.000 | 2,471.05 | 2,471.0500 | 0.000 |
| **\$100** | 2,471.04 | 2,471.0400 | 0.000 | 2,471.05 | 2,471.0500 | 0.000 |
| **\$250** | 2,471.04 | 2,471.0398 | -0.001 | 2,471.05 | 2,471.0503 | +0.001 |
| **\$500** | 2,471.04 | 2,471.0392 | -0.003 | 2,471.05 | 2,471.0510 | +0.004 |
| **\$1,000** | 2,471.04 | 2,471.0375 | -0.010 | 2,471.05 | 2,471.0528 | +0.011 |
| **\$5,000** | 2,471.04 | 2,471.0251 | -0.060 | 2,471.05 | 2,471.0645 | +0.059 |

### Observations:
1. **Extremely Deep CEX Liquidity**: On Binance and Coinbase ETH pairs, sizes up to \$5,000 experienced less than **0.06 bps** of order-book walk slippage due to high resting limit order concentrations at top tiers (typically \$50,000–\$250,000 within 1–2 bps of BBO).
2. **Asymmetric Deep Liquidity**: On Kraken ETH/USDC, book depth was somewhat more dispersed, with \$5,000 walks experiencing 0.2–0.8 bps of price drift depending on immediate trade flow.
3. **No Liquidity Depletion**: In none of the 144 evaluations did order size exceed available depth within the top 20–25 levels.

---

## 3. Order-Book Integrity, Sequence Tracking & Gap Handling

Deterministic order-book reconstruction was governed by `CexWebSocketFeed`:
- **Sequence Continuity**: Every message contains exchange sequence IDs (e.g. Coinbase `sequence`, Binance `lastUpdateId`).
- **Gap Invalidation Rule**: If an update arrives where $\text{newSeq} > \text{expectedSeq} + 1$ (or snapshot out-of-order), the book is instantly tagged `BOOK_INVALIDATED`.
- **Zero Sequence Faults**: During the entire Phase 4.14 campaign, **0 sequence gaps** and **0 invalidations** occurred across all 1,474 book updates.
