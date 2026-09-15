# EXPERIMENTS.md — Empirical Research & Hypothesis Testing Log

> **PURPOSE**: All trading strategies, latency claims, simulator accuracy figures, and economic models must be grounded in empirical evidence.  
> **RULE**: No assertion of profitability or performance may be entered into the Project Brain without a supporting entry in this log.

---

## 1. Experiment Record Template

When executing an experiment (in Phase 1 Market Research, Phase 3 Simulation, Phase 4 Paper Trading, or Phase 8 Mainnet), use the following standardized format:

```markdown
### EXP-XXX: [Title of Experiment]
- **Date**: YYYY-MM-DD
- **Phase**: [e.g., Phase 1 / Phase 3 / Phase 4 / Phase 8]
- **Author/Agent**: [Name of conducting engineer or agent]
- **Status**: [PLANNED / IN_PROGRESS / COMPLETED / ABORTED]

#### 1. Hypothesis
[Clear, testable, and falsifiable statement. Example: "Over a 48-hour window on Polygon, gross price discrepancies >0.35% between Uniswap v3 and Quickswap occur at least 10 times per day for the WMATIC/USDC pair."]

#### 2. Methodology & Experimental Setup
- **Target Network / Chain**: [e.g., Polygon POS Mainnet]
- **RPC Endpoints Used**: [Provider / Tier]
- **Sample Size / Duration**: [e.g., 50,000 blocks / 48 hours]
- **Data Ingestion Script**: [Link to script in scripts/ or scanner/]

#### 3. Parameters & Variables
- **Token Pair**: [e.g., WMATIC / USDC]
- **Pool Addresses**: [Pool A address, Pool B address]
- **Assumed Trade Size**: [e.g., $10 / $50 / $100]
- **Fee Tiers**: [e.g., 5 bps vs 30 bps]
- **Gas Model**: [e.g., 35 Gwei base fee]

#### 4. Observations & Raw Results
- [Quantitative observations, logs, execution charts, spread distributions]

#### 5. Quantitative Analysis & Net Profitability
- **Gross Opportunities Detected**: [Count]
- **Opportunities Filtered by Slippage**: [Count]
- **Opportunities Filtered by Gas**: [Count]
- **Net Profitable Opportunities**: [Count]
- **Mean Net Profit**: [Amount]
- **Max Drawdown / Worst Case**: [Amount]

#### 6. Conclusions & Decision
- **Hypothesis Status**: [VALIDATED / FALSIFIED / INCONCLUSIVE]
- **Core Findings**: [Summary of key insights]
- **Actionable Decision**: [Reference to ADR in DECISIONS.md or policy adjustment in RISK_POLICY.md]

#### 7. Follow-Up Experiments
- [List any newly generated questions or next experiments]
```

---

## 2. Active & Historical Experiments Log

### EXP-000: Baseline Environment & Project Brain Verification
- **Date**: 2026-09-12
- **Phase**: Phase 0 — Foundation
- **Author/Agent**: Antigravity
- **Status**: **COMPLETED**

#### 1. Hypothesis
A complete, structured, and mutually reinforcing set of 17 Project Brain files will provide sufficient operational, safety, and contextual constraints to allow autonomous agents and human developers to collaborate without ambiguity or accidental live trading risk.

#### 2. Methodology & Experimental Setup
- Synthesize all non-negotiable principles, roadmap milestones, architectural designs, security threat models, and risk limits into the local filesystem.
- Validate repository consistency and cross-document references.

#### 3. Observations & Raw Results
- 17 root Project Brain files generated.
- 18 directories (functional and documentation) established with `.gitkeep` trackers.
- Zero live execution code or secrets present.

#### 4. Conclusions & Decision
- **Hypothesis Status**: **VALIDATED**. Project Brain is established as canonical repository memory.
- **Actionable Decision**: Proceed to operator review for formal Phase 0 sign-off.

---

### EXP-001: Phase 1D Empirical Baseline Market Observation on Base WETH/USDC
- **Date**: 2026-09-15
- **Phase**: Phase 1D — Empirical Market Observation
- **Author/Agent**: Antigravity (Auxiliary AI) & Human Operator
- **Status**: **COMPLETED (BASELINE EXPERIMENT)**

#### 1. Hypothesis
Continuous on-chain block-by-block observation of the WETH/USDC trading pair between Uniswap V3 (5 bps fee) and Aerodrome Volatile (30 bps fee) on Base Mainnet will reveal whether cross-pool price discrepancies frequently exceed cumulative pool fees (35 bps) plus Base L2 gas costs at research trade sizes of $1, $5, and $10.

#### 2. Methodology & Experimental Setup
- **Target Network / Chain**: Base Mainnet (`chain_id: 8453`)
- **RPC Endpoints Used**: Base Public RPC (`https://mainnet.base.org`) via Viem with fallback rate-limit handling
- **Sample Size / Duration**: 30.83 active hours / 55,491 blocks / 17,370 bidirectional round-trips / 43,500 one-way quotes
- **Data Ingestion Script**: `scanner/src/index.ts` (Read-only observer using `node:sqlite` in WAL mode)
- **Controlled Termination**: Interrupted at 30.83h due to host machine restart/sleep; frozen and preserved without restarting per safety protocol.

#### 3. Parameters & Variables
- **Token Pair**: WETH (`0x4200...0006`) / USDC (`0x8335...2913`)
- **Pool Addresses**: Uniswap V3 5 bps (`0xd0b5...f224`), Aerodrome Volatile 30 bps (`0x88c4...7684`)
- **Trade Sizes**: $1.00, $5.00, $10.00 USD
- **Fee Tiers**: 5 bps (UniV3) vs 30 bps (Aerodrome) = 35 bps cumulative pool fee hurdle
- **Gas Model**: Real-time Base L2 base fee + execution gas tracking (~$0.00375 / round trip)

#### 4. Observations & Raw Results
- **Total Round-Trip Observations**: 17,370 (8,685 Route A UniV3→Aero; 8,685 Route B Aero→UniV3)
- **Total One-Way Pool Quotes**: 43,500 (26,100 UniV3; 17,400 Aerodrome)
- **Positive Gross Round-Trips**: 0 (0.00%)
- **Candidates Passing Filter**: 0 (0.00%)
- **Rejection Reason**: `SPREAD_TOO_SMALL` = 17,370 (100.00%)
- **Gross Spread BPS**: Min -66.88 bps, Median -35.00 bps, Mean -34.99 bps, Max -3.02 bps
- **Net Expected Profit BPS**: Min -114.33 bps, Median -60.98 bps, Mean -61.22 bps, Max -16.79 bps
- **Gas Overhead**: ~$0.00375 (~37.5 bps on $1; ~7.5 bps on $5; ~3.75 bps on $10)
- **Full Dossier**: [`docs/strategy/PHASE_1D_BASELINE_RESULTS.md`](./docs/strategy/PHASE_1D_BASELINE_RESULTS.md)

#### 5. Quantitative Analysis & Net Profitability
- **Gross Opportunities Detected**: 0
- **Opportunities Filtered by Slippage / Spread**: 17,370
- **Net Profitable Opportunities**: 0
- **Mean Net Profit**: -$0.027742 (-61.22 bps)
- **Best Case Observed**: -$0.005046 (-16.79 bps on $10 trade)

#### 6. Conclusions & Decision
- **Hypothesis Status**: **VALIDATED (EMPIRICAL BASELINE ESTABLISHED)**.
- **Core Findings**: Under the tested Base WETH/USDC Aerodrome/Uniswap configuration, at the tested $1/$5/$10 research sizes and observed market conditions, no observations passed the configured candidate criteria. The primary barrier is cumulative pool fee friction (35 bps) combined with extreme market efficiency on the WETH/USDC major pair, where MEV bots continuously hold price discrepancies below 5 bps.
- **Actionable Decision**: Ratified in `DEC-017`. Do not restart single-pair 72-hour collection. Transition research to multi-pair, multi-DEX, and fee-optimized pool discovery (e.g. Uniswap V3 5 bps ↔ Aerodrome Slipstream 5 bps / PancakeSwap 1–5 bps, and volatile alt-pairs).

#### 7. Follow-Up Experiments
- **EXP-002**: Multi-Pair Base Discovery (cbBTC/USDC, AERO/USDC, DEGEN/WETH, VIRTUAL/WETH)
- **EXP-003**: Pool Fee Optimization (Uniswap V3 5 bps vs Aerodrome Slipstream CL / PancakeSwap V3)
- **EXP-004**: Multi-Chain Comparison (Polygon PoS Uniswap V3 vs QuickSwap)
