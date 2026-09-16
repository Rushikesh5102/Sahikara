# SAHIKARA Simulator (`simulator/` — Phase 3 Implementation)

> **STATUS**: PHASE 3 COMPLETE & VALIDATED  
> **ENGINE LOCATION**: `scanner/src/simulator/`  
> **SECURITY INVARIANT**: Execution strictly LOCKED. Zero private keys, zero signers, zero transaction broadcasting, zero live trading.

---

## 1. Overview
The SAHIKARA High-Fidelity Simulator evaluates detected DEX arbitrage opportunities and historical on-chain events under realistic execution conditions. It models:
- **Exact Swap Math & Slippage**: Constant Product ($x \cdot y = k$) and Concentrated Liquidity (QuoterV2 / MixedQuoterV3).
- **Dynamic Gas Sensitivity**: Base fee volatility ($0.01$ to $5.0\text{ Gwei}$), priority fees, and gas unit consumption.
- **Latency Drift & Decay**: Adverse price movement $\Delta P_{\text{drift}}(\Delta t)$ and opportunity half-life ($t_{1/2}$).
- **Atomic Execution & Revert Semantics**: Two-leg atomic contract semantics (`ArbitrageExecutor.sol`) with 100% principal protection and gas loss modeling.
- **Trade-Size Optimization**: Sweeping capital across $\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$ to characterize concave net profit curves.
- **Shadow Paper Execution**: Off-chain ledger tracking paper portfolio balance, win rate, and realized PnL.
- **Historical Replay**: Replaying Polling-Era (Phases 1D–1F) vs. Event-Driven-Era (Phase 2) observations to evaluate missed opportunities.

---

## 2. Module Directory (`scanner/src/simulator/`)

| File | Component | Role |
|---|---|---|
| [`types.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/types.ts) | Domain Models | Explicitly tags `[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, and `[ASSUMPTION]` data fields. |
| [`PriceImpactModel.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/PriceImpactModel.ts) | Price Impact & Slippage | CPAMM and concentrated liquidity slippage curves; enforces $S_{\text{max}} = 20\text{ bps}$. |
| [`GasSensitivityEngine.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/GasSensitivityEngine.ts) | Gas Sensitivity | Multi-dimensional sensitivity matrix across base fees and gas units; calculates break-even base fee. |
| [`LatencyDriftModel.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/LatencyDriftModel.ts) | Latency & Decay | Models adverse price drift over detection delay $\Delta t$ and evaluates opportunity survival. |
| [`AtomicExecutionSimulator.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/AtomicExecutionSimulator.ts) | Atomic Contract Semantics | Two-leg revert semantics: capital principal is 100% protected, gas is 100% lost. Zero fee double-counting. |
| [`TradeSizeOptimizer.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/TradeSizeOptimizer.ts) | Trade-Size Sweep | Identifies optimal size $Q^*$ and dominant constraints (`FIXED_GAS_OVERHEAD`, `SLIPPAGE_CONVEXITY`). |
| [`ShadowExecutionEngine.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/ShadowExecutionEngine.ts) | Paper Trading Ledger | Manages simulated account balance, tracks fills vs reverts, and records audit trails. |
| [`HistoricalReplaySimulator.ts`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/simulator/HistoricalReplaySimulator.ts) | Replay & Diagnosis | Replays historical SQLite observations and generates failure diagnosis distribution. |

---

## 3. Running Controlled Validation
To execute the controlled Phase 3 validation run:
```powershell
cd scanner
npm run simulate
```
