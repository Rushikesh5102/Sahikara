# CHANGELOG.md — Project Modification History

All notable changes to the SAHIKARA project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Phase 1D: 72h+ empirical data collection via live Base RPC (READY — awaiting operator start command)
- Spread distribution analysis and EXPERIMENTS.md update
- Aerodrome Slipstream adapter completion (pending SlipstreamQuoterV2 address confirmation)

---

## [0.2.5] - 2026-09-14

### Added — Phase 1D: Final Pre-Run Audit
- **SQLite-Safe Online Backup**: Created `scanner/src/backup.ts` and `npm run backup` script using SQLite's native `VACUUM INTO '<destination>'`. Replaced unsafe raw `Copy-Item` in [`docs/operations/PHASE_1D_RUNBOOK.md`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/docs/operations/PHASE_1D_RUNBOOK.md). Tested and verified consistent point-in-time snapshot creation, separate `PRAGMA integrity_check` validation, identical table schema/row counts, and zero interruption to live WAL writer.
- **Idempotency & Uniqueness Enforced**: Removed `timestamp` from `observation_id` (`[chain, routeId, tradeSizeUsd, blockNumber].join(':')`), treating observation timestamp purely as observational data. Created unique index `idx_rt_logical_unique ON round_trip_observations (route, amount_in, block_number)` with `INSERT OR IGNORE` semantics. Preserves distinct trade sizes, routes, and blocks while eliminating accidental timestamp-drift duplicates.
- **Duplicate-Integrity Check**: Added `checkDuplicateIntegrity()` to `ObservationStore` and wired into `npm run health`. Audited existing database: 0 duplicate one-way observations and 0 duplicate round-trip observations detected.
- **Error Accounting Clarified**: Investigated 30 recorded error rows in SQLite database; confirmed all 30 occurred during early Phase 1C protocol setup (block `51246778` rate limits and `51249578` malformed quoter address). Preserved all 30 historical records intact. Refactored health reporting to distinguish `recentErrors` (last 1h) from `historicalErrors` (all-time), ensuring current collector health is transparently displayed.
- **Deterministic Storage Tests**: Added unit tests in `tests/storage.test.ts` covering duplicate insertion prevention, same block with modified timestamp deduplication, distinct block/size/route persistence, and backup snapshot validation (suite total: 99/99 passing tests).
- **Controlled Short Validation**: Executed 2-cycle live Base validation (blocks `51271134` & `51271139`), verifying advancing blocks, advancing timestamps, row count increases, 0 errors, 0 duplicates, clean shutdown, and restart capability.
- **Official 72-Hour Data Collection Started**: Following operator authorization, an initial verified snapshot backup was created (`observations_backup_2026-09-13T20-55-04-848Z.db`, integrity: `ok`), and the official continuous 72-hour empirical market data collector was launched in background daemon mode on Base mainnet. Target completion: 2026-09-17 02:25:11 IST.
- **72-Hour Run Status**: **OFFICIAL 72-HOUR COLLECTION: RUNNING**.

---

## [0.2.4] - 2026-09-14

### Added — Phase 1D: Execution Runbook & Collector Hardening
- **Phase 1D Execution Runbook**: Created [`docs/operations/PHASE_1D_RUNBOOK.md`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/docs/operations/PHASE_1D_RUNBOOK.md) documenting start, graceful stop (`SIGINT`/`SIGTERM`), background execution (PowerShell / nohup), crash recovery, SQLite WAL management, storage growth estimates (~105 MB for 72h), and backup procedures.
- **Collector Hardening**: Added bounded exponential retry backoff and a 10-consecutive-cycle failure circuit breaker in `MarketObserver.ts` to prevent infinite failure looping.
- **Operator Health Check Tool**: Created `scanner/src/health.ts` and `npm run health` command providing read-only inspection of database size, last block processed, last timestamp, observation age, and observation counts without exposing credentials.
- **Short Controlled Validation**: Executed 2-cycle validation against live Base mainnet (blocks `51270834` & `51270839`), confirming advancing blocks, advancing timestamps, clean database insertion, zero duplicated records, and clean process exit.
- **Documentation Refined**: Corrected economic wording in Phase 1C.2.1 notes to accurately characterize executable round-trip friction without misleading fee-spread decomposition claims.
- **72-Hour Run Status**: Prepared and validated — **72-HOUR COLLECTION NOT YET STARTED**.

---

## [0.2.3] - 2026-09-14

### Changed — Phase 1C.2.1: Final Economic Correctness Audit
- **Zero Double-Counted Fees**: Audited `roundTripEvaluator.ts`, confirming that `QuoterV2.quoteExactInputSingle` and `Pool.getAmountOut` already return swap outputs net of pool fees. Removed redundant gating check (`grossProfitUsd <= poolFeesUsd`) that required overcoming fees twice. Gross PnL is strictly `finalAmountOut - initialAmountIn`, and net expected PnL is `grossRoundTripPnL - gasCost - riskBuffer`.
- **Fee Metadata Recording**: Added separate informational fee tracking: `leg1FeeBps`, `leg2FeeBps`, `leg1FeeAmount`, `leg2FeeAmount`.
- **Deterministic Fee Test**: Added unit test in `tests/roundTrip.test.ts` verifying mathematically that pool fees are not subtracted twice and net profit equals gross profit minus gas cost minus risk buffer. (Suite total: 93/93 tests passing).
- **Safe Schema Migration**: Updated `ObservationStore.ts` with idempotent `ALTER TABLE` statements adding `leg1_fee_bps`, `leg2_fee_bps`, `leg1_fee_amount`, and `leg2_fee_amount` to `round_trip_observations`. Preserves existing observations completely.
- **Block Integrity Validated**: Investigated block discrepancy (`35649980` from historical mock context vs live RPC head `51270xxx`). Verified that live `RpcDataSource.getLatestBlock()` queries live Base head (~51.27M) directly and timestamps/block numbers/quotes belong to the same observation cycle.
- **Core Token Economics Decoupled from Valuation**: Core arbitrage calculations are executed natively in token units (`initialAmount`, `finalAmount`, `grossRoundTripDiff`, `grossSpreadBps`). Fixed test sizing prices ($2400/WETH) are explicitly designated as `[TEST FIXTURE]`.
- **Gas Classification Enforced**: All gas values classified into `[ESTIMATE]` and `[PROVISIONAL]`.
- **Live Base Mainnet Validation**: Validated Route A and Route B for $1, $5, $10 on live Base block `51270548` (gross round-trip returns of -31.3 bps to -38.7 bps, net PnL of -45.0 bps to -86.1 bps after gas and risk buffer). The executable round-trip output already incorporates quoted swap mechanics; the observed cross-DEX price differential was insufficient to overcome combined friction during the observation. Zero candidates reported, strictly adhering to economic truth.

---

## [0.2.2] - 2026-09-14

### Changed — Phase 1C.2: Economic Quote Correctness & Cross-DEX Round-Trip Evaluation
- **Terminology Purged**: Eliminated all instances of labeling one-way token conversions as "arbitrage profit", "net profit", or "arbitrage candidate". Replaced with "one-way quote", "executable output", "implied price", "price impact", and "theoretical conversion".
- **Cross-DEX Round-Trip Quoting Engine**: Implemented `RoundTripEvaluator.ts` evaluating closed-loop cycles starting and ending in the same asset:
  - Route A: `WETH -> Uniswap v3 -> USDC -> Aerodrome -> WETH`
  - Route B: `WETH -> Aerodrome -> USDC -> Uniswap v3 -> WETH`
- **Bidirectional Adapters**: Extended `IPoolAdapter` with `getDirectionalQuote()`; upgraded `UniswapV3Adapter` and `AerodromeAdapter` to quote either token direction dynamically on-chain via `eth_call`.
- **Provisional Gas Explicitly Marked**: Ensured all gas estimates carry `[ESTIMATE]` and `[PROVISIONAL]` tags and model 2-hop execution (~260,000 gas units).
- **Persistent Storage Extended**: Added `round_trip_observations` table in SQLite (`ObservationStore.ts`) storing all 26 round-trip parameters (legs, pools, amounts, fees, gas, net return, latency, rejection reason) without overwriting history.
- **Build Scripts Corrected**: Added `tsconfig.build.json` compiling TypeScript to `dist/`. Updated `npm run typecheck` to execute `tsc --noEmit` and `npm run build` to execute `tsc --project tsconfig.build.json`.
- **Unit Tests Added**: Created `tests/roundTrip.test.ts` with 8 deterministic tests covering one-way quote ≠ arbitrage profit, two-leg fee calculations, 2-hop gas deductions, net profit BPS, negative-profit rejection, threshold rejection, route reversal, zero/invalid amounts, and price-impact rejection. (Suite total: 92/92 tests passing).
- **Live Base Validation**: Executed live read-only validation against Base mainnet for $1, $5, and $10 sizes across both routes. Reported honest negative returns due to fee drag (35 bps pool fees exceeding quiescent spread).

### Changed — Phase 1C.1: Protocol Configuration & Contract Verification
- **Uniswap v3 QuoterV2 Canonical Address**: Fixed malformed 39-character provisional address to verified canonical address `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` (16,548 bytes bytecode; factory matches `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`).
- **Uniswap v3 Pool Discovery**: Verified all pools on-chain via `UniswapV3Factory.getPool()`:
  - WETH/USDC (500): `0xd0b53D9277642d899DF5C87A3966A349A798F224`
  - USDC/USDbC (100): `0x06959273E9A65433De71F5A452D529544E07dDD0`
  - WETH/cbBTC (500): Replaced invalid provisional address `0x3c0ece5...` with discovered canonical pool `0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1`.
- **Aerodrome Fee Architecture Correction**: Corrected `AerodromeAdapter` to query dynamic fees via `Factory.getFee(poolAddress, stable)` rather than calling nonexistent `pool.fee()`.
- **Aerodrome Pool & Factory Verification**:
  - PoolFactory verified on-chain: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` (7,034 bytes bytecode).
  - WETH/USDC volatile pool verified: `0xcDAC0d6c6C59727a65F871236188350531885C43` (fee: 30 bps).
  - USDC/USDbC stable pool verified: `0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD` (fee: 5 bps).
- **Token Verification**: Verified bytecode, symbols, and decimals on Base for WETH (18), USDC (6), USDbC (6), DAI (18), cbBTC (8), and AERO (18).
- **Added Tests**: Created `scanner/tests/protocolVerification.test.ts` with 10 comprehensive tests covering address format validation, zero-address rejection, missing bytecode rejection, token mismatch rejection, wrong pool type rejection, factory discovery, Aerodrome fee lookup, native quoting paths, and quoter ABI validation. (Test suite: 84/84 tests passing).

## [0.2.0] - 2026-09-13

### Fixed
- Replaced shorthand `npm` script paths with explicit `node` binary invocations to prevent Windows `cmd.exe` from splitting on `&` in the repository path.
- Resolved ESLint warnings in `sqlite-shim.ts` (unused disable directive) and `storage.test.ts` (missing return type).
- Cleared leaked developer RPC credential from `.env.example` to satisfy security tests.

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
