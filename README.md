# SAHIKARA — Autonomous DEX Arbitrage & Market Intelligence Engine

> **CRITICAL SECURITY & OPERATIONAL NOTICE**  
> SAHIKARA is a security-sensitive autonomous decentralized exchange (DEX) arbitrage and market intelligence system designed eventually to execute real-money transactions.  
> **CURRENT STATUS: PHASE 0 (Foundation & Project Brain). Live trading is strictly DISABLED. Production capital deployed is ₹0.**  
> No smart contracts are deployed, no live execution occurs, and no private keys or real capital are connected at this stage.

---

## 1. Project Overview

**SAHIKARA** is an autonomous, deterministic DEX arbitrage and quantitative market intelligence engine. The primary objective is to identify, model, simulate, validate, execute, monitor, and optimize cross-DEX arbitrage opportunities on EVM-compatible blockchains.

The system emphasizes mathematical rigor, deterministic execution control, strict risk boundaries, and end-to-end transparency over speculative or unvalidated trading.

### Target Architecture Direction
- **EVM Blockchain Focus**: Initially targeting high-throughput, low-fee EVM networks (e.g., Polygon POS) to validate small-capital economic efficiency before multi-chain scaling.
- **Microservice / Modular Topology**:
  - **Scanner**: Low-latency mempool and block-state monitoring across DEX liquidity pools.
  - **Simulator & Profitability Engine**: Multi-hop swap simulation accounting for gross spread, exact pool fee tiers, dynamic gas curves, price impact, and slippage.
  - **Execution Engine & Smart Contracts**: Atomically bundled execution logic (atomic arbitrage contracts / flash swaps) designed to revert if minimum net profit constraints are violated.
  - **Risk Manager & Kill Switch**: Deterministic, hard-coded guardrails preventing out-of-bounds execution.
  - **Market Intelligence & Telemetry**: Persistent data logging of historical spreads, liquidity depths, gas spikes, and competitor MEV behavior.

---

## 2. Project Lifecycle & Phased Roadmap

Progress toward real-money execution is gated, sequential, and evidence-driven. Under no circumstances may development skip phases without documented justification in `DECISIONS.md`.

| Phase | Designation | Primary Objective | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Foundation & Project Brain** | Initialize canonical memory, operating models, security guidelines, and directory structure. | **ACTIVE** |
| **Phase 1** | **Market / DEX Research** | Deep-dive pool mechanics, fee structures, liquidity distributions, and gas dynamics on target chains. | Pending |
| **Phase 2** | **Arbitrage Scanner** | Real-time block state and quote ingestion across target DEX pairs. | Pending |
| **Phase 3** | **Simulator & Profitability Engine** | High-fidelity off-chain transaction simulation incorporating net economic friction. | Pending |
| **Phase 4** | **Paper Validation** | Non-executing live paper trading validating theoretical vs. real mempool opportunities. | Pending |
| **Phase 5** | **Smart Contract / Executor** | Atomic execution contracts with embedded slippage, reentrancy, and profit checks. | Pending |
| **Phase 6** | **Testnet Validation** | Full integration testing on public testnets under realistic network conditions. | Pending |
| **Phase 7** | **Security & Production Preparation** | Comprehensive internal security audit, static analysis, fuzzing, and operational runbook dry runs. | Pending |
| **Phase 8** | **Controlled ₹100 Mainnet Experiment** | First live capital deployment capped strictly at ₹100 under high-surveillance controls. | Pending |
| **Phase 9** | **24/7 Autonomous Operation** | Resilient node infrastructure, automated health monitors, and fault-tolerant failovers. | Pending |
| **Phase 10** | **Optimization & Scaling** | Multi-DEX, flash liquidity integration, MEV protection (private RPCs/bundles), and multi-chain expansion. | Pending |

---

## 3. Core Principles & Safety Guardrails

Every contributor (human developer or AI agent) must strictly adhere to the following non-negotiable principles:

1. **Security First**: Capital preservation overrides all performance and profit optimization goals.
2. **Deterministic Execution**: Capital routing and transaction execution are governed solely by verified, deterministic code—never by stochastic AI models or probabilistic heuristics.
3. **Strict Wallet Isolation**: Personal wallets must never touch the trading system. Dedicated, air-gapped generation and cold/warm tiered keys must be used exclusively.
4. **Zero Secrets in Git**: No private keys, mnemonics, API tokens, or RPC credentials may ever be committed to the repository.
5. **No Accidental Live Trading**: Live execution gates are locked by default at compile and runtime levels.
6. **Radical Transparency**: Every failure, reverted transaction, bug, simulation error, and invalid assumption must be logged in `TRANSPARENCY_POLICY.md` and `LESSONS_LEARNED.md`.

---

## 4. Repository Structure

```text
├── .gitignore                   # Security filter preventing secret/artifact leaks
├── README.md                    # Project overview and orientation (this file)
├── AGENTS.md                    # Operational mandates for AI and human contributors
├── PROJECT_STATE.md             # Canonical single source of current status and metrics
├── PROJECT_RULES.md             # 18 non-negotiable engineering and security principles
├── MASTER_PLAN.md               # Detailed phase-by-phase roadmap and exit gates
├── PROJECT_OPERATING_MODEL.md   # Collaborative framework (Human, Architect, Antigravity, Reviewers)
├── PROJECT_MEMORY_ARCHITECTURE.md # Repository-as-canonical-memory standard
├── ARCHITECTURE.md              # Technical system design and planned topology
├── STRATEGY.md                  # Quantitative arbitrage mechanics and net-profit formula
├── SECURITY.md                  # Comprehensive security, threat model, and key-management protocols
├── RISK_POLICY.md               # Hard risk boundaries, kill switches, and provisional limits
├── DECISIONS.md                 # Immutable Architecture & Engineering Decision Records (ADRs)
├── CHANGELOG.md                 # Chronological versioning and milestone log
├── EXPERIMENTS.md               # Empirical research framework and hypothesis testing records
├── LESSONS_LEARNED.md           # Failure analysis, post-mortems, and institutional memory
├── TRANSPARENCY_POLICY.md       # Mandatory disclosure policy for bugs, losses, and anomalies
├── ONBOARDING_AN_AGENT.md       # Step-by-step onboarding sequence for new autonomous agents
├── contracts/                   # Smart contract sources (Solidity/Vyper) — Phase 5+
├── scanner/                     # Market data ingestion & pool state listeners — Phase 2+
├── simulator/                   # Off-chain multi-hop swap simulation engine — Phase 3+
├── executor/                    # Transaction builder, gas optimizer & signer — Phase 5+
├── dashboard/                   # Operator telemetry, alerting & monitoring — Phase 8+
├── tests/                       # Unit, integration, fuzzing, and simulation test suites
├── scripts/                     # Operational, deployment, and verification scripts
├── infrastructure/              # Node RPC configurations, Docker, systemd services
└── docs/                        # Domain-specific documentation directories
    ├── strategy/                # Mathematical specifications and market models
    ├── architecture/            # Component diagrams and sequence flows
    ├── security/                # Threat analyses, audit reports, checklists
    ├── infrastructure/          # Node topology, network benchmarking
    ├── deployment/              # Safe staging and deployment runbooks
    ├── testing/                 # Test plans and coverage reports
    ├── operations/              # Monitoring, emergency incident response
    ├── legal/                   # Regulatory considerations and compliance notes
    └── finance/                 # PnL accounting, capital management, and fee logs
```

---

## 5. How to Engage with This Repository

If you are an AI agent or human engineer starting work on SAHIKARA:
1. Stop immediately before proposing or writing code.
2. Follow the sequence defined in [`ONBOARDING_AN_AGENT.md`](./ONBOARDING_AN_AGENT.md).
3. Review [`AGENTS.md`](./AGENTS.md) and [`PROJECT_STATE.md`](./PROJECT_STATE.md) to understand current operational phase constraints.
4. Verify all changes against [`PROJECT_RULES.md`](./PROJECT_RULES.md) and [`SECURITY.md`](./SECURITY.md).
