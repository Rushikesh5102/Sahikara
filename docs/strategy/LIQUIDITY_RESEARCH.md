# LIQUIDITY_RESEARCH.md — Pool Depth, AMM Mathematics & Price Impact Curves

> **DOCUMENT STATUS**: ACTIVE RESEARCH (PHASE 1)  
> **PURPOSE**: Investigate the mathematical relationship between AMM pool reserve depth, concentrated liquidity distribution, and execution slippage across candidate DEX protocols.

---

## 1. AMM Invariants & Slippage Mechanics

Execution slippage is the divergence between the marginal spot price before a trade and the effective execution price realized by the trade. It is a direct mathematical consequence of AMM reserve depletion.

### 1.1 Constant Product Invariant (Uniswap v2 / QuickSwap v2)
Governed by:
$$x \cdot y = k$$
For a swap with base input $\Delta x$ with fee $f = 0.003$ ($0.3\%$):
$$\Delta y = \frac{y \cdot (1 - f) \cdot \Delta x}{x + (1 - f) \cdot \Delta x}$$
The **Marginal Spot Price** is $P_0 = \frac{y}{x}$.  
The **Effective Execution Price** is $P_{\text{exec}} = \frac{\Delta y}{\Delta x}$.  
The **Price Impact** ($S_{\text{impact}}$) for trade size $\Delta x$ is:
$$S_{\text{impact}} \approx \frac{\Delta x}{x + \Delta x}$$

### 1.2 Concentrated Liquidity Invariant (Uniswap v3 / Algebra v3)
In concentrated liquidity, capital $L$ is active only within the current tick range $[\text{tick}_l, \text{tick}_u]$:
$$L = \frac{\Delta y}{\Delta \sqrt{P}} = \Delta x \cdot \frac{\sqrt{P_l} \sqrt{P_u}}{\sqrt{P_u} - \sqrt{P_l}}$$
Within a single active tick, price impact is governed by virtual reserves:
$$x_{\text{virtual}} = \frac{L}{\sqrt{P}}, \quad y_{\text{virtual}} = L \cdot \sqrt{P}$$
Because virtual reserves $x_{\text{virtual}}, y_{\text{virtual}}$ are $20\times$ to $1000\times$ larger than physical token balances in a constant-product pool of equivalent capital, **price impact within the active tick is dramatically compressed**.

---

## 2. Quantitative Price Impact Comparison: ₹100 vs. ₹100,000

Let us compare the price impact of different trade sizes across realistic liquidity depths for the **WMATIC / USDC** pair:

- **Pool Depth A (Constant Product v2)**: $x = 1,000,000\text{ USDC}$, $y = 2,500,000\text{ POL}$.
- **Pool Depth B (Concentrated Liquidity v3 0.05%)**: Active virtual liquidity equivalent to $\$25,000,000$ constant product.

| Trade Capital ($Q$) | Pool Model | Effective Pool Depth | Theoretical Price Impact ($S_{\text{impact}}$) | Slippage Loss ($USD$) |
| :--- | :--- | :--- | :--- | :--- |
| **₹100 ($1.20)** | Constant Product v2 | $1,000,000 USDC | **0.00012% (0.012 bps)** | $< \$0.00001$ |
| **₹100 ($1.20)** | Concentrated v3 | $25,000,000 virtual | **0.0000048% (0.00048 bps)** | $< \$0.000001$ |
| **₹10,000 ($120.00)** | Constant Product v2 | $1,000,000 USDC | **0.012% (1.2 bps)** | $\$0.014$ |
| **₹10,000 ($120.00)** | Concentrated v3 | $25,000,000 virtual | **0.00048% (0.048 bps)** | $\$0.0006$ |
| **₹1,00,000 ($1,200)** | Constant Product v2 | $1,000,000 USDC | **0.12% (12 bps)** | $\$1.44$ |
| **₹10,00,000 ($12,000)**| Constant Product v2 | $1,000,000 USDC | **1.19% (119 bps)** | $\$142.80$ |

---

## 3. The "Micro-Capital Asymmetry" Advantage

A key empirical discovery of Phase 1 research is the **Micro-Capital Asymmetry**:

1. **Near-Zero Price Impact**: At $Q = \text{₹100}$ (~$1.20 USD), the transaction moves the market by less than $0.0001\%$. For all practical simulation purposes, **slippage is mathematically zero** at this trade scale.
2. **Pure Pricing Efficiency**: The micro-capital trade does not disturb the pool's marginal price, allowing SAHIKARA to execute pure price-taking without self-induced adverse price impact.
3. **The Trade-Off**: While slippage is zero, **gas friction as a percentage of capital is at its absolute maximum** (as proven in `ARBITRAGE_ECONOMICS.md`).

---

## 4. Tick-Crossing Hazards in Concentrated Liquidity

While small trades do not move price significantly within an active tick, a dangerous edge case exists in Uniswap v3:
- **Tick Boundary Execution**: If the current spot price sits exactly on an initialized tick boundary, even a $\$1.20$ trade can trigger a **tick crossing**.
- **Gas Spike from Tick Crossing**: Crossing an initialized tick writes to storage, updating the tick bitmap. This increases contract execution gas from ~110,000 units to ~145,000 units (+30% gas spike).
- **Simulator Guardrail**: The Phase 3 Simulator must check whether the current tick $\text{tick}_{\text{current}}$ is within $\pm 2$ ticks of an initialized tick boundary. If so, a $35,000$ gas penalty buffer must be automatically added to the cost model.
