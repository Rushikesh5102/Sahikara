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

1. **Phase 1 Validation**: Document historical spread persistence across candidate pools.
   - **Phase 1D Baseline Fact [FACT]**: WETH/USDC on Base across Uniswap V3 (5 bps) and Aerodrome Volatile (30 bps) generated 0 positive round-trip opportunities over 30.83 hours / 17,370 round-trips. Total fee friction (35 bps) consistently exceeded available market spread.
   - **Phase 1E Multi-Pair Discovery [FACT]**: Expanded research universe to volatile alts (`AERO/USDC`, `DEGEN/WETH`, `VIRTUAL/WETH`) and additional DEX venues (PancakeSwap V3, Aerodrome Slipstream stub) to discover wider spread opportunities while preserving strict fee separation.
   - **Phase 1F Low-Friction Discovery [FACT]**: Slashed fee friction from 35 bps to 10 bps by connecting concentrated liquidity 5 bps pools across Uniswap V3, Aerodrome Slipstream (ts=50), and PancakeSwap V3 (fee=500). Activated 7 verified pairs across 16 on-chain pools.
2. **Phase 2 Event-Driven Validation [FACT]**:
   - Replaced classical sequential round-robin polling (which suffered 48.7s cycle latency across 26 routes) with reactive WebSocket state-change event ingestion and selective route re-quoting via inverted pool index.
   - Achieved **84.6% RPC call reduction** (24 calls vs 156 calls per sweep) and **93.1% faster response time** (3.35s vs 48.69s).
   - Eliminated cross-leg block drift by pinning both legs of cross-DEX evaluations to the triggering event's block number.
   - Verified 100% deterministic classification matching across historical event replay with zero state divergences.
3. **Phase 3 High-Fidelity Simulation Validation [SIMULATED / MODELED]**:
   - Built an execution-grade simulator with mathematical models for CPAMM and concentrated liquidity price impact, multidimensional gas sensitivity, latency drift, atomic contract revert semantics, and trade-size optimization.
   - **Break-Even Gas Economics [CALCULATED / ASSUMED INPUTS]**: Derived analytical break-even base fee $f_{\text{base}}^* = 0.4045\text{ Gwei}$ for a hypothetical $100 trade with 40 bps spread, 220k gas units [ESTIMATED], $2,500/ETH [ASSUMPTION], and 0.05 Gwei priority fee [ASSUMPTION]. At typical Base network base fees (~0.005–0.05 Gwei [OBSERVED]), network fees provide a healthy theoretical safety margin (~8x to 80x below break-even).
   - **Latency Half-Life & Decay [MODELED / ASSUMED INPUTS]**: Modeled adverse drift assuming diffusion coefficient $\alpha = 3.5\text{ bps/sec}$ [ASSUMPTION]; demonstrated that under this model a 25 bps gross spread exhibits a theoretical opportunity half-life of **$t_{1/2} = 5.46\text{ seconds}$** with a modeled viable execution cutoff at **$\Delta t_{\text{max}} = 3.0\text{ seconds}$**. This demonstrates that sequential polling (48.7s) is structurally incapable of capturing ephemeral dislocations, whereas sub-second/low-second event-driven re-quoting approaches the actionable window.
   - **Trade-Size Concavity [SIMULATED]**: Demonstrated that small trade sizes ($Q < \$10$) are dominated by fixed gas overhead, while large sizes ($Q > \$100$) are bounded by slippage convexity on volatile pools.
   - **Replay Diagnosis [OBSERVED QUOTES / SIMULATED EXECUTION]**: Replayed 200 historical observations through full atomic execution simulation: 82% failed on `NET_LOSS_REVERT` (calm market price equilibrium) and 18% failed on `INSUFFICIENT_LIQUIDITY_LEG1`. Zero false-positive opportunities were admitted.
   - **Shadow Paper Execution Ledger [SYNTHETIC TEST VECTOR]**: Validated state transitions and accounting math of the paper ledger using an injected synthetic candidate (+35 bps artificial spread, +$0.2197 hypothetical PnL). Confirmed that real live Base Mainnet quote sweeps on WETH/USDC showed negative gross spreads (-3.75 bps) with zero profitable opportunities.
   - **Zero Fee Double-Counting [PROVEN RULE]**: Enforced strict separation between quotes and fees; swap fees incorporated in on-chain quoter outputs are never deducted twice.
4. **Phase 4 Real-Time Shadow Execution Validation [EMPIRICAL / PAPER]**:
   - **Continuous Event-Driven Pipeline**: Ingested live Base Mainnet `Swap`/`Sync` events, selectively re-quoted affected routes via Multicall3, and applied an execution-grade 10-point false positive protection filter across 26 verified routes.
   - **Empirical Market Finding [FACT]**: Evaluated 15 live event cycles (192 route checks) on Base Mainnet. 100% of candidate checks exhibited non-positive gross spreads or fee friction exceeding cross-pool dislocation. Zero phantom trades were admitted.
   - **Paper Portfolio Integrity [PAPER/SIMULATION]**: Maintained an isolated live virtual portfolio ($100.00 cash). Ending balance preserved at $100.00, with 0 trades filled, 0 reverts, and a 0.0% win rate.
   - **Next-Block Calibration Proxy [CALIBRATED]**: Calibrated spread decay and persistence on live blocks ($B \to B+1$). Verified with an isolated synthetic fixture (+35 bps predicted -> +28 bps realized, -7.0 bps decay error) while maintaining strict physical partition from live metrics.
   - **Zero Fake Win Rate [PROVEN RULE]**: Physical ledger separation between live and synthetic execution prevents artificial fixture results from ever claiming strategy profitability.
5. **Phase 4.5 Opportunity Discovery & Calibration Campaign [FACT / EMPIRICAL]**:
   - **Multi-Pool Same-Pair Discovery [FACT]**: Expanded pool registry to include multiple pools per pair (Uniswap v3 WETH/USDC 500 & 3000 pools) while preserving unique pool identities via `poolAddress`. Activated 17 verified pools across 7 pairs and 26 distinct routes.
   - **5-Tier Opportunity Classification [STANDARDIZED]**: Formalized a 5-tier classification hierarchy: TIER 0 (no dislocation / $\le 0$ spread), TIER 1 (gross positive, fails economic hurdle), TIER 2 (positive after pool fees, fails gas/slippage/latency), TIER 3 (simulated net positive off-chain), TIER 4 (survived off-chain simulation AND persisted in next-block calibration).
   - **8-Tier Trade Size Sweep [EMPIRICAL]**: Evaluated routes across 8 sizes ($\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$). Verified that price impact worsens net spreads at larger sizes, bounding optimal simulated trade size.
   - **Controlled Campaign Findings [FACT]**: Evaluated 18 real market events (17 on-chain swap/sync + 1 block header) and 448 route opportunities on Base Mainnet. 100% (448/448) were classified as TIER 0 with negative gross spreads (median: -56.30 bps, max: -30.44 bps). Zero profitable arbitrage opportunities existed.
   - **Diagnostic Failure Separation [FACT]**: 0 infrastructure failures (0 RPC 429s, 0 timeouts, 0 quoter reverts across 2,709 requests). Proved that zero opportunity count is an empirical market fact, not a software defect.
   - **Paper Portfolio & Win Rate Integrity [FACT]**: Maintained $100.00 virtual capital. Ending balance preserved at $100.00. Reported `Win Rate = N/A` (never fabricated 0%).
6. **Phase 5 Validation (Pending Operator Gate)**: Develop atomic on-chain arbitrage contract (`ArbitrageExecutor.sol`) with strict post-swap balance checks and atomic revert guarantees.
