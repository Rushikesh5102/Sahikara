# PHASE 4.13B — Central Limit Order Book & Deterministic VWAP Model

> **DIRECTIVE 40**: Implement deterministic VWAP simulation. Consume asks upward for BUY; consume bids downward for SELL. Never extrapolate beyond available order-book depth.

---

## 1. Mathematical VWAP Traversal

For a simulated trade with target notional size $S_{\text{usd}}$:

### Buy Side (Consuming Asks)
The order book asks are sorted in ascending order of price: $P_{1}^{\text{ask}} \le P_{2}^{\text{ask}} \le \dots \le P_{K}^{\text{ask}}$, each offering quantity $Q_{i}^{\text{ask}}$.
The cumulative notional filled across levels is:
$$\text{Cost}_{k} = \sum_{i=1}^{k} P_{i}^{\text{ask}} \cdot Q_{i}^{\text{ask}}$$
When the required remaining notional $R \le P_{k+1}^{\text{ask}} \cdot Q_{k+1}^{\text{ask}}$, the partial quantity filled at level $k+1$ is $Q_{k+1}^{*} = R / P_{k+1}^{\text{ask}}$.
The volume-weighted average execution price is:
$$\text{VWAP}_{\text{buy}} = \frac{S_{\text{usd}}}{\sum_{i=1}^{k} Q_{i}^{\text{ask}} + Q_{k+1}^{*}}$$

### Sell Side (Consuming Bids)
The order book bids are sorted in descending order of price: $P_{1}^{\text{bid}} \ge P_{2}^{\text{bid}} \ge \dots \ge P_{K}^{\text{bid}}$, each offering quantity $Q_{i}^{\text{bid}}$.
The cumulative proceeds received is computed by walking down levels until $S_{\text{usd}}$ is fully satisfied:
$$\text{VWAP}_{\text{sell}} = \frac{\sum_{i=1}^{k} P_{i}^{\text{bid}} \cdot Q_{i}^{\text{bid}} + P_{k+1}^{\text{bid}} \cdot Q_{k+1}^{*}}{S_{\text{base}}}$$

---

## 2. Price Impact Formulation

Price impact measures the degradation of the average execution price relative to top-of-book (best bid or best ask):
$$\text{PriceImpact}_{\text{buy}} (\text{bps}) = \left( \frac{\text{VWAP}_{\text{buy}} - P_{1}^{\text{ask}}}{P_{1}^{\text{ask}}} \right) \times 10,000$$
$$\text{PriceImpact}_{\text{sell}} (\text{bps}) = \left( \frac{P_{1}^{\text{bid}} - \text{VWAP}_{\text{sell}}}{P_{1}^{\text{bid}}} \right) \times 10,000$$

---

## 3. Depth Depletion & Zero Extrapolation Rule

If $\sum_{i=1}^{N} P_{i} \cdot Q_{i} < S_{\text{usd}}$, the calculation returns `status = 'INSUFFICIENT_DEPTH'` and immediately halts. Under no circumstances may an execution simulator assume unlisted liquidity or linear extrapolation.
