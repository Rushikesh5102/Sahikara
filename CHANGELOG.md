# CHANGELOG.md — Project Modification History

All notable changes to the SAHIKARA project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Phase 1: Market and DEX research on Polygon POS.
- Establishment of development runtime environments (Node.js/Foundry/Python).

---

## [0.0.2] - 2026-09-12

### Changed
- **Wallet Lifecycle Architecture & Security Policy Clarification**:
  - Formalized two-stage wallet lifecycle distinguishing between early development wallets and deferred production wallets.
  - Specified Development Wallet policy: eligible for creation in Phase 0 / early Phase 1 for development/testnet experimentation only; strictly zero meaningful funds; private keys/seeds must never be committed to Git, pasted into AI tools, or stored in source code.
  - Specified Production Wallet policy: creation and funding strictly deferred to production/mainnet preparation (Phase 7/Phase 8); dedicated SAHIKARA wallet completely isolated from operator's personal wallet.
  - Updated `PROJECT_RULES.md` (Rule 2 and Rule 4).
  - Updated `SECURITY.md` (Section 2.1 3-Tier Wallet Lifecycle).
  - Updated `MASTER_PLAN.md` (Phase 0, 1, 7, and 8 gating specifications).
  - Updated `PROJECT_STATE.md` (Executive Summary and Operational Safety Metrics).
  - Added `DEC-010` to `DECISIONS.md` (Approved).

---

## [0.0.1] - 2026-09-12

### Added
- **Repository & Project Brain Initialization (PHASE 0)**:
  - Created `.gitignore` with strict rules blocking environment variables, secrets, private keys, build artifacts, and dependency directories.
  - Created `README.md` defining project identity, current status, architecture direction, roadmap overview, and security directives.
  - Created `AGENTS.md` outlining mandatory operating procedures, verification checklists, and strict behavioral boundaries for AI and human contributors.
  - Created `PROJECT_STATE.md` recording Phase 0 status, ₹0 deployed capital, live trading lock, and milestone checklist.
  - Created `PROJECT_RULES.md` documenting the 18 non-negotiable engineering, security, and capital control principles.
  - Created `MASTER_PLAN.md` establishing the 11-phase development roadmap (Phase 0 to Phase 10) with detailed entry/exit criteria and risk models.
  - Created `PROJECT_OPERATING_MODEL.md` specifying collaboration workflows between Human Operator, ChatGPT Project Architect, Antigravity Dev Agent, and Independent Reviewers.
  - Created `PROJECT_MEMORY_ARCHITECTURE.md` establishing the repository-as-canonical-memory standard and knowledge tiers.
  - Created `ARCHITECTURE.md` specifying the target modular system topology (Scanner, Simulator, Risk Gate, Contracts, Executor, Telemetry) in Phase 0 design state.
  - Created `STRATEGY.md` formalizing the spatial cross-DEX arbitrage model, friction decomposition (fees, slippage, gas, risk), and net profit formula.
  - Created `SECURITY.md` defining multi-tier wallet isolation, zero-secret hygiene, smart contract verification standards, and emergency incident runbooks.
  - Created `RISK_POLICY.md` establishing provisional trading boundaries (max trade size, slippage, daily loss, consecutive failures) and circuit breaker mechanics.
  - Created `DECISIONS.md` establishing Architecture Decision Records DEC-001 through DEC-007 (Approved) and DEC-008 through DEC-009 (Provisional).
  - Created `EXPERIMENTS.md` providing standard empirical hypothesis testing templates.
  - Created `LESSONS_LEARNED.md` providing failure analysis, post-mortem, and corrective action logging structures.
  - Created `TRANSPARENCY_POLICY.md` mandating disclosure of all failed transactions, negative yields, bugs, and model errors.
  - Created `ONBOARDING_AN_AGENT.md` defining the 10-step onboarding sequence for newly initialized agents.
- **Directory Layout Setup**:
  - Initialized functional directories with `.gitkeep` files: `contracts/`, `scanner/`, `simulator/`, `executor/`, `dashboard/`, `tests/`, `scripts/`, `infrastructure/`.
  - Initialized domain-specific documentation directories: `docs/`, `docs/strategy/`, `docs/architecture/`, `docs/security/`, `docs/infrastructure/`, `docs/deployment/`, `docs/testing/`, `docs/operations/`, `docs/legal/`, `docs/finance/`.
