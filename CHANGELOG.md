# CHANGELOG.md — Project Modification History

All notable changes to the SAHIKARA project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Phase 5: Atomic Arbitrage Smart Contract Development (`ArbitrageExecutor.sol`)
- Phase 6: Public Testnet Deployment & Automated Testing

## [0.7.3] - 2026-09-16

### Added / Completed — Phase 4.6.1: Multi-Chain Empirical Discovery Campaign
- **Campaign Execution across 4 EVM Networks (`scripts/run-phase4-6-campaign.ts`)**:
  - Executed read-only empirical campaign `PHASE_4_6_1_1789554343658` across Base (8453), Polygon (137), Arbitrum One (42161), and Optimism (10).
  - Evaluated 9 standardized trade tiers ($1, $5, $10, $25, $50, $100, $250, $500, $1,000) using integer math and token decimals.
  - Quoted 1,548 total attempts: 1,070 valid executable quotes, 478 failed quotes (exclusively Base volatile pairs at extreme sizes).
  - 100% valid quotes achieved on Polygon (270/270), Arbitrum One (252/252), and Optimism (270/270).
- **Multi-Chain QuoterV2 Dynamic Resolution (`adapters/UniswapV3Adapter.ts`)**:
  - Dynamically routes QuoterV2 calls based on chain: non-Base chains (Polygon 137, Arbitrum 42161, Optimism 10) use canonical `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`; Base (8453) uses canonical `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`.
- **Performance & RPC Hardening (`adapters/UniswapV3Adapter.ts`, `scripts/run-phase4-6-campaign.ts`)**:
  - Added block-pinned in-memory cache `poolStateCache` for `slot0` and `liquidity` within `UniswapV3Adapter.ts`, safely eliminating 18 redundant RPC calls per route evaluation.
  - Prioritized routed pool events over unrouted pairs, ensuring complete 9-size route sweeps are evaluated on state changes without RPC timeout contention.
- **Strict Database Isolation (`data/observations_phase46.db`)**:
  - Persisted all multi-chain campaign observations exclusively to `data/observations_phase46.db`. Historical baseline database `data/observations.db` is 100% untouched and unmodified.
- **Empirical Market Telemetry & Analysis (`docs/strategy/PHASE_4_6_1_EMPIRICAL_RESULTS.md`)**:
  - Recorded 0 positive gross spreads (0.00%) and 0 positive net expected PnL (0.00%) across all 1,070 valid quotes. All classified as TIER 0.
  - Median gross spread: Base -32.32 bps, Polygon -10.00 bps, Arbitrum -10.00 bps, Optimism -10.00 bps.
  - Median net spread: Base -33.45 bps, Polygon -18.00 bps, Arbitrum -13.00 bps, Optimism -13.00 bps.
  - Verified 0 closed 3-hop triangular cycles due to star graph pool topology around WETH/USDC.
  - Verified SQLite database integrity (`PRAGMA integrity_check` = `ok`) and statistical distribution calculation reproducibility (100% bit-for-bit match across duplicate runs).
  - Maintained virtual shadow paper ledger at $100.00 cash start -> $100.00 end (0 trades executed).
- **Security Invariant**:
  - ₹0.00 capital at risk. Zero private keys, zero signers, zero wallet instantiation, zero transaction broadcasts, zero contract deployments. Execution engine strictly LOCKED.
- **Governance**:
  - Recorded Decision `DEC-029` in `DECISIONS.md`.

## [0.7.2] - 2026-09-16

### Changed — Phase 4.6.0.1: Canonical Pool Registry Reconciliation & Re-Verification
- **Canonical Pool Replacements (`config/pools-polygon.ts`, `config/pools-optimism.ts`)**:
  - Activated 4 independently verified canonical pools:
    - Polygon native WETH/USDC 500: `0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9` (`[FACT]`)
    - Polygon native WETH/USDC 3000: `0x19C5505638383337D2972Ce68B493aD78E315147` (`[FACT]`)
    - Polygon WETH/USDT 500: `0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4` (`[FACT]`)
    - Optimism WETH/USDC.e 3000: `0xB589969D38CE76D3d7AA319De7133bC9755fD840` (`[FACT]`)
  - Preserved historical disabled pools as disabled entries with audit notes (zero deletion of evidence):
    - `univ3-polygon-weth-usdc-500-historical-disabled` (`0x45dDa...`)
    - `univ3-polygon-weth-usdc-3000-historical-disabled` (`0x1673...`)
    - `univ3-polygon-weth-usdt-500-historical-disabled` (`0x4CcD...`)
    - `univ3-optimism-weth-usdc-3000-historical-disabled` (`0x1C31...`)
  - Preserved Optimism WETH/USDC 500 (`0x1fb3...`) token ordering correction: `token0: USDC`, `token1: WETH`.
- **Token & Pool Truth-Tier Upgrades**:
  - Upgraded all active tokens and pools on Polygon, Arbitrum One, and Optimism to truth-tier `[FACT]`.
  - Preserved `[PROVISIONAL]` tag strictly on the 4 disabled historical pools.
- **Comprehensive Smoke Testing**:
  - Executed 30/30 bidirectional smoke quotes across all 15 active non-Base pools via QuoterV2 (100% SUCCESS, 0 failures, 224–422 ms latency).
- **Regression Test Suite (`tests/phase46MultiChain.test.ts`)**:
  - Added regression tests verifying active canonical pools, disabled historical pools, zero duplicate active addresses, strict numerical token ordering (`token0 < token1`), accurate fee tiers, and exclusion of disabled pools.
  - Test suite expanded to **226/226 tests passing across 17 suites (100%)**.
- **Documentation & Reporting**:
  - Produced `docs/strategy/PHASE_4_6_0_1_REGISTRY_RECONCILIATION.md` and recorded Decision `DEC-028`.
- **Security Invariant**:
  - Capital at risk: Strictly ₹0.00 / $0.00. Zero private keys, zero transaction signing or broadcasting. Execution engine remains strictly LOCKED.

## [0.7.1] - 2026-09-16

### Verified — Phase 4.6.0: Pre-Campaign On-Chain Registry Verification
- **Token Registry On-Chain Verification (`docs/strategy/PHASE_4_6_0_REGISTRY_VERIFICATION.md`)**:
  - Inspected 17/17 non-Base tokens across Polygon (137), Arbitrum One (42161), and Optimism (10) via read-only RPCs (`eth_getCode`, `symbol()`, `decimals()`).
  - 100% PASS (17/17) with valid bytecode, expected symbols, and matching decimals. Upgraded to `[FACT]`.
- **Infrastructure Verification**:
  - Verified canonical Uniswap v3 Factory (`0x1F98431c8aD98523631AE4a59f267346ea31F984`) and QuoterV2 (`0x61fFE014bA17989E743c5F6cB21bF9697530B21e`) deployments across all 3 chains (6/6 contracts verified, 100% PASS).
- **Pool Verification & Anomaly Containment (`config/pools-*.ts`)**:
  - Inspected 15 non-Base Uniswap v3 pools via `token0()`, `token1()`, `fee()`, `tickSpacing()`, `factory()`, and `liquidity()`.
  - 11/15 pools verified active with in-range liquidity and matching factory provenance; upgraded to `[FACT]`.
  - 4 pools identified with address or fee mismatches and disabled per Section 7 Provisional Registry Rule (evidence preserved, zero silent changes):
    - `univ3-polygon-weth-usdc-500`: Actually WETH / USDC.e bridged; disabled (`status: 'disabled'`).
    - `univ3-polygon-weth-usdc-3000`: Actually WMATIC / WETH 3000; disabled (`status: 'disabled'`).
    - `univ3-polygon-weth-usdt-500`: Actually 30 bps fee tier; disabled (`status: 'disabled'`).
    - `univ3-optimism-weth-usdc-3000`: Actually OP / USDC.e 3000; disabled (`status: 'disabled'`).
  - 1 token ordering corrected: `univ3-optimism-weth-usdc-500` token order inverted relative to numeric sort; corrected (`token0: USDC`, `token1: WETH`) and upgraded to `[FACT]`.
- **Bidirectional Smoke Quote Testing**:
  - Executed 22 live read-only quotes across all 11 active pools via QuoterV2 in both directions.
  - 22/22 succeeded (100% SUCCESS, 0 failures, 153–451 ms latency). Zero fake spread conversions.
- **Documentation & Reporting**:
  - Generated comprehensive verification dossier `docs/strategy/PHASE_4_6_0_REGISTRY_VERIFICATION.md` capturing all raw telemetry, tables, and root-cause analyses.
  - Recorded Decision `DEC-027` in `DECISIONS.md`.
- **Security Invariant**:
  - Capital at risk: Strictly ₹0.00 / $0.00. Zero private keys, zero signing code, zero broadcasts. Execution engine remains strictly LOCKED.

## [0.7.0] - 2026-09-16

### Added — Phase 4.6: Multi-Market / Multi-Chain Discovery & Empirical Validation
- **Multi-Chain Type Extension (`config/pools.ts`)**:
  - Extended `SupportedChain` union from `'base'` to `'base' | 'polygon' | 'arbitrum' | 'optimism'`.
  - Added optional `chainId?: number` to `PoolDefinition` for unambiguous chain-level routing while maintaining full backward-compatibility with existing test fixtures.
  - Added `CHAIN_IDS` mapping: `BASE: 8453, POLYGON: 137, ARBITRUM: 42161, OPTIMISM: 10`.
- **Dedicated Multi-Chain Pool Registries (`config/pools-*.ts`)**:
  - Polygon (137): `pools-polygon.ts` — WMATIC, WETH, native USDC, bridged USDC.e, USDT, DAI; Uniswap v3 500/3000 pools; all marked `[PROVISIONAL]`.
  - Arbitrum One (42161): `pools-arbitrum.ts` — WETH, native USDC, USDC.e, WBTC, USDT, ARB; Uniswap v3 500/3000 pools; all marked `[PROVISIONAL]`.
  - Optimism (10): `pools-optimism.ts` — WETH, native USDC, USDC.e, USDT, wstETH, OP; Uniswap v3 500/3000 pools; all marked `[PROVISIONAL]`.
  - Strict Registry Isolation: `ALL_ACTIVE_POOLS` and `ALL_POOLS` remain strictly Base-only (8453); multi-chain pools never leak into the Base pipeline.
- **Dedicated Multi-Chain Research Pair Registries (`config/pairs-*.ts`)**:
  - `pairs-polygon.ts`: WETH/USDC, WETH/USDC.e, WMATIC/USDC.e, WMATIC/WETH.
  - `pairs-arbitrum.ts`: WETH/USDC, WETH/USDC.e, WETH/USDT, WBTC/WETH.
  - `pairs-optimism.ts`: WETH/USDC, WETH/USDC.e, WETH/USDT, wstETH/WETH.
- **Chain-Specific Gas Models (`shadow/*GasModel.ts`)**:
  - `PolygonGasModel`: Sidechain architecture — `l1DataFeeUsd` is strictly $0.00; gas priced using operator-configured `maticPriceUsd` (default $0.80).
  - `ArbitrumGasModel`: Nitro architecture — execution gas priced in ETH + provisional flat L1 calldata fee ($0.003 USD) labeled `[PROVISIONAL]`.
  - Optimism: Reuses `BaseGasModel` reflecting shared OP Stack L2 execution and L1 calldata mechanism.
- **On-Chain Pool Bytecode Verification Gate (`config/pools.ts`)**:
  - Added `verifyPoolBytecode(poolAddress, publicClient): Promise<boolean>` calling read-only `eth_getCode`.
  - Confirms contract deployment (>= 4 bytes / >= 8 hex characters stripped) before any quote is issued. Undeployed or empty addresses are safely logged and skipped.
- **Multi-Chain Campaign Runner (`scripts/run-phase4-6-campaign.ts`)**:
  - Implemented sequential multi-chain execution (`PHASE_4_6_BASE`, `PHASE_4_6_OPTIMISM`, `PHASE_4_6_ARBITRUM`, `PHASE_4_6_POLYGON`).
  - Strict Database Isolation: Telemetry persisted to `data/observations_phase46.db` (configurable via `PHASE_4_6_DB_PATH`). Baseline `observations.db` is completely untouched.
  - Added npm script `"campaign:46"` in `package.json`.
- **EIP-55 Checksum Auditing & Compliance**:
  - Audited all pool and token addresses in new registries to guarantee strict EIP-55 checksum compliance, preventing client-side Viem address exceptions.
- **Comprehensive Multi-Chain Test Suite (`tests/phase46MultiChain.test.ts`)**:
  - Added 18 unit and integration tests covering chain ID routing, pool segregation, gas calculation formulas, bytecode verification, and checksum compliance.
  - Test suite expanded from 201 to **219/219 tests passing across 17 suites (100%)**.
- **Absolute Security Directives**:
  - Capital at risk: ₹0.00 / $0.00. Zero private keys, zero wallet clients, zero transaction signing or broadcasting. Execution engine remains strictly LOCKED.

## [0.6.1] - 2026-09-16

### Fixed — Phase 4.5.1: Forensic Correction & Data-Integrity Audit
- **EIP-55 Checksum Casing on VIRTUAL Token (`config/pools.ts`)**:
  - Corrected `BASE_TOKENS['VIRTUAL'].address` from unchecksummed lowercase `0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b` to canonical checksummed `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`.
  - Resolved client-side Viem address validation exception (`Address must match its checksum counterpart`) that triggered quote evaluation failure on VIRTUAL routes.
- **Quote Failure Invariant Enforcement (`economics/roundTripEvaluator.ts`)**:
  - Updated `buildFailedEvaluation()` so failed quotes return `grossSpreadBps: 0`, `netProfitBps: 0`, `grossProfitUsd: 0`, `netExpectedProfitUsd: 0`, `status: 'ERROR'`, and `classification: 'QUOTE_FAILED'`.
  - Permanently eliminated hardcoded `-10000 bps` fallback value.
- **Quote Failure Segregation (`shadow/RealTimeShadowEngine.ts`)**:
  - Added explicit `isFailedQuote` detection in `evaluateRoundTrip`.
  - Failed quotes increment `failedQuotes++` and `missedReport.rejectedByQuoterFailure++` and are strictly excluded from `statisticalRecords` and `tier0Count`.
- **Statistical Population Segregation (`shadow/StatisticalReporter.ts`)**:
  - Introduced `StatisticalPopulation` enum: `ALL_VALID_EXECUTABLE_QUOTES`, `ALL_ATTEMPTS`, and `ALL_REJECTIONS`.
  - Added population headers to markdown distribution tables.
  - Filtered statistical records so that empirical spread, gas, and latency distributions reflect solely valid, executable quotes.
- **SQLite Storage Metric Isolation (`storage/ObservationStore.ts`)**:
  - Updated `getPhase45Metrics()` to enforce `WHERE is_synthetic = 0` on candidate queries, guaranteeing zero synthetic contamination in live metrics.
- **Documentation & Scientific Claim Adjustments**:
  - Published comprehensive forensic dossier: `docs/strategy/PHASE_4_5_1_FORENSIC_CORRECTION.md`.
  - Recalculated true empirical distributions for Phase 4.5: $N=432$ valid executable quotes, gross spread min $-451.61\text{ bps}$, median $-55.98\text{ bps}$, max $-30.23\text{ bps}$; net spread min $-472.49\text{ bps}$, median $-85.41\text{ bps}$, max $-41.06\text{ bps}$.
  - Corrected overclaims: replaced "No opportunity existed" with evidence-bounded statements acknowledging unmonitored pools/routes/events.
  - Formally characterized latency ($p50 = 94.5\text{ ms}$) as internal event-to-decision latency, and clarified protocol families (2 families across 4 AMM venue implementations).
  - Clarified opportunity lifetime as `NOT OBSERVABLE / INSUFFICIENT SAMPLE` given $N=0$ positive opportunities.
  - Documented `aero-slipstream-weth-cbbtc-10` pool (`0x42d4...`) exhausted liquidity condition.
- **Regression Test Suite Expansion (`tests/forensicCorrection.test.ts`)**:
  - Added 7 dedicated forensic regression tests covering EIP-55 checksum, quote failure invariant, population separation, deterministic reporting, and $N=0$ handling.
  - Total test suite expanded to **201/201 tests passing across 16 suites (100%)**.
- **Security Invariant**: Capital at risk: ₹0.00 / $0.00. Zero private keys, zero signing, zero broadcasting, execution strictly LOCKED.

---

## [0.6.0] - 2026-09-16

### Added — Phase 4.5: Opportunity Discovery & Calibration Campaign
- **Multi-Pool Same-Pair Handling & Pool Identity Preservation (`config/pools.ts`)**:
  - Registered Uniswap v3 WETH/USDC 3000 pool (`0x6c561B446416E1A00E8E93E221854d6eA4171372`, 30 bps, on-chain liquidity $3.53 \times 10^{19}$) alongside 500 pool (`0xd0b53D9277642d899DF5C87A3966A349A798F224`).
  - Preserved unique pool identity via `poolAddress`, enabling both intra-DEX fee tier routes and cross-DEX routes without collapsing pools sharing identical token pairs.
- **5-Tier Opportunity Classification Hierarchy (`shadow/types.ts`, `OpportunityLifecycleManager.ts`)**:
  - Established formal tiering: `TIER_0` (no dislocation / negative spread), `TIER_1` (gross positive, fails economic hurdle), `TIER_2` (positive after pool fees, fails gas/slippage/latency), `TIER_3` (simulated net positive off-chain), `TIER_4` (persisted in next-block calibration $B \to B+1$).
- **Statistical Distribution Reporter (`shadow/StatisticalReporter.ts`)**:
  - Built comprehensive statistical calculation engine outputting $N$, min, p25, median, mean, p75, p90, p95, p99, and max across 8 dimensions: Gross Spread, Net Spread, Gas Cost, Trade Size, Latency, Opportunity Lifetime, Price Impact, and Next-Block Decay.
  - Implemented safe handling for $N=0$ and tiny-sample ($N < 30$) warnings.
  - Generates publication-grade Markdown distribution tables.
- **Zero Fake Win Rate Enforcement (`shadow/ShadowPortfolioLedger.ts`)**:
  - Updated `ShadowPortfolioState.winRatePercent` to `number | null`.
  - Enforced radical honesty rule: returns `null` / `'N/A'` when zero trades are filled, preventing false "0%" win rate claims.
- **Diagnostic Missed Opportunity & Infrastructure Failure Separation (`shadow/RealTimeShadowEngine.ts`)**:
  - Distinct counters for market equilibrium rejections vs technical infrastructure failures (RPC 429, timeouts, quoter reverts, WebSocket disconnects).
- **Phase 4.5 Health Telemetry CLI Command (`src/health.ts`, `storage/ObservationStore.ts`)**:
  - Added `store.getPhase45Metrics()` reporting last event block/timestamp, quote rates per minute, quote failure rate, tier counts, and live RPC latency ping.
- **Controlled Live Validation Campaign Runner (`scripts/run-phase4-5-campaign.ts`)**:
  - Added `npm run campaign:validate` script executing a controlled validation run on Base Mainnet.
  - Evaluated 18 real market events and 448 route opportunities across 8 trade sizes ($1 to $500).
  - Evaluated Base Mainnet equilibrium: 448/448 classified as TIER 0 (median gross spread: -56.30 bps), 0 false positives, 0 infrastructure failures, $100.00 cash preserved.
- **Comprehensive Test Suite Expansion (`tests/phase45Campaign.test.ts`)**:
  - Added 16 unit tests covering multi-pool routing, Tier 0–4 logic, trade size sweep, statistical reporting, synthetic isolation, and fee double-counting prevention.
  - Total test suite expanded to **194/194 tests passing across 15 suites (100%)**.
- **Documentation & Governance**:
  - Published comprehensive dossier: `docs/strategy/PHASE_4_5_OPPORTUNITY_DISCOVERY.md`.
  - Logged `DEC-024` in `DECISIONS.md`.
- **Security Invariant**: Capital at risk: ₹0.00 / $0.00. Zero private keys, zero signing, zero broadcasting, execution strictly LOCKED.

---

## [0.5.0] - 2026-09-16

### Added — Phase 4: Real-Time Shadow / Paper Execution Engine
- **Event-Driven Real-Time Orchestrator (`RealTimeShadowEngine.ts`)**:
  - Implemented continuous, strictly read-only execution pipeline coordinating event ingestion (`Swap`/`Sync`), selective re-quoting via Multicall3, simulation gating, paper portfolio bookkeeping, and next-block calibration.
- **Opportunity Lifecycle State Machine (`OpportunityLifecycleManager.ts`)**:
  - Established 8 explicit lifecycle states: `DETECTED`, `EVALUATED`, `SHADOW_SUBMITTED`, `INCLUDED`, `EXPIRED`, `MISSED`, `REJECTED`, `INVALIDATED`.
  - Implemented high-resolution monotonic timestamps (`performance.now()`) for microsecond-accurate latency measurements alongside audit-grade wall-clock timestamps.
  - Enforced 10-point False Positive Protection policy validating quotes, freshness, pools, liquidity, gas ceilings, slippage boundaries, latency thresholds, risk hurdles, and net profitability.
  - Classified 13 opportunity outcomes with zero ambiguous states.
- **Base OP Stack Gas Fee Decomposition (`BaseGasModel.ts`)**:
  - Modeled Base Layer 2 execution gas: $G_{\text{exec}} \times (f_{\text{base}} + f_{\text{priority}}) \times P_{\text{ETH}}$ (220,000 gas units, 0.05 Gwei priority tip).
  - Explicitly separated L1 rollup calldata fee ($0.002 [ESTIMATED]$ per 2-hop transaction).
  - Derived analytical break-even base fee $f_{\text{base}}^*$ preventing execution during fee spikes.
- **Next-Block Market Calibration Proxy (`NextBlockCalibrationEngine.ts`)**:
  - Evaluates subsequent blocks ($B \to B+1$) to compare predicted spread, gross profit, gas costs, and net PnL against empirical market evolution.
  - Computes spread decay error ($\Delta S_{\text{decay}}$) and tracks dislocation persistence without claiming actual transaction execution.
- **Virtual Paper Portfolio Ledger & Radical Ledger Partitioning (`ShadowPortfolioLedger.ts`)**:
  - Created paper trading ledger with $100.00 virtual capital (`[PAPER/SIMULATION]`).
  - Implemented exact revert loss economics: 100% principal recovery, 100% gas loss deduction.
  - Enforced physical ledger partitioning: `liveLedger` (exclusively live Base Mainnet quotes) vs `syntheticLedger` (synthetic test fixtures). Zero fake win rate guarantee.
- **Database Schema Migration Version 5 (`ObservationStore.ts`)**:
  - Created `shadow_opportunities` and `shadow_calibrations` tables with microsecond indices and foreign key references.
- **CLI Health & Diagnostics Command (`src/health.ts`)**:
  - Added real-time tracking for simulation counts, shadow trades, shadow opportunities, and calibrations.
- **Controlled Live Validation Suite (`scripts/run-phase4-shadow.ts`)**:
  - Executed 15 live event cycles across 26 verified routes on Base Mainnet (192 checks).
  - Evaluated next-block calibration on live blocks; verified synthetic calibration (+35 bps -> +28 bps decay).
  - Clean live portfolio result: 0 false positives, $100.00 cash preserved, 0.0% win rate.
- **Comprehensive Test Suite (`tests/shadowEngine.test.ts`)**:
  - Added 17 unit tests verifying lifecycle transitions, 10-point false positive protection, gas calculations, next-block calibration, revert economics, and ledger partitioning. Total repository test count expanded to **178/178 tests passing across 14 suites**.
- **Documentation & Governance**:
  - Published comprehensive engineering specification: `docs/strategy/PHASE_4_SHADOW_EXECUTION.md`.
  - Logged `DEC-023` in `DECISIONS.md`.
- **Security Invariant**: SAHIKARA execution remains strictly LOCKED. Zero private keys, zero signing, zero broadcasting, ₹0 capital deployed.

---

## [0.4.1] - 2026-09-16

### Audited & Rectified — Phase 3 Forensic Audit & Phase 4 Gate Review
- **Deterministic Simulation Identifiers (`AtomicExecutionSimulator.ts`)**:
  - Replaced non-deterministic `Date.now()` simulation ID suffixes with deterministic string templates: `sim_${routeId}_${blockNumber}_${initialAmount}_${timestampMs}`.
- **Dynamic Multi-Pair Token Metadata in Replay (`HistoricalReplaySimulator.ts`)**:
  - Introduced `resolveTokenMeta()` mapping token addresses/symbols to canonical decimals (USDC 6, cbBTC 8, WETH 18) and USD price anchors ($1.00 for stablecoins, dynamic/assumed for volatile assets).
  - Dynamically computes `tradeSizeUsd` from `amount_in` instead of assuming hardcoded 18 decimals and $10 fixed size.
- **On-Chain Quoter Sweep Connection (`run-phase3-simulation.ts`)**:
  - Connected real `UniswapV3Adapter` and `AerodromeSlipstreamAdapter` quoter instances to the trade-size sweep across all 8 tiers ($1 to $500), verifying convex price impact behavior on live Base Mainnet.
- **Explicit Provenance & Synthetic Fixture Demarcation**:
  - Prominently labeled Scenario A shadow paper trading (+35 bps artificial spread, +$0.2197 hypothetical PnL) as a `[SYNTHETIC TEST FIXTURE]` across code, console logs, and strategy docs (`PHASE_3_SIMULATION_ENGINE.md`). Confirmed that live WETH/USDC observations yielded -3.75 bps spread and 0 profitable candidates.
- **Test Suite Expansion (`scanner/tests/simulator.test.ts`)**:
  - Added unit test suite for `HistoricalReplaySimulator` testing multi-era observations, token decimal adaptations, and failure diagnosis distributions.
  - Added test coverage for `INSUFFICIENT_LIQUIDITY_LEG1` and `INSUFFICIENT_LIQUIDITY_LEG2`.
  - Added tests asserting deterministic simulation ID repeatability.
  - Full test suite expanded to **161/161 tests passing across 13 suites**.
- **Audit Documentation & Governance**:
  - Published comprehensive audit report: `docs/strategy/PHASE_3_FORENSIC_AUDIT.md` (Executive Result: PASS WITH CONDITIONS).
  - Logged `DEC-022` in `DECISIONS.md`.
  - Formulated strict Phase 4 entry criteria requiring human operator signoff.
- **Security Invariant**: SAHIKARA execution remains LOCKED. Zero private keys, zero wallet signing, zero transaction broadcasting, zero live trading. Capital deployed: ₹0 / $0.

---

## [0.4.0] - 2026-09-16

### Added — Phase 3: High-Fidelity Simulation & Fee Modeling Engine
- **Core Simulator Architecture (`scanner/src/simulator/`)**:
  - Built an off-chain execution-grade simulator evaluating whether detected cross-DEX opportunities survive realistic execution conditions.
  - **Explicit Provenance Tagging (`types.ts`)**: Every data field strictly categorized as `[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, or `[ASSUMPTION]`.
  - **Price Impact & Slippage Engine (`PriceImpactModel.ts`)**: Models Constant Product ($x \cdot y = k$) and concentrated liquidity price impact curves; calculates quoted slippage $S = (P_{\text{marginal}} - P_{\text{effective}}) / P_{\text{marginal}}$ and enforces strict tolerance ($S_{\text{max}} = 20\text{ bps}$).
  - **Gas Sensitivity Matrix Engine (`GasSensitivityEngine.ts`)**: Models multidimensional gas fee matrices across base fees ($0.01$ to $5.0\text{ Gwei}$) and gas units ($150\text{k}$ to $350\text{k}$); analytically derives deterministic break-even base fee.
  - **Latency Drift & Decay Model (`LatencyDriftModel.ts`)**: Evaluates adverse price drift over detection delay $\Delta t$ ($\Delta P_{\text{drift}}(\Delta t) = \alpha \cdot \sqrt{\Delta t}$); computes opportunity half-life $t_{1/2}$ and maximum viable inclusion latency.
  - **Atomic Two-Leg Contract Simulator (`AtomicExecutionSimulator.ts`)**: Replicates on-chain execution semantics of `ArbitrageExecutor.sol`:
    - Strict economic formula: $\Pi_{\text{net}} = Q_{\text{final}} - Q_{\text{in}} - C_{\text{gas}} - C_{\text{other}} - \rho_{\text{risk}}$.
    - **Zero double-counting**: Pool swap fees already embedded in executable quotes are never deducted twice.
    - **Revert economics**: 100% principal protection on revert; 100% gas cost loss on revert.
    - Classifies atomic failure modes: `SLIPPAGE_EXCEEDED_LEG1`, `SLIPPAGE_EXCEEDED_LEG2`, `NET_LOSS_REVERT`, `INSUFFICIENT_LIQUIDITY_LEG1`, `INSUFFICIENT_LIQUIDITY_LEG2`, `GAS_SPIKE_UNPROFITABLE`.
  - **Trade-Size Sweeper & Optimizer (`TradeSizeOptimizer.ts`)**:
    - Sweeps capital across $\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$ and research sizes up to liquidity limit.
    - Identifies optimal capital allocation $Q^*$ maximizing Net PnL.
    - Diagnoses dominant constraint: `FIXED_GAS_OVERHEAD` for small sizes, `SLIPPAGE_CONVEXITY` for large sizes, and `NEGATIVE_GROSS_SPREAD` for inverted venues.
  - **Shadow Paper Execution Engine (`ShadowExecutionEngine.ts`)**:
    - High-fidelity paper trading ledger maintaining simulated cash balance ($100 default).
    - Logs fill details, revert records, cumulative gas burned, and win/loss ratios without broadcasting transactions.
  - **Historical Replay Simulator (`HistoricalReplaySimulator.ts`)**:
    - Replays historical SQLite observations through the full simulation engine.
    - Produces granular failure diagnosis distributions and compares Polling-Era (Phases 1D–1F) vs Event-Driven-Era (Phase 2).
- **Storage Layer Migration (`ObservationStore.ts`)**:
  - Non-destructive schema migration to version `4`.
  - Added `simulated_executions` table for candidate persistence and full reconstruction.
  - Added `shadow_trades` table for paper trading ledger history.
- **Test Suite Expansion (`scanner/tests/simulator.test.ts`)**:
  - Added 14 unit tests covering slippage math, CPAMM, quoted slippage, gas sensitivity, latency decay, atomic reverts, trade size sweeps, paper trading, and replay determinism.
  - Total test suite expanded to **158/158 tests passing across 13 suites**.
- **Controlled Validation Runner (`scanner/scripts/run-phase3-simulation.ts`)**:
  - Added npm script `"simulate"`.
  - Executed controlled live validation on Base Mainnet: verified break-even gas (0.4045 Gwei), spread half-life (5,459 ms), atomic reverts, historical replay (200 records), and shadow paper trading ($100 -> $100.22).
- **Documentation & Governance**:
  - Created `simulator/README.md`.
  - Created `docs/strategy/PHASE_3_SIMULATION_ENGINE.md`.
  - Logged `DEC-021` in `DECISIONS.md`.
- **Security Invariant**: SAHIKARA execution remains LOCKED. Zero private keys, zero wallet signing, zero transaction broadcasting, zero live trading. Capital deployed: ₹0 / $0.

---

## [0.3.0] - 2026-09-16

### Added — Phase 2: Event-Driven Market Intelligence & Real-Time Opportunity Detection
- **WebSocket / Block Event Monitoring Engine (`MarketEventWatcher.ts`)**:
  - Subscribes to Base Mainnet WebSocket (`wss://`) log feeds with automatic HTTPS-to-WSS URL translation.
  - Heartbeat ping/pong health checks and bounded exponential backoff reconnection (1s → 2s → 4s → 10s) with seamless fallback to HTTP block log polling upon network partition.
  - Monitored event signatures across 16 verified Base pools: Uniswap V3 `Swap`, Aerodrome Slipstream `Swap`, PancakeSwap V3 `Swap`, Aerodrome Volatile/Stable `Swap` and `Sync`, and new block headers.
  - Fault tolerance protections: sliding-window LRU deduplication (10,000 entries of `txHash:logIndex`), stale block pruning (`blockNumber < highestBlockSeen - 2`), and intra-block ascending `logIndex` sorting.
  - End-to-end latency profiling: rolling calculation of min, p50 (median), p90, p99, and max detection latency.
- **Selective Route Dispatcher (`EventRouteDispatcher.ts`)**:
  - Inverted pool index (`Map<poolAddress, RoundTripRouteDef[]>`) mapping on-chain pool addresses directly to dependent routes.
  - Selectively re-quotes only affected routes upon pool state changes, replacing full 26-route sequential polling sweeps.
  - Block consistency pinning: explicitly locks both legs of multi-hop quotes to the triggering event's `blockNumber`, eliminating inter-leg block drift.
  - Real-time candidate persistence: records any candidate meeting provisional economic criteria into the `opportunity_candidates` SQLite table.
- **Persistent Opportunity Candidate Store (`ObservationStore.ts`)**:
  - Added `opportunity_candidates` table with non-destructive schema migration (version bumped to `3`).
  - Full post-hoc reconstruction support: stores pair, leg details, token in/out amounts, gross spread BPS, gas estimate, net profit, block number, and triggering event ID.
  - Zero modification to existing Phase 1 observations; historical integrity fully preserved.
- **Deterministic Historical Event Replay Engine (`EventReplayer.ts`)**:
  - Replays historical log sequences and synthetic market events through the identical detection, dispatch, and quote evaluation pipeline.
  - Verified 100% deterministic classification matching with 0 divergences across all evaluations.
- **Empirical Benchmark Comparison Engine (`BenchmarkComparison.ts`)**:
  - Executes side-by-side performance profiling between sequential polling and selective event-driven re-quoting.
  - Achieved **84.6% RPC call reduction** (24 calls vs 156 calls per update).
  - Achieved **93.1% faster response time** (3,353 ms vs 48,691 ms).
- **Controlled Event Validation Runner (`scripts/run-event-validation.ts`)**:
  - Added npm script `"validate:event"`.
  - Executed controlled live validation on Base Mainnet: captured live `SWAP` (Slipstream WETH/USDC) and `SYNC` (Aerodrome AERO/USDC) events.
  - Zero false duplicate events, zero stale blocks accepted.
- **Documentation & Decisions**:
  - Created `docs/strategy/PHASE_2_EVENT_DRIVEN_SCANNER.md`.
  - Created `docs/architecture/REAL_TIME_EVENT_INGESTION.md`.
  - Logged `DEC-020` in `DECISIONS.md`.
- **Testing & Verification**:
  - Added `tests/eventWatcher.test.ts` (6 unit tests covering event mapping, deduplication, stale block filtering, log sorting, and inverted index routing).
  - Full test suite: 144/144 tests passing across 12 suites.
  - Typecheck, ESLint, TypeScript build, and AST security scan (15/15 checks) all passed cleanly.
- **Security Invariant**: SAHIKARA execution remains LOCKED. Zero private keys, zero wallet signing, zero live trading. Capital deployed: ₹0 / $0.

---

## [0.2.8] - 2026-09-16

### Added — Phase 1F: Continuous Multi-Pair Market Discovery & Quote Validation
- **PancakeSwap V3 Quoter Resolution**: Identified root cause of `0x` reverts (misconfigured address with 0 code); deployed verified canonical `QuoterV2` (`0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`) and active WETH/USDC 5 bps pool (`0xB775272E537cc670C65DC852908aD47015244EaF`).
- **Aerodrome Slipstream Adapter Implementation**: Upgraded `AerodromeSlipstreamAdapter` from `NOT_READY` stub to fully functional read-only quoting adapter using verified MixedQuoterV3 (`0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555`) with `quoteExactInputSingleV3` and `int24 tickSpacing` parameterization.
- **Low-Fee Pool Architecture (71.4% Fee Reduction)**: Activated concentrated liquidity 5 bps pools across UniV3, Aero Slipstream, and PancakeSwap V3, slashing round-trip pool fee friction from 35 bps to 10 bps.
- **Multi-Pair Verified Universe**: Expanded to 7 high-conviction research pairs (`WETH/USDC`, `AERO/USDC`, `DEGEN/WETH`, `VIRTUAL/WETH`, `cbBTC/WETH`, `USDC/USDbC`, `wstETH/WETH`) across 16 on-chain verified pools on Base Mainnet.
- **Deterministic Opportunity Classifications**: Defined 8 mutually exclusive classifications in `IPoolAdapter.ts` and `roundTripEvaluator.ts`: `NO_OPPORTUNITY`, `SPREAD_TOO_SMALL`, `QUOTE_FAILED`, `INSUFFICIENT_LIQUIDITY`, `GAS_TOO_HIGH`, `SLIPPAGE_TOO_HIGH`, `RISK_REJECTED`, `POTENTIAL_CANDIDATE`.
- **Review Matrices**: Added methods in `MarketDiscoveryEngine.ts` to generate `PairMatrix`, `PairProfitabilityMatrix`, and `DexMatrix` along with gross and net BPS percentile distributions (min, p25, median, p75, p90, p95, p99, max).
- **Controlled Short Validation Runner**: Created `scanner/scripts/run-short-validation.ts` executing 5 cycles across 26 distinct routes with real-time logging, metrics aggregation, and duplicate verification.
- **Documentation**: Authored strategy dossiers:
  - `docs/strategy/PHASE_1F_CONTINUOUS_DISCOVERY.md`
  - `docs/strategy/POOL_VALIDATION.md`
  - `docs/strategy/OPPORTUNITY_CLASSIFICATION.md`
  - `docs/strategy/MARKET_UNIVERSE.md`
- **Testing**: 138/138 tests passing across 11 test suites.
- **Security**: SAHIKARA execution remains LOCKED. Zero private keys, zero wallet signing, zero live trading.

## [0.2.7] - 2026-09-16

### Added — Phase 1E: Multi-Pair / Multi-DEX Market Discovery + RPC Abstraction
- **Configurable Multi-Pair Universe**: Created `scanner/src/config/pairs.ts` registering research token pairs with verified on-chain addresses on Base: `WETH/USDC` (baseline active), `AERO/USDC`, `DEGEN/WETH`, and `VIRTUAL/WETH` (research candidates). Defined lifecycle statuses (`BASELINE_ACTIVE`, `RESEARCH_CANDIDATE`, `UNVERIFIED`).
- **Multi-DEX Pool Registry Expansion**: Extended `scanner/src/config/pools.ts` with PancakeSwap V3 (`pancakeswap-v3`), Aerodrome Stable (`aerodrome-stable`), and Aerodrome Slipstream (`aerodrome-slipstream`). Added deployment constants for PancakeSwap V3 QuoterV2 (`0x8553AA1615549A86882151784b329B017aA7c832`).
- **RPC Provider Abstraction Layer**: Built `IRpcProvider`, `RpcProvider`, and `RpcManager` in `scanner/src/rpc/`:
  - Primary/secondary provider routing with automatic failover.
  - Automatic URL credential and query-secret masking (`maskRpcUrl`).
  - Rolling latency percentiles (p50, p90, p99) over a 100-sample window.
  - Rate-limit (HTTP 429) detection and circuit breaker tripping after 5 consecutive failures.
  - Bounded exponential retry backoff (capped at 3 retries, maximum 2000ms backoff). Zero unbounded retry loops.
  - Strictly fail-safe; failed RPC operations record errors and never fabricate default data.
- **Multicall3 Contract Batching**: Implemented `Multicall3Batcher` calling canonical Multicall3 (`0xca11bde05977b3631167028862be2a173976ca11`) on Base with `allowFailure: true` per-call fault isolation and metrics tracking.
- **Deterministic 2-Hop Route Generator**: Built `RouteGenerator` in `scanner/src/discovery/RouteGenerator.ts` generating bidirectional distinct-venue cross-DEX routes without self-loops or combinatorial explosion (bounded by `maxRoutesPerPair`).
- **Granular Pool-Level Observation Identity**: Updated `ObservationStore.ts` with unique index `idx_rt_logical_pool_unique` on `(pool_leg1, pool_leg2, amount_in, block_number)`. Ensures different pools for the same pair or different fee tiers are never erroneously conflated or deduplicated.
- **DEX Adapters Added**:
  - `PancakeSwapV3Adapter`: Active executable quote adapter querying PancakeSwap V3 QuoterV2 via `eth_call`. Safely records `QUOTE_FAILED` upon contract reverts.
  - `AerodromeSlipstreamAdapter`: Explicit `NOT_READY` stub adhering to DEC-015; returns explicit error and never fabricates quotes.
- **Test Suite Expansion**: Added unit and integration tests across 5 new test files (totaling 133 tests, 100% passing):
  - `tests/rpcManager.test.ts`: URL masking, provider routing, failover, bounded backoff, metrics.
  - `tests/multicall.test.ts`: Empty array bypass, multi-contract batching, partial failure isolation.
  - `tests/poolRegistry.test.ts`: Protocol registration, adapter compatibility, PancakeSwap V3.
  - `tests/routeGenerator.test.ts`: Distinct venue filtering, adapter readiness check, forward/reverse generation.
  - `tests/deduplication.test.ts`: 5 explicit deduplication scenarios (identical deduplication, different pool preservation, different block preservation, different route preservation, different size preservation).
  - `tests/security.test.ts`: Scanned 25 TypeScript files, confirming zero private keys, signers, or dispatchers.
- **Documentation**: Authored strategy dossiers:
  - `docs/strategy/PHASE_1E_MARKET_DISCOVERY.md`
  - `docs/strategy/MULTI_PAIR_RESEARCH.md`
  - `docs/strategy/MULTI_DEX_RESEARCH.md`
  - `docs/infrastructure/RPC_ABSTRACTION.md`
  - `docs/infrastructure/MULTICALL3.md`
  - `docs/strategy/ROUTE_GENERATION.md`
- **Short Live Read-Only Validation**: Executed 3 full cycles against live Base mainnet (block `51357778`), evaluating 18 one-way quotes and 18 round-trips per cycle. Validated Uniswap V3, Aerodrome, PancakeSwap V3, Slipstream stub, RPC metrics, and SQLite WAL writes (0 duplicate errors, 0 corrupted pages).
- **Safety**: Execution strictly LOCKED. Zero transaction signing or wallet integration introduced. Capital deployed: ₹0 / $0.

---

## [0.2.6] - 2026-09-15

### Added — Phase 1D: Controlled Early Termination & Baseline Experiment Analysis
- **Controlled Baseline Experiment Conversion**: Converted early-interrupted Phase 1D 72-hour collection run (stopped at 30.83 active hours / block `51325513` due to host laptop restart/sleep) into a formal baseline experiment per project directives. Single-pair collection intentionally not restarted.
- **Verified SQLite-Safe Online Backup**: Created transactionally consistent online backup via `npm run backup` (`observations_backup_2026-09-15T18-42-52-589Z.db`, 54.18 MB) using SQLite's native `VACUUM INTO`. Verified 100% integrity (`PRAGMA integrity_check = ok`, `quick_check = ok`).
- **Data Integrity & Duplicate Audit**: Validated row counts (43,500 one-way quotes, 17,370 round-trips). Confirmed 0 logical duplicates across one-way `(pool, size, block)` and round-trip `(route, amountIn, block)` datasets.
- **Comprehensive Baseline Strategy Dossier**: Authored [`docs/strategy/PHASE_1D_BASELINE_RESULTS.md`](./docs/strategy/PHASE_1D_BASELINE_RESULTS.md) analyzing full statistical distributions:
  - Exact active timeline: `2026-09-13T19:56:34Z` to `2026-09-15T02:46:23Z` (30.83h, 55,491 blocks).
  - Round-trip evaluation breakdown: 17,370 rejected (100%), 0 candidates passed (0%), 0 runtime errors.
  - Positive gross observations: Exactly 0 out of 17,370 (all gross returns negative, max: -3.02 bps, median: -35.00 bps).
  - Net expected profit: Median -$0.02425 (-60.98 bps), Mean -$0.02774 (-61.22 bps), Max -$0.00505 (-16.79 bps).
  - Size comparison ($1 vs $5 vs $10): Confirmed gross spread invariance (~ -35 bps across sizes) and fixed L2 gas amortization (improving net returns from -82.4 bps at $1 to -48.7 bps at $10).
  - Primary cause established: Cumulative pool fee friction (35 bps: 5 bps UniV3 + 30 bps Aerodrome) coupled with high market efficiency on WETH/USDC major pair (MEV bots holding spread < 5 bps).
- **Canonical Scoped Conclusion Ratified**: Formalized finding: *"Under the tested Base WETH/USDC Aerodrome/Uniswap configuration, at the tested $1/$5/$10 research sizes and observed market conditions, no observations passed the configured candidate criteria."* Refrained from broad assertions that arbitrage is unviable.
- **Empirical & Decision Logs Updated**: Recorded [`EXP-001`](./EXPERIMENTS.md) in `EXPERIMENTS.md` and [`DEC-017`](./DECISIONS.md) in `DECISIONS.md`.
- **Scanner Extensibility & Next Phase Architecture**: Evaluated `scanner/` engine scalability for multi-pair (`cbBTC/USDC`, `AERO/USDC`, `DEGEN/WETH`), lower-fee pools (Aerodrome Slipstream, PancakeSwap V3), Multicall3 batch quoting, and multi-chain expansion (Base, Polygon, Arbitrum).
- **Safety State**: Live trading strictly DISABLED. ₹0 capital deployed.

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
