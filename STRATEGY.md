# STRATEGY.md — Quantitative Arbitrage Strategy & Economic Modeling

> **CRITICAL STRATEGY DISCLAIMER**  
> SAHIKARA makes **no claims or guarantees of profitability**. In competitive decentralized finance markets, theoretical price discrepancies are heavily contested by sophisticated MEV actors.  
> Every mathematical model, fee assumption, and economic threshold documented here is an unvalidated hypothesis until rigorously verified through Phase 3 (Simulation), Phase 4 (Paper Validation), and Phase 8 (Controlled Mainnet Experiment).

---

## 1. Core Arbitrage Mechanism: Spatial Cross-DEX Arbitrage

The foundational strategy of SAHIKARA is **two-point or multi-point spatial cross-DEX arbitrage** within an EVM blockchain network (e.g., Polygon POS).

### Conceptual Workflow:
1. **Asset Discrepancy**: A specific asset pair (e.g., WETH/USDC) exhibits a temporary price divergence between two decentralized exchanges (e.g., DEX A: QuickSwap, DEX B: Uniswap v3).
2. **Cycle Route**: The system initiates an atomic cycle:
   $$\text{Base Token} \xrightarrow{\text{Buy / Swap on DEX A}} \text{Target Token} \xrightarrow{\text{Sell / Swap on DEX B}} \text{Base Token}$$
3. **Atomic Balance Assertion**:
   The trade is only economically sound if:
   $$\text{Final Balance} - \text{Initial Balance} - \text{Total Frictions} > 0$$

---

## 2. Rigorous Economic Decomposition: Frictions & Formula

A common failure mode in naive arbitrage bots is confusing **Gross Spread** with **Executable Net Profit**. SAHIKARA explicitly isolates and models every component of friction.

```mermaid
graph TD
    Gross[Gross Price Spread (Market Price Difference)]
    Gross -->|Deduct| Fee1[DEX Pool Swap Fees (e.g. 0.05% - 0.30% per hop)]
    Fee1 -->|Deduct| Slippage[Slippage & Price Impact (Pool Depth vs Size)]
    Slippage -->|Deduct| Gas[Transaction Gas Costs (Base Fee + Priority Fee)]
    Gas -->|Deduct| RiskPremium[Execution & Revert Risk Premium]
    RiskPremium --> Net[Net Expected Profit (Executable Value)]
    
    Net -->|If Net > Min Threshold| Execute[Pass to Risk Gate]
    Net -->|If Net <= Min Threshold| Discard[Drop Opportunity]
```

### 2.1 The Friction Components

#### A. Gross Spread ($\Delta P_{\text{gross}}$)
The nominal spot price difference between DEX A and DEX B before any token transfer or trade size is considered:
$$\Delta P_{\text{gross}} = \frac{P_{\text{DEX B}} - P_{\text{DEX A}}}{P_{\text{DEX A}}}$$
*Note: A positive gross spread does NOT mean a trade is profitable.*

#### B. DEX Protocol & Pool Fees ($C_{\text{fees}}$)
Every swap hop incurs a protocol-defined liquidity provider fee:
- Standard Uniswap v2 / Quickswap: $0.30\%$ ($30\text{ bps}$) per swap.
- Uniswap v3 fee tiers: $0.01\%$ ($1\text{ bp}$), $0.05\%$ ($5\text{ bps}$), $0.30\%$ ($30\text{ bps}$), or $1.00\%$ ($100\text{ bps}$).
For a two-hop cycle:
$$C_{\text{fees}} = 1 - (1 - f_A)(1 - f_B)$$
Where $f_A, f_B$ are the fee fractions of pools A and B.

#### C. Slippage & Price Impact ($S(Q)$)
Executing an order of quantity $Q$ moves the marginal price along the liquidity curve:
- In Constant Product ($x \cdot y = k$):
  $$\Delta y = \frac{y \cdot \Delta x}{x + \Delta x}$$
- In Concentrated Liquidity (Uniswap v3): Price moves through discrete ticks according to active virtual liquidity $L$.
As trade size $Q$ scales, price impact increases monotonically, eroding the gross spread.

#### D. Gas Costs ($C_{\text{gas}}$)
The direct cost paid to network validators to process and finalize the transaction:
$$C_{\text{gas}} = \text{Gas Units Consumed} \times (\text{Base Fee} + \text{Priority Fee})$$
On EVM chains, complex multi-hop contract calls consume between $120,000$ and $250,000$ gas units. Gas volatility during network congestion can instantly flip a profitable opportunity into a net loss.

#### E. Pool Liquidity Depth ($L_{\text{pool}}$)
The capital reserves available in the pool. Shallow pools cause extreme price impact even on modest trade sizes, while deep pools offer lower price impact but typically feature narrower gross spreads due to high arbitrage competition.

#### F. Transaction & Simulation Risk ($\rho_{\text{risk}}$)
The probability of adverse outcome between the moment of simulation and on-chain inclusion:
- **State Change**: Another trader or MEV searcher executes before us in the block.
- **Revert Penalty**: If a trade reverts due to a tight slippage limit, the gross principal is protected, but **100% of the gas cost is permanently lost**.
- **Front-Running / Sandwich Attacks**: In public mempools, predatory searchers can sandwich our transaction if slippage tolerance is misconfigured.

---

## 3. Net Expected Profit Formula

The system will only proceed when the **Net Expected Profit** ($\Pi_{\text{net}}$) satisfies:

$$\Pi_{\text{net}} = Q_{\text{out}}(Q_{\text{in}}, \text{Pool}_A, \text{Pool}_B) - Q_{\text{in}} - C_{\text{gas}} - \rho_{\text{risk}} > \Pi_{\text{min}}$$

Where:
- $Q_{\text{in}}$: Initial base token input quantity.
- $Q_{\text{out}}$: Exact output quantity calculated by simulating both swap hops with pool tick math and swap fees deducted.
- $C_{\text{gas}}$: Estimated gas cost denominated in base token units at current market rate.
- $\rho_{\text{risk}}$: Risk buffer accounting for revert probability and price slippage drift.
- $\Pi_{\text{min}}$: Minimum net profit hurdle (Provisional: $\ge \$0.05$ or $0.5\%$ of capital).

---

## 4. Empirical Validation Milestones

Before real money is committed, the strategy must prove its economic validity across progressive milestones:

1. **Phase 1 Validation**: Document historical spread persistence across candidate pools over a 14-day sample window.
2. **Phase 3 Validation**: Validate off-chain simulator output against on-chain block execution traces.
3. **Phase 4 Validation**: Paper trade against real-time mempool / block streams to quantify actual vs. missed opportunity rates.
