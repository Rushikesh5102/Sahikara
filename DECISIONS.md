# DECISIONS.md — Architecture & Strategy Decision Log (ADRs)

> **PURPOSE**: This document is the immutable record of all architectural, strategic, and security decisions made for SAHIKARA.  
> **RULE**: Every significant design choice, dependency change, chain selection, or risk parameter update must be documented here with context, options considered, and clear rationale.

---

## Decision Status Legend
- **APPROVED**: Formally reviewed, agreed upon, and ratified by the Human Operator.
- **PROVISIONAL**: Proposed baseline or working assumption subject to empirical validation in simulation/testnet.
- **SUPERSEDED**: Replaced by a newer approved decision.
- **REJECTED**: Evaluated and discarded with recorded justification.

---

## Log of Decisions

### DEC-001: Repository as Canonical Project Memory
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Autonomous agents and human engineers operate across distributed, asynchronous sessions where conversational memory is transient and unreliable.
- **Decision**: The Git repository (Project Brain root files, documentation, code, and commit logs) serves as the sole canonical source of project truth. No undocumented ephemeral agreements are valid.
- **Consequences**: Every agent must onboard by reading the repository; all changes, failures, and decisions must be committed to Git.

---

### DEC-002: Security-First Development Paradigm
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: The eventual system will execute live on-chain transactions with real capital. In DeFi, software flaws or compromised keys lead to permanent, irreversible loss of capital.
- **Decision**: Capital preservation and system security strictly supersede performance optimization, execution latency, and development speed.
- **Consequences**: Strict code audits, fuzzing, static analysis, and zero-secret commit policies are mandatory before deploying capital.

---

### DEC-003: Absolute Isolation of Personal Wallets
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Mixing personal developer funds or personal wallets with an automated trading system creates catastrophic risk of accidental draining or key compromise.
- **Decision**: Personal wallets are strictly forbidden from interacting with SAHIKARA code, tests, or infrastructure. The production execution wallet must be freshly generated, dedicated exclusively to the project, and funded only with authorized capital.
- **Consequences**: Hard separation of key generation, testing accounts, and operational infrastructure.

---

### DEC-004: Simulation and Paper Trading as Mandatory Validation Gates
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Theoretical arbitrage opportunities frequently evaporate when subjected to real pool tick math, dynamic gas spikes, and mempool competition.
- **Decision**: The system must pass mandatory, empirical off-chain simulation (Phase 3) and live paper-trading (Phase 4) validation gates before any smart contract is deployed to mainnet.
- **Consequences**: Premature live capital deployment is strictly prevented; all claims of profitability require empirical verification.

---

### DEC-005: Deterministic Execution Logic Controls Capital
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Large Language Models and probabilistic AI models can hallucinate, experience drift, or behave unpredictably when handling edge-case numerical data.
- **Decision**: AI models may assist in research, simulation design, code generation, and anomaly detection, but must NEVER possess direct runtime execution authority over capital. All live transaction creation, validation, and dispatch must be executed by deterministic, auditable code.
- **Consequences**: On-chain and off-chain execution paths remain 100% deterministic and auditable.

---

### DEC-006: Initial System Focus on EVM DEX Arbitrage
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: SAHIKARA requires a mature, well-documented ecosystem with standardized smart contract interfaces (ERC-20, Uniswap v2/v3 standards) and robust developer tooling (Foundry, Ethers, Viem).
- **Decision**: Focus initial development strictly on EVM-compatible decentralized exchanges and protocols.
- **Consequences**: Non-EVM chains (Solana, Cosmos, etc.) are deferred to post-Phase 10 roadmap.

---

### DEC-007: Initial Live Experiment Target Capped at ₹100
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Moving from paper trading to live mainnet execution involves real-world execution risks (MEV searchers, validator reordering, unpredicted slippage). Testing with significant capital risks avoidable loss.
- **Decision**: Phase 8 live mainnet experimentation is strictly capped at ₹100 (in native token / stablecoin equivalent).
- **Consequences**: Capital at risk is trivial while real-world mainnet mechanics and latency are conclusively tested.

---

### DEC-008: Selection of Polygon POS as Initial Target EVM Chain
- **Status**: **PROVISIONAL**
- **Date**: 2026-09-12
- **Context**: With an experimental capital envelope of ₹100 (~$1.20 USD), Ethereum Mainnet gas fees ($2–$50 per swap) make micro-capital arbitrage economically impossible. Polygon POS offers sub-cent gas fees ($0.001–$0.02), short block times (~2s), and deep liquidity across major DEXs.
- **Decision**: Provisionally select Polygon POS as the primary network for Phase 1 research through Phase 8 testing.
- **Consequences**: Requires validating Polygon state finality, reorg characteristics, and liquidity pool distributions in Phase 1. Subject to formal approval after Phase 1 Market Research.

---

### DEC-009: Target Initial DEX Candidates: Uniswap v3 & QuickSwap
- **Status**: **PROVISIONAL**
- **Date**: 2026-09-12
- **Context**: Spatial arbitrage requires at least two independent DEXs sharing liquid trading pairs. On Polygon, Uniswap v3 (concentrated liquidity) and QuickSwap (Algebra/v2/v3 concentrated) represent the dominant liquidity share.
- **Decision**: Target Uniswap v3 and QuickSwap for initial pool state tracking and two-hop arbitrage cycles.
- **Consequences**: Scanner and simulator must support both constant product and concentrated liquidity tick math models. Subject to validation in Phase 1.

---

### DEC-010: Tiered Wallet Lifecycle: Early Development Wallet and Deferred Production Wallet
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Clear operational boundaries are necessary to govern when and how blockchain wallets are introduced. If development/testnet experimentation has no authorized wallet mechanism, local scripts are blocked; conversely, creating or funding production wallets prematurely introduces capital security risks.
- **Decision**: Formally establish a strict two-stage wallet lifecycle:
  1. **Development Wallet**: May be created during Phase 0 or early Phase 1. Used strictly and exclusively for local development, setup scripts, and public testnet testing. It must never hold meaningful real-world funds. Private keys and seed phrases must never be committed to Git, pasted into AI tools or prompts, or stored in source code.
  2. **Production Wallet**: Must remain strictly deferred until the production/mainnet preparation stage (Phase 7/Phase 8). It must be a newly generated, dedicated SAHIKARA wallet completely isolated from the operator's personal wallet, and funded only with authorized capital (capped at ₹100 for Phase 8).
- **Consequences**: Allows early developer tooling setup in Phase 0/1 under strict zero-capital and secret-handling rules, while ensuring production wallet generation and live funds remain locked until Phase 7/8.
