# ARBITRAGE_ECONOMICS.md — Quantitative Profitability & Capital Sizing Economics

> **CRITICAL ECONOMIC NOTICE**  
> SAHIKARA makes **no claims of guaranteed profitability**.  
> In production, the system must **dynamically compute all economic variables in real-time**. Break-even thresholds, gas costs, and required win rates must never be hard-coded. Scenarios presented in this document are strictly **illustrative**.

---

## 1. The Dynamic Net Expected Profit Formula

Gross spread represents raw market divergence. **Net Expected Profit ($\Pi_{\text{net}}$)** represents actual executable value after all economic frictions. 

The runtime engine must evaluate opportunities dynamically using the following canonical formula:

$$\mathbf{\text{NetExpectedProfit} = \text{ExecutableGrossOutput} - \text{InputCapital} - \text{PoolFees} - \text{GasCost} - \text{OtherExecutionCosts} - \text{RiskBuffer}}$$

### Variable Definitions & Dynamics

| Variable | Characterization | Runtime Evaluation Method |
| :--- | :--- | :--- |
| **$\text{InputCapital}$ ($Q$)** | Deterministic | Capital allocated to the cycle (capped at ₹100 for Phase 8). |
| **$\text{ExecutableGrossOutput}$** | Dynamic State-Dependent | Exact simulated token output at current pool state before fees. |
| **$\text{PoolFees}$** | Tier-Dependent | Cumulative swap fees charged across all cycle hops (e.g., $1\text{ bp}$, $5\text{ bps}$, $30\text{ bps}$, or $100\text{ bps}$ per pool). |
| **$\text{GasCost}$** | Dynamic Block-Dependent | **Never hard-code gas costs** (e.g. do not assume fixed $\$0.003$). Evaluated dynamically as: $\text{GasUsed} \times (\text{BaseFee} + \text{PriorityFee})$. |
| **$\text{OtherExecutionCosts}$** | Overhead Dependent | Node query latency costs, priority relay tips, or flash liquidity fees (if used). |
| **$\text{RiskBuffer}$** | Probabilistic Buffer | Safety hurdle accounting for price drift, latency decay, and potential revert penalty. |

---

## 2. Dynamic Break-Even Analysis (No Universal Threshold)

> **CORE PRINCIPLE**: **There is no universal break-even spread.**  
> A claim that "0.35%–0.40% is the universal break-even spread" is false. 

The actual break-even spread ($\Delta P_{\text{breakeven}}$) is a dynamic function of six independent parameters:
1. **Exact pool fee tiers** (e.g., 5 bps + 5 bps = ~0.10% vs. 30 bps + 30 bps = ~0.60%).
2. **Real-time transaction gas** (fluctuating with L1 blob posting fees and L2 congestion).
3. **Price impact / slippage** (determined by the active liquidity depth at the specific tick).
4. **Trade size ($Q$)** (smaller capital experiences higher relative gas drag).
5. **Execution overhead** (private relay tip or sequencer submission fee).
6. **Failure / revert probability** ($\mathbb{E}[C_{\text{failure}}]$).

### Illustrative Scenarios (For Modeling Purposes Only)

The table below presents **illustrative scenarios** on a theoretical capital base of **$Q = \text{₹100} \approx \$1.20\text{ USD}$**. These figures are non-binding reference cases:

| Scenario | Network | Combined Fee Tiers | Illustrative Gas Cost | Illustrative Break-Even Spread | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **A: Ultra-Low Fee Stables** | Base L2 | 0.02% (1 bp + 1 bp) | $0.0015 | **~0.15%** | Highly correlated assets; low volatility. |
| **B: Volatile Pairs (Low Fee)**| Base L2 | 0.10% (5 bps + 5 bps) | $0.0030 | **~0.35%** | WETH/USDC during quiescent gas conditions. |
| **C: Volatile Pairs (Standard)**| Base L2 | 0.35% (5 bps + 30 bps)| $0.0040 | **~0.68%** | Aerodrome volatile pool + Uniswap v3 5 bps. |
| **D: Polygon Standard** | Polygon PoS | 0.35% (5 bps + 30 bps)| $0.0080 | **~1.02%** | QuickSwap v2 (30 bps) + Uniswap v3 (5 bps). |
| **E: High Congestion Spike** | Base L2 | 0.10% (5 bps + 5 bps) | $0.0120 | **~1.10%** | Network activity spike inflating L1 blob fees. |

*Key Takeaway: Because break-even can range from 0.15% to well over 1.00% depending on pool fees and gas spikes, the simulator must calculate break-even per-opportunity at runtime.*

---

## 3. Generalized Win-Rate Expectancy Model

> **CORE PRINCIPLE**: **There is no universal required win rate (e.g., 67%).**  
> The mathematical win-rate threshold is governed entirely by the ratio of average win to average loss.

### The Formal Expectancy Equation
Let $p$ be the win rate, $\bar{W}$ be the average net profit on a successful trade, and $\bar{L}$ be the average loss on a failed/reverted trade:

$$\mathbb{E}[\Pi] = p \cdot \bar{W} - (1 - p) \cdot \bar{L} > 0$$

Solving for $p$:

$$\mathbf{p > \frac{\bar{L}}{\bar{W} + \bar{L}} = \frac{\text{average\_loss}}{\text{average\_win} + \text{average\_loss}}}$$

### Payoff Ratio Sensitivity Matrix

The table below illustrates how the required break-even win rate ($p$) varies dynamically across different payoff structures:

| Ratio ($\bar{L} / \bar{W}$) | Average Win ($\bar{W}$) | Average Loss ($\bar{L}$) | Required Win Rate ($p$) | Operational Interpretation |
| :---: | :---: | :---: | :---: | :--- |
| **3.0 : 1** | +$0.0010 | -$0.0030 | **> 75.0%** | Severe revert penalty relative to small profit; high win rate mandatory. |
| **2.0 : 1** | +$0.0020 | -$0.0040 | **> 66.7%** | Reverts burn full gas while profits are modest. |
| **1.0 : 1** | +$0.0030 | -$0.0030 | **> 50.0%** | Symmetric risk-reward; standard coin-flip hurdle. |
| **0.5 : 1** | +$0.0040 | -$0.0020 | **> 33.3%** | Large profit spreads or low revert costs; lower win rate viable. |
| **0.2 : 1** | +$0.0050 | -$0.0010 | **> 16.7%** | Pre-simulation filters eliminate 90%+ of reverts before broadcast. |

### Strategic Implications
1. **Pre-Simulation Suppresses $\bar{L}$**: By executing an `eth_call` pre-simulation immediately before broadcast, the system catches stale opportunities off-chain ($C_{\text{off\_chain}} = \$0.00$), preventing on-chain revert penalties.
2. **Dynamic Risk Gate**: The risk engine in Phase 3/4 must continuously track realized $\bar{W}$ and $\bar{L}$ over a rolling 50-trade window to recalculate the minimum acceptable probability $p$ before authorizing transaction dispatch.

---

## 4. Fundamental Arbitrage Definitions & Taxonomy (Phase 1C.2 Directives)

To prevent erroneous claims of profitability or misclassification of market data, the following terms are rigorously delineated and enforced across all code, tests, and database storage:

### Strict Terminology Distinction

1. **One-Way Quote / Theoretical Conversion**
   - **Definition**: The executable output of converting Token A into Token B on a single DEX pool.
   - **Why it is NOT Arbitrage**: In a one-way swap, the portfolio holds an entirely different asset (Token B) subject to independent market risk and exchange rate fluctuations. Comparing the USD equivalent of Token B to an initial baseline does NOT measure arbitrage profit.
   - **Approved Terms**: *one-way quote*, *executable output*, *implied price*, *price impact*, *theoretical conversion*.
   - **Prohibited Terms**: *arbitrage profit*, *net arbitrage profit*, *arbitrage candidate*.

2. **Cross-DEX Round-Trip Arbitrage**
   - **Definition**: A complete, closed cycle starting and ending in the **identical token** (e.g., WETH → Uniswap v3 → USDC → Aerodrome → WETH).
   - **Calculation**: Must evaluate actual executable on-chain quote outputs for both legs (`leg1Output` and `leg2Output`) for the exact trade amount.
   - **Status**: Can only be classified as an *arbitrage candidate* if `netExpectedProfit > minNetProfitUsd` and all safety gates pass.

3. **Actual Executed Trade (Future Phases)**
   - **Definition**: An atomic, on-chain bundle or multi-call executed via a dedicated smart contract that performs both swaps atomically within the same block or reverts.
   - **Status**: Read-only quote evaluations are **NEVER** proof of executable profitability. Real execution incurs block inclusion uncertainty, MEV frontrunning/sandwich competition, private mempool delays, and real gas expenditures.

### Mathematical Definitions

- **Theoretical spread**:
  $$\text{Spread}_{\text{theoretical}} = \frac{P_{\text{DEX2}} - P_{\text{DEX1}}}{P_{\text{DEX1}}}$$
  The difference between quoted spot prices before factoring in pool swap fees, price impact, or execution costs.
- **Executable spread**:
  $$\text{Spread}_{\text{executable}} = \frac{\text{AmountOut}_{\text{Leg2}} - \text{AmountIn}_{\text{Leg1}}}{\text{AmountIn}_{\text{Leg1}}}$$
  Spread based strictly on actual on-chain executable quotes for the exact input amount across both pools.
- **Gross round-trip profit**:
  $$\text{GrossProfit}_{\text{round-trip}} = \text{AmountOut}_{\text{Leg2}} - \text{AmountIn}_{\text{Leg1}}$$
  The final asset quantity minus the initial asset quantity (denominated in the base asset) before gas and risk costs.
- **Net expected profit**:
  $$\text{NetExpectedProfit} = \text{GrossProfit} - \text{GasCost}_{\text{2-hop}} - \text{RiskBuffer}$$
  Gross round-trip profit minus all estimated execution frictions. An opportunity is an **arbitrage candidate** if and only if $\text{NetExpectedProfit} > \text{Threshold}_{\text{min}}$ and all safety constraints pass.

---

## 5. Phase 1C.2.1 Audit — Fee Treatment & Economic Correctness Invariants

### 1. Zero Pool-Fee Double-Counting Invariant
- **Audit Finding**: Executable quote outputs returned by both **Uniswap V3 `QuoterV2.quoteExactInputSingle`** and **Aerodrome `Pool.getAmountOut`** already incorporate the pool's swap fee (e.g. 5 bps or 30 bps) internally in the returned `amountOut`.
- **Architectural Rule**:
  $$\text{GrossRoundTripPnL} = \text{AmountOut}_{\text{Leg2}} - \text{AmountIn}_{\text{Leg1}}$$
  $$\text{NetExpectedPnL} = \text{GrossRoundTripPnL} - \text{GasCost} - \text{OtherExecutionCosts} - \text{RiskBuffer}$$
- Pool fees are **NEVER** deducted a second time from $\text{GrossRoundTripPnL}$.
- Fee metadata (`leg1FeeBps`, `leg2FeeBps`, `leg1FeeAmount`, `leg2FeeAmount`) is recorded strictly for observation and reporting.
- Any filter or gate checking whether fees exceed spread must compare theoretical spread to fee tiers, or simply evaluate whether $\text{GrossRoundTripPnL} \le 0$ (which directly proves fee drag exceeded the quote divergence).

### 2. Core Token Economics vs. Valuation Layer
- **Core Engine Currency**: The arbitrage engine operates primarily in native token units:
  - `initialAmount` ($Q_{\text{in}}$ in base token units)
  - `finalAmount` ($Q_{\text{out}}$ in base token units)
  - `grossRoundTripDiff` = $Q_{\text{out}} - Q_{\text{in}}$
  - `grossSpreadBps` = $\frac{Q_{\text{out}} - Q_{\text{in}}}{Q_{\text{in}}} \times 10,000$
- **Valuation Layer**: USD and INR values are strictly external conversion layers for reporting and normalized threshold comparisons.
- **Test Fixtures**: Hardcoded test prices (such as $2,400/WETH) are labeled `[TEST FIXTURE]` and must never serve as production economics.

### 3. Block Number and Observation Context Integrity
- Every live observation must retrieve `blockNumber`, `timestamp`, and on-chain quotes from the same unified RPC cycle.
- Stale block numbers (e.g., historical artifacts or mock numbers) are strictly prohibited in live reporting. Base mainnet head is verified dynamically (currently block ~51,270,xxx+).

### 4. Gas Classification Invariant
- Gas values are classified into:
  - `[OBSERVED]`: Historical on-chain gas from executed transactions (none currently; no transactions executed).
  - `[ESTIMATE]`: Dynamic gas units $\times$ live `baseFeePerGas` (e.g., 260,000 units for 2-hop cross-DEX execution).
  - `[PROVISIONAL]`: Parametric assumptions requiring empirical calibration.
- Current 2-hop 260k gas assumption is strictly `[ESTIMATE][PROVISIONAL]` and must never be portrayed as executed gas.
