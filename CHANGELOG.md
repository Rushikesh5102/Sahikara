# CHANGELOG.md — Project Modification History

All notable changes to the SAHIKARA project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Phase 1D: 72h+ empirical data collection via live Base RPC
- On-chain pool address verification via factory contract queries
- Spread distribution analysis and EXPERIMENTS.md update
- Aerodrome Slipstream adapter completion (pending SlipstreamQuoterV2 address confirmation)

---

## [0.2.0] - 2026-09-13

### Added — Phase 1C: Read-Only Market Observation Engine

**scanner/ — TypeScript project (new)**
- `scanner/package.json` — TypeScript project manifest; dependencies: viem v2, @uniswap/v3-sdk, better-sqlite3, dotenv; devDeps: tsx, typescript, vitest, eslint
- `scanner/tsconfig.json` — Strict TypeScript config (ES2022, NodeNext module resolution)
- `scanner/.env.example` — Environment template with variable names only (no credentials)
- `scanner/eslint.config.mjs` — ESLint config with security rules banning privateKey, signTransaction, sendTransaction, createWalletClient, and all wallet patterns
- `scanner/vitest.config.ts` — Vitest test runner configuration

**Configuration Layer (new)**
- `scanner/src/config/config.ts` — Runtime config loader with strict validation; throws at startup on missing required vars; zero credential defaults
- `scanner/src/config/pools.ts` — Candidate pool registry with 6 Base mainnet pools (3 Uniswap v3, 3 Aerodrome), token definitions, cross-DEX research pairs; all addresses marked [PROVISIONAL]

**Abstract Interfaces (new)**
- `scanner/src/data-sources/IDataSource.ts` — Abstract data source interface (Flashblocks-ready)
- `scanner/src/data-sources/RpcDataSource.ts` — viem publicClient implementation (structurally read-only; no wallet/signer)
- `scanner/src/adapters/IPoolAdapter.ts` — Abstract pool adapter interface with RejectionReason taxonomy

**Protocol Adapters (new)**
- `scanner/src/adapters/UniswapV3Adapter.ts` — Uniswap v3 adapter using QuoterV2 via eth_call; reads slot0, liquidity, tick state; returns exact executable quotes [COMPLETE]
- `scanner/src/adapters/AerodromeAdapter.ts` — Aerodrome volatile (x·y=k) [COMPLETE] + stable (stableswap) [COMPLETE] + Slipstream [STUB — DEC-015]

**Economics Engine (new)**
- `scanner/src/economics/gasEstimator.ts` — Dynamic gas cost estimator using live baseFeePerGas; all outputs marked [ESTIMATE][PROVISIONAL]
- `scanner/src/economics/profitCalculator.ts` — Three-tier profit calculator: grossProfit / netProfitBeforeBuffer / netExpectedProfit; full rejection logic taxonomy; token decimal normalization utilities

**Storage (new)**
- `scanner/src/storage/ObservationStore.ts` — SQLite storage (better-sqlite3, WAL mode); deterministic observation IDs; schema v1 with 35-column observations table + schema_metadata table; enforces rejection reason on REJECTED records

**Orchestrator & CLI (new)**
- `scanner/src/observer/MarketObserver.ts` — Full polling loop orchestrator; formatted stdout reports; graceful shutdown
- `scanner/src/index.ts` — CLI entry point with startup validation and signal handling

**Tests (new)**
- `scanner/tests/economics.test.ts` — Unit tests: decimal normalization, gas calculation, 3-tier profit model, all rejection reasons, stale data detection, fee calculation
- `scanner/tests/adapters.test.ts` — Adapter tests: support() logic, mock-RPC error handling, zero-liquidity, zero-amountOut, stub pool behavior, pool registry integrity
- `scanner/tests/storage.test.ts` — Storage tests: schema creation, insert idempotency, rejection reason enforcement, multi-status stats, query accuracy
- `scanner/tests/security.test.ts` — Security tests: automated file scan for 10 banned patterns (signing/private-key), viem/accounts import check, .env.example credential check

**Documentation (new)**
- `docs/strategy/OBSERVATION_ENGINE.md` — Architecture, data flow, profit tiers, rejection taxonomy, assumptions, security invariants
- `docs/strategy/POOL_REGISTRY.md` — Pool registry rationale, address sources, provisional status, verification procedure, how to add pools
- `docs/strategy/QUOTE_ENGINE.md` — Quoting methodology per adapter, accuracy analysis, Slipstream stub explanation, Phase 2 improvements
- `docs/infrastructure/BASE_RPC_SETUP.md` — Step-by-step RPC configuration guide (Alchemy/QuickNode), env setup, rate limit management

### Changed
- `ARCHITECTURE.md` — Updated implementation status from "DESIGN ONLY (PHASE 0)" to "PHASE 1C PARTIAL IMPLEMENTATION"
- `PROJECT_STATE.md` — Updated current phase, status, blockers, milestone tracker, and current workstream
- `DECISIONS.md` — Added DEC-013 (viem), DEC-014 (QuoterV2 via eth_call), DEC-015 (Slipstream deferred), DEC-016 (SQLite)

---

## [0.1.0] - 2026-09-12

### Added
- **Phase 1A: Market & DEX Research Framework Initialization**:
  - Created `docs/strategy/PHASE_1_RESEARCH_PLAN.md` establishing the 9 analytical workstreams, 5-tier epistemological framework (`[FACT]`, `[ASSUMPTION]`, `[HYPOTHESIS]`, `[EXPERIMENTAL RESULT]`, `[DECISION]`), and Phase 1 exit criteria.
  - Created `docs/strategy/CHAIN_COMPARISON.md` profiling Polygon PoS, Base, Arbitrum One, OP Mainnet, and BNB Chain across gas, latency, finality, and MEV.
  - Created `docs/strategy/DEX_COMPARISON.md` analyzing Uniswap v3, QuickSwap (Algebra/v2), Aerodrome, SushiSwap, and Curve across AMM math, fee tiers, and quoting interfaces.
  - Created `docs/strategy/TOKEN_PAIR_RESEARCH.md` investigating USDC, USDT, WETH, WMATIC/POL, and WBTC pairs; identified WMATIC/USDC and WETH/USDC as primary candidates.
  - Created `docs/strategy/ARBITRAGE_ECONOMICS.md` modeling the complete Net Expected Profit equation, proving that ₹100 starting capital requires $>0.40\%$ gross spread on Base or $>0.80\%$ on Polygon, and requiring a $>67\%$ win rate to absorb revert costs.
  - Created `docs/strategy/LIQUIDITY_RESEARCH.md` investigating AMM reserve depth, concentrated liquidity virtual reserves, and the micro-capital zero-slippage asymmetry.
  - Created `docs/infrastructure/RPC_COMPARISON.md` benchmarking Alchemy, QuickNode, Infura, and Ankr for WebSocket stability, rate limits, and failover topologies.
  - Created `docs/security/MEV_AND_EXECUTION_RISKS.md` cataloging sandwich attacks, calldata copying, private relays (FastLane/Flashbots), and atomic contract defenses.
  - Created `docs/legal/PHASE_1_REGULATORY_RESEARCH.md` mapping Indian VDA tax provisions (Section 115BBH 30% tax, Section 194S 1% TDS), reporting mandates, and research caveats (research only, not legal advice).
  - Created `docs/strategy/RESEARCH_DATA_SOURCES.md` establishing the canonical primary source citation registry.

### Changed
- Updated `PROJECT_STATE.md`: Advanced phase to `PHASE 1 — Market & DEX Research` with status `Research framework initialized`.

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
