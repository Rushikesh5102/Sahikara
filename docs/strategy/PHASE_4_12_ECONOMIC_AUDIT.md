# PHASE 4.12: Arbitrage Economic Audit & Valuation Models

## 1. Mathematical Economics Framework

The SAHIKARA economic evaluation engine evaluates multi-leg cross-DEX cyclic routes using strict executable simulation economics. Every monetary calculation preserves exact token precision through native integer arithmetic before USD normalization.

### 1.1 Gross Round-Trip PnL
For a cyclic route beginning and ending in Token $A$ with trade size amount $A_0$:
$$\Delta_{\text{gross}} = A_{\text{final}} - A_0$$
$$\text{Gross Spread (bps)} = \left( \frac{A_{\text{final}} - A_0}{A_0} \right) \times 10,000$$

Where $A_{\text{final}}$ is the exact output returned by the final leg adapter after traversing all constituent pools.

### 1.2 Gas Valuation Decoupling [DEC-036]
In compliance with Rule 12 and Decision `DEC-036`, gas token pricing is strictly decoupled from trade token pricing:
$$\text{GasCost}_{\text{USD}} = \left( \text{GasUnits} \times P_{\text{gas, wei}} \times 10^{-18} \right) \times P_{\text{nativeGasToken, USD}}$$

- **Base, Arbitrum, Optimism**: Native gas asset is ETH ($\approx \$2,600$ USD).
- **Polygon PoS**: Native gas asset is POL/MATIC ($\approx \$0.35$ USD).
- **Base Trade Denomination**: Traded token input amount is valued using $P_{\text{baseToken, USD}}$ independently.

### 1.3 Risk Buffer & Net Expected Profit
$$\text{RiskBuffer}_{\text{USD}} = \text{TradeSize}_{\text{USD}} \times 0.001 \quad (10\text{ bps safety buffer})$$
$$\text{Net Expected Profit}_{\text{USD}} = \text{GrossProfit}_{\text{USD}} - \text{GasCost}_{\text{USD}} - \text{RiskBuffer}_{\text{USD}}$$

---

## 2. Pool Fee Mathematics & Compounding Drag

In automated market makers, pool fees are deducted from the input amount prior to reserve constant updates. For a 2-hop cycle through Pool 1 (fee $f_1$) and Pool 2 (fee $f_2$):
$$A_{\text{final}} = A_0 \cdot (1 - f_1) \cdot \frac{R_{1, \text{out}}}{R_{1, \text{in}} + A_0 (1 - f_1)} \cdot (1 - f_2) \cdot \frac{R_{2, \text{out}}}{R_{2, \text{in}} + A_1 (1 - f_2)}$$

In settled equilibrium where spot prices match:
$$\frac{A_{\text{final}}}{A_0} \approx (1 - f_1)(1 - f_2) \approx 1 - (f_1 + f_2)$$

### Minimum Mispricing Thresholds to Achieve Gross Profit:
| Route Combination | Leg 1 Fee | Leg 2 Fee | Cumulative Round-Trip Fee Drag | Required Price Discrepancy |
| :--- | :---: | :---: | :---: | :---: |
| **Uniswap v3 (1 bps) $\leftrightarrow$ Aerodrome Stable (1 bps)** | 1 bps | 1 bps | **2 bps** | $> 0.02\%$ |
| **Uniswap v3 (5 bps) $\leftrightarrow$ Aerodrome Stable (1 bps)** | 5 bps | 1 bps | **6 bps** | $> 0.06\%$ |
| **Uniswap v3 (5 bps) $\leftrightarrow$ Aerodrome Volatile (5 bps)** | 5 bps | 5 bps | **10 bps** | $> 0.10\%$ |
| **Uniswap v3 (5 bps) $\leftrightarrow$ Camelot v2 (30 bps)** | 5 bps | 30 bps | **35 bps** | $> 0.35\%$ |
| **Uniswap v3 (30 bps) $\leftrightarrow$ QuickSwap v2 (30 bps)** | 30 bps | 30 bps | **60 bps** | $> 0.60\%$ |
| **3-Hop Triangular (Uniswap v3 + Camelot + Sushi)** | 5 bps + 30 bps + 30 bps | **65 bps** | $> 0.65\%$ |

---

## 3. Structural Mechanics of Settled-State Zero Arbitrage

Public mempool searchers and builder-integrated arbitrage bots (e.g. Flashbots Protect, builder bundles, private RPC flows) actively rebalance price discrepancies within blocks or atomic transaction sequences. 

Consequently, **post-block settled state** naturally exhibits price parity within the fee band. Any public cross-venue cycle evaluated against committed on-chain state must absorb the fee drag of all intermediate pools, producing strictly negative gross and net outcomes across all evaluated trade sizes.
