# Uniswap V2 Style AMM Architecture & Integration Notes

## 1. Mathematical Model
The standard Uniswap V2 AMM model relies on the constant-product formula:
$$(x + \Delta x \cdot (1 - \gamma)) \cdot (y - \Delta y) = x \cdot y$$
where $\gamma = 0.003$ (30 bps swap fee).
Solving for output $\Delta y$:
$$\Delta y = \frac{y \cdot \Delta x \cdot 9970}{x \cdot 10000 + \Delta x \cdot 9970}$$

## 2. Adoption Across Monitored Venues
This invariant powers multiple key protocols across our multi-chain environment:
1. **QuickSwap V2** on Polygon PoS
2. **SushiSwap V2** on Arbitrum One and Polygon PoS
3. **Aerodrome Volatile** on Base
4. **Velodrome Volatile** on Optimism
5. **Camelot V2** on Arbitrum One (with dynamic fee override)

## 3. Quoting Efficiency & Latency Advantage
- Unlike concentrated liquidity (Uniswap v3 / Slipstream) which requires simulating iterative tick transitions via `quoteExactInputSingle` (taking 500–1,800 ms of node CPU time), Uniswap v2 constant-product quotes require only a single lightweight view call: `getReserves()`.
- Local execution of the closed-form equation takes $<0.01$ ms of CPU time, dramatically reducing quote latency.

## 4. Liquidity & Price Impact
- Because liquidity is distributed uniformly from $0$ to $\infty$, capital efficiency is substantially lower than concentrated liquidity pools.
- Trade sizes $\ge \$250$ in standard v2 pools frequently induce noticeable price impact (5–25 bps), rapidly offsetting theoretical gross spreads.
