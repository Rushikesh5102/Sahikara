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
