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

### DEC-008: Selection of Polygon PoS as Secondary Research EVM Chain
- **Status**: **PROVISIONAL (SECONDARY)**
- **Date**: 2026-09-12 (Updated: 2026-09-12)
- **Context**: Initially evaluated as the primary network due to low gas fees ($0.005–$0.02) and established Uniswap/QuickSwap liquidity. Subsequent market data review indicates Base currently commands higher DEX trading activity, superior stablecoin liquidity, and 200ms Flashblocks pre-confirmation infrastructure.
- **Decision**: Retain Polygon PoS as the **secondary** research environment. Do not discard Polygon research, as its public mempool and dual-DEX dynamics provide valuable comparative benchmarking.
- **Consequences**: Polygon remains actively researched and benchmarked in parallel, while primary engineering focus shifts to Base.

---

### DEC-009: Target Polygon DEX Candidates: Uniswap v3 & QuickSwap
- **Status**: **PROVISIONAL (POLYGON SECONDARY)**
- **Date**: 2026-09-12
- **Context**: Spatial arbitrage requires at least two independent DEXs sharing liquid trading pairs. On Polygon, Uniswap v3 (concentrated liquidity) and QuickSwap (Algebra/v2/v3 concentrated) represent the dominant liquidity share.
- **Decision**: Target Uniswap v3 and QuickSwap for secondary pool state tracking and two-hop arbitrage cycles on Polygon PoS.
- **Consequences**: Scanner and simulator specifications for Polygon support both constant product and concentrated liquidity tick math models.

---

### DEC-010: Selection of Base as Primary Provisional Phase-1 Execution Research Environment
- **Status**: **PROVISIONAL**
- **Date**: 2026-09-12
- **Context**: External market verification (DefiLlama, Base network metrics) establishes that Base currently exhibits materially higher DEX trading volume, deep Uniswap and Aerodrome liquidity, an expansive native USDC ecosystem, and 200ms Flashblocks pre-confirmation streaming infrastructure. These attributes make Base an exceptional engineering fit for low-latency opportunity detection.
- **Decision**: Formally designate **Base** as the **primary provisional** Phase-1 execution research environment.
- **Consequences**: Research dossiers, scanner architecture specs, and low-latency ingestion pipelines prioritize Base. This decision remains strictly PROVISIONAL until substantiated by empirical opportunity logs.

---

### DEC-011: Aerodrome ↔ Uniswap as First Provisional Base Cross-DEX Pair for Opportunity Research
- **Status**: **PROVISIONAL**
- **Date**: 2026-09-12
- **Context**: Two liquid, independent decentralized exchanges are required on Base to execute spatial arbitrage cycles. Aerodrome commands leading DEX volume (>50% market share on Base) alongside Uniswap v3's dominant global routing volume.
- **Decision**: Designate **Aerodrome ↔ Uniswap** as the first provisional Base cross-DEX protocol pair for opportunity research.
- **Consequences**: Research into quoting mechanisms, pool structures, and multi-hop execution on Base prioritizes Aerodrome (volatile, stable, and Slipstream pools) and Uniswap v3 (concentrated liquidity). Remans strictly PROVISIONAL until empirical spread data is collected.

---

### DEC-012: Tiered Wallet Lifecycle: Early Development Wallet and Deferred Production Wallet
- **Status**: **APPROVED**
- **Date**: 2026-09-12
- **Context**: Clear operational boundaries are necessary to govern when and how blockchain wallets are introduced. If development/testnet experimentation has no authorized wallet mechanism, local scripts are blocked; conversely, creating or funding production wallets prematurely introduces capital security risks.
- **Decision**: Formally establish a strict two-stage wallet lifecycle:
  1. **Development Wallet**: May be created during Phase 0 or early Phase 1. Used strictly and exclusively for local development, setup scripts, and public testnet testing. It must never hold meaningful real-world funds. Private keys and seed phrases must never be committed to Git, pasted into AI tools or prompts, or stored in source code.
  2. **Production Wallet**: Must remain strictly deferred until the production/mainnet preparation stage (Phase 7/Phase 8). It must be a newly generated, dedicated SAHIKARA wallet completely isolated from the operator's personal wallet, and funded only with authorized capital (capped at ₹100 for Phase 8).
- **Consequences**: Allows early developer tooling setup in Phase 0/1 under strict zero-capital and secret-handling rules, while ensuring production wallet generation and live funds remain locked until Phase 7/8.

---

### DEC-013: viem v2 as Sole EVM Client Library (Phase 1C+)
- **Status**: **APPROVED**
- **Date**: 2026-09-13
- **Context**: The observation engine requires an EVM JSON-RPC client for read-only on-chain calls. Multiple libraries exist: `ethers.js v6`, `viem v2`, and `web3.js`. A choice must be made to avoid dual-library confusion.
- **Options Considered**:
  1. `ethers.js v6` — mature, widespread, but requires opting out of signing; `JsonRpcProvider` still exposes signing pathways.
  2. `viem v2` — TypeScript-native, `createPublicClient` is structurally read-only with zero signing surface, actively maintained by wevm, used by Wagmi and most modern DeFi tooling.
  3. `web3.js v4` — declining ecosystem momentum; more verbose API.
- **Decision**: Use `viem v2` exclusively. `createPublicClient` makes it structurally impossible to sign or send transactions without explicitly importing `createWalletClient` from `viem/accounts` — which is banned by the ESLint config.
- **Consequences**: All EVM calls use `viem`. `ethers.js` and `web3.js` are not installed. The security test suite (`tests/security.test.ts`) verifies zero `viem/accounts` imports.

---

### DEC-014: Uniswap v3 QuoterV2 via eth_call for Phase 1C Quoting
- **Status**: **APPROVED**
- **Date**: 2026-09-13
- **Context**: Uniswap v3 produces "exact" quotes via either (a) off-chain tick math simulation, or (b) `QuoterV2.quoteExactInputSingle` via `eth_call`. Off-chain tick math requires maintaining full tick bitmap state in memory.
- **Options Considered**:
  1. Off-chain tick math — maximum latency efficiency; requires full pool state sync (Phase 2 concern).
  2. `QuoterV2` via `eth_call` — one additional RPC round-trip per pool per cycle; returns exact executable quote including all tick crossings; no local state required.
- **Decision**: Use `QuoterV2` via `eth_call` for Phase 1C. This is sufficient for research polling at 30-second intervals and produces exact executable quotes — not spot price approximations. Off-chain tick math is deferred to Phase 2.
- **Consequences**: Each Uniswap v3 observation costs ~1 RPC compute unit per pool per trade size. At 30-second polling with 3 pools × 3 trade sizes = 9 CU/cycle, well within Alchemy free tier.

---

### DEC-015: Aerodrome Slipstream Adapter Deferred (Stub)
- **Status**: **APPROVED**
- **Date**: 2026-09-13
- **Context**: Aerodrome Slipstream pools use Uniswap v3 concentrated liquidity tick math with a custom `SlipstreamQuoterV2` contract. Implementation requires confirmed contract address and ABI verification on Base mainnet.
- **Decision**: Aerodrome Slipstream adapter is marked as STUB in Phase 1C. The adapter returns `ADAPTER_STUB` rejection reason. Per spec: "If a protocol's quoting interface cannot yet be implemented correctly, DO NOT fake it."
- **Implementation Path**: When `SlipstreamQuoterV2` address is confirmed on Base mainnet, the adapter can be completed by reusing `UniswapV3Adapter` quoting logic with the Slipstream quoter address.
- **Consequences**: Slipstream pools are observed but produce `ERROR` status entries. All observations are stored with `reason_if_rejected = 'ADAPTER_STUB'`. No data is silently discarded.

---

### DEC-016: SQLite (better-sqlite3) for Phase 1C Observation Storage
- **Status**: **APPROVED**
- **Date**: 2026-09-13
- **Context**: Phase 1C requires durable local storage for observation data that: (a) requires no external database server, (b) supports complex queries for analysis, (c) is exportable to CSV/JSON for the Phase 3 simulator.
- **Options Considered**:
  1. Plain JSON/CSV files — simple but no indexing, no query capability, hard to deduplicate.
  2. SQLite with `better-sqlite3` — embedded, synchronous, schema-enforced, indexed, widely used, MIT licensed, actively maintained.
  3. PostgreSQL — overkill for local research; requires server process.
- **Decision**: SQLite via `better-sqlite3` with WAL mode enabled. Schema version tracked in `schema_metadata` table. Observation IDs are deterministic (chain+protocol+pool+size+block) for idempotent re-runs.
- **Consequences**: All observations are durable to disk. The SQLite file can be opened with standard `sqlite3` CLI or any BI tool. WAL mode allows concurrent reads while the observer writes. Schema v1 is Phase 1C; future migrations increment `schema_version`.

---

### DEC-017: Phase 1D Controlled Baseline Termination & Multi-Pair Market Discovery Recommendation
- **Status**: **APPROVED**
- **Date**: 2026-09-15
- **Context**: The Phase 1D continuous data collector was interrupted at 30.83 active hours (block 51325513) due to a host machine restart/sleep event. The dataset of 43,500 one-way quotes and 17,370 round trips on Base WETH/USDC (Uniswap V3 5 bps ↔ Aerodrome Volatile 30 bps) is completely intact, backed up, and verified.
- **Options Considered**:
  1. Restart the 72-hour collector from block 0 or block 51325513 for another 72 hours on the exact same pair and pools.
  2. Synthesize the existing 30.83-hour dataset into a controlled baseline experiment, freeze collection, and evaluate why 0 opportunities passed candidate criteria.
- **Decision**: Convert the existing dataset into a controlled baseline experiment. Do NOT restart the 72-hour run on the single WETH/USDC pair. The empirical data conclusively proves that with 35 bps cumulative pool fee friction against highly efficient MEV searchers on WETH/USDC, zero gross or net opportunities exist. Re-running the identical setup for another 41 hours would merely produce redundant negative observations without new scientific yield.
- **Consequences**: Phase 1D is formally marked as COMPLETE (BASELINE EXPERIMENT). All data is preserved and documented in `docs/strategy/PHASE_1D_BASELINE_RESULTS.md`. Engineering recommendation for the next phase focuses on multi-pair discovery (volatile alts, secondary majors) and fee-optimized pools (e.g. Uniswap V3 5 bps ↔ Aerodrome Slipstream 1–5 bps / PancakeSwap V3). Live trading remains strictly disabled.

---

### DEC-018: Multi-Pair / Multi-DEX Market Discovery Engine & RPC Provider Abstraction (Phase 1E)
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: In Phase 1D, the observer was hard-coded to WETH/USDC on Base across Uniswap V3 (5 bps) and Aerodrome Volatile (30 bps), relying on a monolithic RPC data source without provider failover, dynamic route generation, or pool-level observation uniqueness.
- **Options Considered**:
  1. Continue manual pair-by-pair script customization with monolithic RPC class.
  2. Implement modular RPC Provider Abstraction (`IRpcProvider`, `RpcManager`), dynamic 2-hop `RouteGenerator`, configurable universe registry (`pairs.ts`), Multicall3 batching, and granular pool-level database uniqueness.
- **Decision**: Implement Option 2. Decouple RPC providers behind `IRpcProvider` and `RpcManager` with automatic credential masking, bounded retries, latency histogram tracking, and circuit breaker. Introduce `RouteGenerator` for automated cross-DEX 2-hop path construction without combinatorial explosion. Enforce pool-level observation identity on `(pool_leg1, pool_leg2, amount_in, block_number)` to prevent collisions across multiple pools for the same pair.
- **Consequences**: Enables systematic exploration across multiple pairs (WETH/USDC, AERO/USDC, DEGEN/WETH, VIRTUAL/WETH) and DEXs (Uniswap V3, Aerodrome Volatile/Stable, PancakeSwap V3, Slipstream stub) without risking duplicate collisions or crashing from single RPC provider outages. System remains strictly read-only; execution remains LOCKED.

### DEC-019: Activation of Aerodrome Slipstream, Resolution of PancakeSwap V3 Quoter, and Low-Fee Pool Architecture
- **Status**: APPROVED
- **Date**: 2026-09-16
- **Context**: In Phase 1E, PancakeSwap V3 QuoterV2 calls returned `0x` reverts due to an uninitialized contract address, Aerodrome Slipstream remained an inactive `NOT_READY` stub, and the WETH/USDC baseline suffered from 35 bps fee friction (UniV3 5 bps + Aero Volatile 30 bps) resulting in 0 positive gross round-trips over 30.8 hours.
- **Options Considered**:
  1. Continue observing only classical AMM pools with 35–60 bps friction.
  2. Empirically verify canonical contracts on Base Mainnet: deploy PancakeSwap V3 QuoterV2 (`0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`) and active pool (`0xB775272E537cc670C65DC852908aD47015244EaF`), implement active Aerodrome Slipstream MixedQuoterV3 (`0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555`) with `tickSpacing` parameterization, establish 10 bps low-fee round-trip paths (UniV3 5 bps ↔ Aero Slipstream 5 bps ↔ PancakeSwap V3 5 bps), and expand universe to 7 high-conviction verified pairs across 16 pools.
- **Decision**: Implement Option 2. Slashed round-trip pool friction from 35 bps to 10 bps (a 71.4% reduction in swap friction). Activated Aerodrome Slipstream adapter with deterministic `quoteExactInputSingleV3` eth_call quoting. Added 8 distinct opportunity classifications (`NO_OPPORTUNITY`, `SPREAD_TOO_SMALL`, `QUOTE_FAILED`, `INSUFFICIENT_LIQUIDITY`, `GAS_TOO_HIGH`, `SLIPPAGE_TOO_HIGH`, `RISK_REJECTED`, `POTENTIAL_CANDIDATE`).
- **Consequences**: Enables observation of micro-spread dislocations on Base with drastically lower friction barriers. Execution remains strictly LOCKED.

---

### DEC-020: Real-Time Event-Driven Architecture, WebSocket Ingestion & Selective Route Dispatch (Phase 2)
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Periodic sequential polling (evaluating all 26 routes sequentially every ~50 seconds in Phase 1F) created an architectural bottleneck termed the "Polling Latency Barrier". In competitive on-chain markets, price dislocations created by volume spikes are corrected within 1–3 blocks (2–6 seconds). Sequential polling is blind to micro-spreads arising and resolving between polling intervals. Furthermore, querying all 26 routes indiscriminately generated redundant RPC compute calls.
- **Options Considered**:
  1. Continue tightening polling intervals (e.g. 5s timer across all 26 routes) — exhausts free-tier RPC rate limits quickly, high compute overhead on static pools.
  2. Implement an event-driven architecture using Base WebSockets (`wss://...`), log index ordering, sliding-window deduplication, and an inverted pool index (`routesByPool`) that selectively re-quotes only affected routes upon `Swap` or `Sync` events.
- **Decision**: Implement Option 2. Build `MarketEventWatcher` with WebSocket streaming, automated reconnection, and HTTP fallback. Deploy `EventRouteDispatcher` with an inverted pool index that restricts re-quotes to affected venues (e.g. 6 of 26 routes for WETH/USDC, reducing quote volume by 76.9%). Pin both legs to the event `blockNumber` to eliminate block drift. Persist detected candidates to `opportunity_candidates` and provide deterministic replay via `EventReplayer`.
- **Consequences**: Slashes detection latency to sub-second and low-second speeds, saves >75% of RPC compute calls, and provides high-fidelity event replay. Execution remains strictly LOCKED (zero private keys, zero wallet signing, zero live trading).

---

### DEC-021: High-Fidelity Simulation, Revert Economics & Shadow Paper Execution Engine (Phase 3)
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Phase 2 verified sub-second event detection. However, raw quoted differences do not account for atomic execution semantics, trade-size scaling, gas price volatility, or adverse price drift during block assembly. Furthermore, naive models often confuse gross spread with net profit or double-count swap fees already deducted by on-chain quoters.
- **Options Considered**:
  1. Use static quote subtraction and assume frictionless execution.
  2. Build a high-fidelity execution-grade simulator implementing:
     - Exact two-leg atomic revert semantics (`ArbitrageExecutor.sol`) where principal is 100% protected on revert, but 100% of gas is consumed and lost.
     - Strict net PnL formula ($\Pi_{\text{net}} = Q_{\text{final}} - Q_{\text{in}} - C_{\text{gas}} - C_{\text{other}} - \rho_{\text{risk}}$) with zero fee double-counting.
     - Trade-size sweeping across $\$1$ to $\$500$ to characterize fixed gas vs slippage convexity.
     - Multi-dimensional gas sensitivity matrix and break-even gas derivation.
     - Latency adverse drift modeling and opportunity half-life evaluation.
     - Shadow paper trading portfolio ledger without network transaction submission.
     - Provenance-tagged data structures (`[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, `[ASSUMPTION]`).
- **Decision**: Implement Option 2. Build modular simulator in `scanner/src/simulator/` and extend SQLite store (schema v4) with `simulated_executions` and `shadow_trades`.
- **Consequences**: Provides deterministic, execution-grade validation prior to Phase 4 live paper trading. Guarantees that no false opportunities are admitted and models true execution risk. Execution remains strictly LOCKED.

---

### DEC-022: Phase 3 Forensic Audit Rectification, Provenance Disambiguation & Phase 4 Gate Criteria
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Prior to advancing to Phase 4 (Live Shadow / Paper Execution), a comprehensive forensic audit was conducted across all Phase 3 modules (`AtomicExecutionSimulator`, `HistoricalReplaySimulator`, `GasSensitivityEngine`, `LatencyDriftModel`, `TradeSizeOptimizer`, `ShadowExecutionEngine`, and `run-phase3-simulation.ts`). The audit uncovered that:
  1. Non-deterministic timestamps (`Date.now()`) were used in `simulationId` generation.
  2. `HistoricalReplaySimulator` hardcoded 18 token decimals and $10 fixed trade size regardless of token pair, producing distorted replay valuations on USDC or cbBTC pairs.
  3. The reported `+$0.2197` / `$100.22` shadow trading profit in `run-phase3-simulation.ts` originated from a hardcoded synthetic test fixture (+35 bps artificial spread), not an observed market opportunity, creating ambiguity in summary reports.
  4. The latency drift implementation employed a $0.75$ sublinear power rather than the theoretical $0.5$ square root diffusion.
- **Options Considered**:
  1. Conclude Phase 3 as-is and rely on operational notes.
  2. Implement comprehensive code-level rectifications:
     - Replace `Date.now()` with deterministic hash-like IDs: `sim_${routeId}_${blockNumber}_${initialAmount}_${timestampMs}`.
     - Add dynamic token metadata resolution (`resolveTokenMeta`) to `HistoricalReplaySimulator` supporting accurate decimals and valuations across USDC, WETH, cbBTC, and altcoins.
     - Connect real on-chain Quoters to `run-phase3-simulation.ts` across all 8 sweep tiers ($1–$500).
     - Explicitly demarcate synthetic test vectors in code, console logs, and reports with `[SYNTHETIC TEST FIXTURE]`.
     - Expand unit tests to 161 tests covering historical replay, edge cases, and determinism.
     - Establish Phase 4 entry gates requiring human operator signoff.
- **Decision**: Implement Option 2. Rectify all code and documentation issues immediately. Explicitly classify all data fields as `[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, or `[ASSUMPTION]`. Restrict Phase 4 entry to a strict gate requiring operator authorization.
- **Consequences**: Guarantees reproducible, deterministic simulation output and eliminates any risk of synthetic test profits being mistaken for empirical market discoveries. System execution remains strictly LOCKED.

---

### DEC-023: Phase 4 Real-Time Shadow / Paper Execution Architecture, Next-Block Calibration & Ledger Isolation
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Operator authorization was granted to execute Phase 4 (Real-Time Shadow / Paper Execution) on Base Mainnet. Phase 4 requires bridging off-chain simulation with real-time market dynamics without introducing execution risk, transaction signing, or capital exposure. Furthermore, previous phases established the strict rule that synthetic test vectors must never distort live portfolio win rates or empirical reporting.
- **Options Considered**:
  1. Rely on periodic polling scripts with simulated balances combined in a single ledger.
  2. Implement an integrated event-driven shadow execution pipeline:
     - Real-time event detection via Base WebSocket/Block stream.
     - Selective route re-quoting via Multicall3 across affected pairs.
     - Base OP Stack gas model separating L2 execution fee ($G_{\text{exec}} \times (f_{\text{base}} + f_{\text{priority}})$) from L1 rollup calldata fee ($0.002 [ESTIMATED]$).
     - 10-point False Positive Protection policy and 8-stage lifecycle state machine with microsecond monotonic timestamps.
     - Next-block ($B \to B+1$) market calibration proxy evaluating spread decay and dislocation persistence without claiming actual transaction execution.
     - Physical ledger partitioning: separate `liveLedger` and `syntheticLedger` instances to strictly enforce Zero Fake Win Rate.
     - Database schema v5 migration persisting `shadow_opportunities` and `shadow_calibrations`.
- **Decision**: Implement Option 2. Build modular architecture in `scanner/src/shadow/` (`RealTimeShadowEngine`, `OpportunityLifecycleManager`, `BaseGasModel`, `NextBlockCalibrationEngine`, `ShadowPortfolioLedger`), upgrade SQLite store to schema v5, and execute a controlled 15-cycle validation run.
- **Consequences**: Enables continuous, execution-grade paper trading and calibration against live Base Mainnet blocks. Proves calm-market pricing equilibrium (0 false positives admitted, $100.00 cash preserved). Execution remains strictly LOCKED; zero private keys, zero transaction broadcasts, ₹0 capital deployed.

---

### DEC-024: Phase 4.5 Opportunity Discovery & Calibration Campaign Architecture, Multi-Pool Identity & Statistical Calibration
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Operator authorization was granted to execute Phase 4.5 (Opportunity Discovery & Calibration Campaign) on Base Mainnet. The objective is to determine whether SAHIKARA can discover genuine, executable, positive-net-PnL DEX arbitrage opportunities under live market conditions across an expanded universe while maintaining strict execution lock (₹0 capital, read-only RPC telemetry). Key challenges included multi-pool same-pair routing, 5-tier opportunity hierarchy, 8 trade sizes sweep ($1 to $500), statistical distribution profiling (N, percentiles p25-p99), diagnostic missed opportunity vs infrastructure failure separation, and radical honesty on win rate reporting (`winRate: null` on 0 trades).
- **Options Considered**:
  1. Revert to full-market sequential polling or run an open-ended 72-hour daemon without statistical distribution modeling.
  2. Implement an execution-grade, event-driven calibration campaign:
     - Expand market universe with verified pools (e.g. Uniswap v3 WETH/USDC 3000 pool `0x6c561B446416E1A00E8E93E221854d6eA4171372`) while strictly preserving pool identity via `poolAddress` (never collapsing pools with identical token pairs).
     - Maintain Phase 2 event-driven architecture: Event -> Affected Pool -> Affected Pair -> Affected Routes -> Selective Quotes (8 sizes: $1, $5, $10, $25, $50, $100, $250, $500).
     - Establish 5-tier opportunity classification: TIER 0 (no dislocation), TIER 1 (gross positive only), TIER 2 (pre-gas positive), TIER 3 (simulated net positive off-chain), TIER 4 (next-block validated).
     - Implement `StatisticalReporter` generating parametric and percentile distribution tables across 8 key dimensions: Gross Spread, Net Spread, Gas Cost, Trade Size, Latency, Opportunity Lifetime, Price Impact, and Next-Block Decay.
     - Isolate infrastructure failures (RPC 429, timeouts, quoter reverts) from market equilibrium (no spread).
     - Strict Paper Portfolio Ledger rule: when trades = 0, report `Win Rate = N/A` (never fabricated "0%").
     - Run a controlled campaign of 100–500 real market events on Base Mainnet and terminate cleanly without running daemons.
- **Decision**: Implement Option 2. Add `StatisticalReporter.ts`, extend `types.ts`, `OpportunityLifecycleManager.ts`, `RealTimeShadowEngine.ts`, `ObservationStore.ts`, `health.ts`, build `run-phase4-5-campaign.ts`, and expand test suite with `tests/phase45Campaign.test.ts` (16 new tests, 194 total passing).
- **Consequences**: Controlled campaign of 18 market events and 448 route evaluations proved that Base DEX markets operate in tight pricing equilibrium during normal block intervals (median gross spread: -56.30 bps, 448/448 TIER 0, 0 profitable opportunities). Diagnosed 0 infrastructure failures. Confirmed ₹0 capital deployed, zero transaction signing, and execution permanently LOCKED.

---

### DEC-025: Phase 4.5.1 Forensic Correction & Data-Integrity Directives
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: A forensic audit of Phase 4.5 campaign telemetry identified that the reported minimum gross spread of `-10,000 bps` (-100%) was an artificial code artifact rather than an observed market condition. Root cause analysis revealed:
  1. `BASE_TOKENS['VIRTUAL'].address` possessed non-EIP-55 checksum casing (`0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b`), causing Viem's client-side contract address validation to throw an unhandled `Address must match its checksum counterpart` error prior to RPC dispatch.
  2. The catch block routed into `buildFailedEvaluation()`, which returned a hardcoded fallback of `grossSpreadBps: -10000`.
  3. `RealTimeShadowEngine.evaluateRoundTrip()` returned the error evaluation object without throwing an uncaught exception, bypassing the engine's `failedQuotes` increment and inadvertently pushing failed evaluations into `statisticalRecords`.
  4. Statistical reporting mixed invalid/failed records with valid executable quotes, distorting the empirical spread distribution.
  5. Market conclusions contained unscientific overclaims (e.g., claiming "Option A is conclusively proven" and "No opportunity existed" across the entire DEX ecosystem).
- **Options Considered**:
  1. Treat the anomaly as an isolated logging glitch and proceed to Phase 4.6 / Phase 5.
  2. Implement comprehensive forensic rectification across code, tests, documentation, and data models:
     - Fix `BASE_TOKENS['VIRTUAL'].address` checksum to `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`.
     - Enforce Quote Failure Invariant: `QUOTE_FAILED` evaluations must return `0 bps` for spreads, classification `QUOTE_FAILED`, status `ERROR`, and must NEVER enter market spread distributions.
     - Update `RealTimeShadowEngine` to inspect evaluation classification; route failed quotes strictly to `failedQuotes` and `missedReport.rejectedByQuoterFailure`, omitting them from `statisticalRecords`.
     - Formulate explicit statistical populations (`ALL_VALID_EXECUTABLE_QUOTES`, `ALL_ATTEMPTS`, `ALL_REJECTIONS`) in `StatisticalReporter.ts`.
     - Recalculate true Phase 4.5 market statistics directly from the 432 valid quotes: gross spread min `-451.61 bps`, median `-55.98 bps`, max `-30.23 bps`; net spread min `-472.49 bps`, median `-85.41 bps`, max `-41.06 bps`.
     - Replace absolute market claims with evidence-bounded statements recognizing unmonitored routes, pools, and blocks.
     - Add regression tests covering checksum validation, quote failure invariants, population separation, and deterministic reporting.
     - Strictly enforce execution lock at Phase 5 gate (₹0 capital, 0 private keys).
- **Decision**: Implement Option 2. Apply all architectural, mathematical, and data integrity rectifications immediately. Document findings in `docs/strategy/PHASE_4_5_1_FORENSIC_CORRECTION.md`.
- **Consequences**: Restores complete mathematical and empirical integrity to the discovery engine. Eliminates statistical contamination from failed quotes. Prevents overclaims in analytical conclusions. Execution remains strictly LOCKED.

---

### DEC-026: Phase 4.6 Multi-Market & Multi-Chain Discovery Architecture, Gas Modeling, and On-Chain Verification
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Operator authorization was granted to execute Phase 4.6 (Multi-Market / Multi-Chain Discovery & Empirical Validation). Following the Phase 4.5.1 forensic audit confirming that Base DEX markets operate in tight pricing equilibrium during normal block intervals (0 qualifying round-trip opportunities observed across 432 valid quotes), Phase 4.6 broadens the observation scope to four EVM networks: Base (8453), Optimism (10), Arbitrum One (42161), and Polygon (137). Objective is strictly research and observation; capital at risk remains ₹0.00, and execution is permanently LOCKED.
- **Options Considered**:
  1. Merge multi-chain pools into the existing global `ALL_ACTIVE_POOLS` array and run an unsegmented multi-chain scanner concurrently.
  2. Implement an isolated, modular multi-chain architecture:
     - Type-level chain identification: Extend `PoolDefinition` with `SupportedChain` union (`'base' | 'polygon' | 'arbitrum' | 'optimism'`) and `chainId?: number` property.
     - Isolate multi-chain registries: Create dedicated `pools-polygon.ts`, `pools-arbitrum.ts`, `pools-optimism.ts` and corresponding `pairs-*.ts` registries, preserving `ALL_ACTIVE_POOLS` strictly for Base (8453).
     - Chain-specific gas models:
       - Polygon (`PolygonGasModel`): sidechain with zero L1 data fee; gas priced in MATIC/USD.
       - Arbitrum (`ArbitrumGasModel`): Nitro L2 execution + provisional flat L1 calldata fee ($0.003 USD) pending future precompile calibration.
       - Optimism: reuses `BaseGasModel` reflecting shared OP Stack architecture.
     - On-Chain Bytecode Verification Gate: All multi-chain pools are tagged `[PROVISIONAL]`. The `verifyPoolBytecode()` utility issues read-only `eth_getCode` calls; pools with <4 bytes of bytecode are logged and skipped before quoting.
     - Sequential Campaign Runner (`scripts/run-phase4-6-campaign.ts`): runs per-chain observation campaigns sequentially (`PHASE_4_6_BASE`, `PHASE_4_6_OPTIMISM`, `PHASE_4_6_ARBITRUM`, `PHASE_4_6_POLYGON`) to prevent RPC rate-limit contention.
     - Separate Database Isolation: Writes observations to `data/observations_phase46.db`, leaving the Phase 4.5/4.5.1 baseline database (`observations.db`) strictly untouched.
     - Absolute Security Invariant: ₹0.00 capital, zero private keys, zero transaction signing or broadcasting.
- **Decision**: Implement Option 2.
- **Consequences**: Successfully adds multi-chain observation capabilities across 4 EVM networks without modifying Base production registries. Full test suite expands to 219 tests (100% passing). Complete data isolation maintained between Phase 4.5 baseline and Phase 4.6 multi-chain telemetry.

---

### DEC-027: Phase 4.6.0 Pre-Campaign On-Chain Registry Verification
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Prior to running the empirical Phase 4.6 campaign, on-chain verification of all non-Base token, pool, factory, and quoter registries was required across Polygon (137), Arbitrum One (42161), and Optimism (10). The goal was to prevent address misconfigurations, inverted token orderings, or fee tier assumptions from contaminating the empirical dataset (preventing any recurrence of Phase 4.5 artifacts).
- **Options Considered**:
  1. Proceed directly to the empirical campaign assuming addresses sourced from community lists were correct.
  2. Perform comprehensive on-chain RPC verification across all tokens (bytecode, symbol, decimals), factories, quoters, pools (token0, token1, fee, tickSpacing, factory match, liquidity), and execute bidirectional smoke quotes via QuoterV2. Apply Section 7 Provisional Registry Rule (preserve mismatched pools as disabled with clear audit trails; upgrade verified pools to `[FACT]`).
- **Decision**: Implement Option 2.
- **Results**:
  - Tokens: 17/17 verified on-chain with exact bytecode, symbol, and decimals (100% PASS).
  - Factories & Quoters: 6/6 verified with active contract bytecode across all 3 chains (100% PASS).
  - Pools: 11/15 verified passing with active liquidity. 4 pools exhibited address/fee mismatches and were safely marked `status: 'disabled'` with full root causes documented:
    1. `univ3-polygon-weth-usdc-500` (`0x45dDa9cb7c25131DF268515131f647d726f50608`): Actually WETH/USDC.e bridged (5 bps); disabled.
    2. `univ3-polygon-weth-usdc-3000` (`0x167384319B41F7094e62f7506409Eb38079AbfF8`): Actually WMATIC/WETH 3000; disabled.
    3. `univ3-polygon-weth-usdt-500` (`0x4CcD010148379ea531D6C587CfDd60180196F9b1`): Actually 30 bps fee tier, not 5 bps; disabled.
    4. `univ3-optimism-weth-usdc-3000` (`0x1C3140aB59d6cAf9fa7459C6f83D4B52ba881d36`): Actually OP/USDC.e 3000; disabled.
    5. `univ3-optimism-weth-usdc-500` (`0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b`): Token ordering inverted relative to EVM address sorting (`token0: USDC`, `token1: WETH`); corrected and upgraded to `[FACT]`.
  - Smoke Quotes: 22/22 bidirectional quotes via QuoterV2 succeeded across all 11 active pools (100% PASS, 0 failures, 153–451 ms latency).
- **Consequences**: Active observation scope is established with 11 pristine, verified non-Base pools. Evidence of mismatches is preserved without deletion. All verified pools upgraded to `[FACT]`. Capital at risk remains strictly ₹0.00; execution remains LOCKED.

---

### DEC-028: Phase 4.6.0.1 Canonical Pool Registry Reconciliation & Re-Verification
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Operator authorization was granted to reconcile the four provisional pool entries identified as mismatched in Phase 4.6.0 with their verified canonical on-chain replacements across Polygon (137) and Optimism (10). In accordance with memory and security directives, no historical evidence is deleted; old entries are preserved as disabled historical entries with full audit notes.
- **Options Considered**:
  1. Overwrite existing pool entries in-place, losing historical audit records of the old addresses.
  2. Perform explicit reconciliation:
     - Retain old incorrect addresses with `-historical-disabled` pool IDs, `status: 'disabled'`, and `tier: '[PROVISIONAL]'` with documented reasons.
     - Activate canonical replacements with `status: 'active'` and `tier: '[FACT]'`.
     - Re-verify all replacement addresses on-chain prior to modification (bytecode, tokens, fee, factory, liquidity, slot0).
     - Execute 30/30 bidirectional smoke quotes via QuoterV2 across all 15 active non-Base pools.
     - Add regression tests covering uniqueness of active addresses, numerical token ordering, fee matching, exclusion of disabled pools, and active pool validation.
- **Decision**: Implement Option 2.
- **Results**:
  - Reconciled Pools:
    1. Polygon WETH / native USDC 500: canonical `0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9` activated (`[FACT]`); old `0x45dDa...` preserved disabled.
    2. Polygon WETH / native USDC 3000: canonical `0x19C5505638383337D2972Ce68B493aD78E315147` activated (`[FACT]`); old `0x1673...` preserved disabled.
    3. Polygon WETH / USDT 500: canonical `0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4` activated (`[FACT]`); old `0x4CcD...` preserved disabled.
    4. Optimism WETH / USDC.e 3000: canonical `0xB589969D38CE76D3d7AA319De7133bC9755fD840` activated (`[FACT]`); old `0x1C31...` preserved disabled.
  - Smoke Quotes: 30/30 bidirectional quotes succeeded across all 15 active pools (100% SUCCESS, 0 failures).
  - Test Suite: 226/226 tests passing across 17 suites (100%).
  - Active Universe: 32 active pools (Base 17, Polygon 5, Arbitrum 5, Optimism 5) all verified `[FACT]`; 4 disabled pools preserved `[PROVISIONAL]`.
- **Consequences**: Complete multi-chain pool universe is verified and campaign-ready. Zero live capital at risk; execution engine remains strictly LOCKED.

---

### DEC-029: Phase 4.6.1 Multi-Chain Empirical Discovery Campaign Completion & Observation Findings
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Operator authorized execution of the actual Phase 4.6 empirical discovery campaign across Base (8453), Polygon (137), Arbitrum One (42161), and Optimism (10). Absolute safety invariants applied: ₹0 capital at risk, zero private keys, zero transaction signing or broadcasting, execution engine strictly locked, isolated database (`data/observations_phase46.db`), and 9-tier trade sizing ($1 to $1,000).
- **Options Considered**:
  1. Run single-thread sequential unsegmented quotes without adapter adaptations or caching.
  2. Implement robust multi-chain quoter address resolution and performance hardening:
     - In `UniswapV3Adapter.ts`, implement `_getQuoterAddress(pool)` dynamically routing non-Base chains (Polygon 137, Arbitrum 42161, Optimism 10) to canonical QuoterV2 `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`, and Base (8453) to `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`.
     - Implement block-pinned in-memory cache `poolStateCache` for `slot0` and `liquidity` within `UniswapV3Adapter.ts` keyed by `${poolAddress}:${blockNumber}`. Because blockchain state at a given block height is strictly immutable, caching within the same block avoids 18 redundant RPC calls per route evaluation without data fabrication.
     - Prioritize events from routed pools over unrouted pairs in event dispatching to ensure all 9 trade sizes are quoted per event without RPC starvation.
     - Enforce database isolation: Persist all campaign observations exclusively to `data/observations_phase46.db`, leaving baseline `data/observations.db` 100% untouched.
- **Decision**: Implement Option 2.
- **Results**:
  - Total Quote Attempts: 1,548 (Base: 756, Polygon: 270, Arbitrum: 252, Optimism: 270).
  - Valid Executable Quotes: 1,070 (Base: 278, Polygon: 270, Arbitrum: 252, Optimism: 270).
  - Failed Quotes: 478 (exclusively on Base volatile pairs at extreme size where tick ranges or liquidity were insufficient; 0 failures on Polygon, Arbitrum, Optimism).
  - Positive Gross Spreads: 0 (0.00%).
  - Positive Net Expected PnL: 0 (0.00%).
  - Opportunity Tiers: TIER 0 = 1,070; TIER 1–4 = 0.
  - Shadow Paper Ledger: $100.00 starting balance -> $100.00 ending balance (0 trades filled).
  - Data Integrity: SQLite `PRAGMA integrity_check` returned `ok`; statistical distribution calculation verified 100% reproducible bit-for-bit.
  - Evidence-Bounded Market Finding: No qualifying opportunity was observed in the defined Phase 4.6.1 sample.
- **Consequences**: Successfully collected and verified the empirical multi-chain market dataset. All 226 tests passing (100%). System remains strictly read-only with ₹0.00 capital at risk. Multi-chain empirical discovery campaign phase is complete.

> **AMENDMENT (2026-09-16, Forensic Audit)**: The original result entry states "statistical distribution calculation verified 100% reproducible bit-for-bit." This claim is retracted. The reproducibility check was found to be tautological (D-003) — it compared a value to itself. See DEC-030 for the corrective action.

---

### DEC-028: Forensic Audit Correction — D-001 ethPriceUsd Polygon Defect
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Post-campaign forensic audit (see `docs/strategy/PHASE_4_6_1_FORENSIC_AUDIT.md`)
  revealed that `policyConfig.ethPriceUsd` was set to `0.80` for Polygon chains. Because
  `RealTimeShadowEngine.getTokenPriceUsd('WETH')` returns `this.policyConfig.ethPriceUsd`,
  WETH was priced at $0.80 instead of $2,500, causing a 3,125× inflation of all trade sizes.
  All 270 Polygon observations from Phase 4.6.1 are economically invalid artifacts.
- **Decision**: Change `ethPriceUsd` to the constant `2500.0` (WETH price) in both the
  shadow engine `policyConfig` block (line 391) and the forensic re-query block (line 572)
  of `run-phase4-6-campaign.ts`. The gas token price (MATIC) is correctly handled by
  `PolygonGasModel` separately and must NOT be conflated with `ethPriceUsd`.
- **Files Modified**: `scanner/scripts/run-phase4-6-campaign.ts` lines 391, 572
- **Consequences**: Polygon re-run required. All Polygon Phase 4.6.1 data rejected.

---

### DEC-029: Forensic Audit Correction — D-002 BigInt→Number Overflow in priceImpactBps
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: `UniswapV3Adapter.ts` computed price impact as:
  `Number(sqrtPriceX96After) / Number(sqrtPriceX96)`. For WETH/stablecoin pools,
  `sqrtPriceX96 ≈ 1.58×10^33`, far exceeding `Number.MAX_SAFE_INTEGER (9×10^15)`.
  This caused `priceImpactBps` values up to 2×10^12 bps (physically impossible), corrupting
  the `SLIPPAGE_TOO_HIGH` gate across all chains.
- **Decision**: Replace `Number(sqrtPriceX96)` arithmetic with BigInt-safe integer arithmetic
  using a 1×10^8 scale factor. The first-order approximation
  `priceImpactBps ≈ |Δsqrt| / sqrt_before × 2 × 10000` is computed entirely in BigInt.
- **Files Modified**: `scanner/src/adapters/UniswapV3Adapter.ts` lines 226-231
- **Consequences**: priceImpactBps will now produce physically valid values (< 10,000 bps)
  for all pool types. The SLIPPAGE_TOO_HIGH gate will correctly classify high-impact trades.

---

### DEC-030: Forensic Audit Correction — D-003 Tautological Reproducibility Check
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: The Phase 4.6.1 campaign's reproducibility check compared:
  `const rep1 = s.statisticalReport.grossSpreadDist.median; const rep2 = s.statisticalReport.grossSpreadDist.median;`
  This is a tautology — it compares the same property to itself and always returns true,
  producing a false `reproducibilityPassed: true` in the results JSON.
- **Decision**: Replace the tautological check with a DB-driven recomputation. After the
  campaign completes, independently query `gross_spread_bps` values from the SQLite DB,
  sort them, compute the median via proper floor-division, and compare to the in-memory
  report with a 0.01 bps floating-point tolerance.
- **Files Modified**: `scanner/scripts/run-phase4-6-campaign.ts` lines 881-892
- **Consequences**: The `reproducibilityPassed` field in future campaign JSON results will
  reflect actual agreement between in-memory statistics and persisted DB values.

---

### DEC-031: Architectural Separation of Native Gas Token vs Base Trade Token Pricing
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: The Phase 4.6.1 forensic audit identified that `ethPriceUsd` was overloaded for both sizing trade inputs in WETH and computing native gas costs in USD. On chains like Polygon where the gas token (POL/MATIC $0.80) differs in denomination and price from the base trade asset (WETH $2,500 [ASSUMPTION]), this created the D-001 3,125× scaling defect.
- **Decision**: Formally separate the two economic concepts in `EconomicPolicyConfig`, `RealTimeShadowEngine`, `roundTripEvaluator`, and all campaign runners into:
  1. `nativeGasTokenPriceUsd`: Native gas token price in USD (POL/MATIC $0.80, ETH $2,500).
  2. `baseTradeTokenPriceUsd`: Base trade token price in USD (WETH $2,500 [ASSUMPTION]).
  `ethPriceUsd` is preserved strictly as a backward-compatible alias.
- **Files Modified**: `scanner/src/shadow/types.ts`, `scanner/src/shadow/RealTimeShadowEngine.ts`, `scanner/src/economics/roundTripEvaluator.ts`, `scanner/scripts/run-phase4-6-campaign.ts`.
- **Consequences**: Polygon gas calculations use $0.80 MATIC, while WETH sizing uses $2,500 WETH. $1 trade sizes correspond strictly to 0.0004 WETH (4e14 wei).

---

### DEC-032: Phase 4.6.1.1 Post-Audit Revalidation & Signal Forensics Verdict
- **Status**: **APPROVED**
- **Date**: 2026-09-16
- **Context**: Post-audit revalidation required independent empirical verification of the three code corrections (D-001, D-002, D-003) and forensic deconstruction of apparent Arbitrum (~+15 bps) and Optimism (~+26.5 bps) inter-fee-tier signals.
- **Decision**:
  1. **D-001, D-002, D-003**: Fully validated via 8 unit tests in `tests/phase4611Revalidation.test.ts` (all passing).
  2. **Polygon Revalidation**: Re-evaluated 18 live on-chain quotes across Pool 500 and Pool 3000 at block 93914560. Monotonic scaling verified ($0.0004$ to $0.40$ WETH). All 18 quotes yielded negative gross spreads (-13.49 bps to -187.13 bps) and negative net returns. Historical Polygon data permanently discarded.
  3. **Arbitrum & Optimism Signals**: Formally REJECTED as arbitrage. Both signals were negative gross returns (-19.96 bps and -8.46 bps) representing sub-fee inter-pool price drift (within the 35 bps fee floor). Terminology bounded to "observed sub-fee cross-pool round-trip spread".
  4. **Sampling Structure**: Effective independent sample size identified as 94 market states across 29 blocks (same-block evaluation artifact).
  5. **Phase 5 Block**: Phase 5 remains strictly BLOCKED. Capital at risk remains ₹0.00.
- **Files Created**: `docs/strategy/PHASE_4_6_1_1_POST_AUDIT_REVALIDATION.md`, `scanner/tests/phase4611Revalidation.test.ts`, `scanner/scripts/run-phase4-6-1-1-revalidation.ts`.
- **Consequences**: Implementation verified trustworthy. Zero false-positive signals promoted. Execution engine remains strictly locked.

---

### DEC-033: Phase 4.7 Opportunity Discovery Expansion Architecture & Empirical Findings
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.7 expanded opportunity discovery to investigate whether the historical absence of validated arbitrage was caused by constrained pool/pair/fee-tier/route coverage.
- **Decision**:
  1. **Dynamic Pool Discovery (`DynamicPoolDiscovery`)**: Implemented dynamic querying of canonical Uniswap V3 factories across 4 fee tiers ($100, 500, 3000, 10000$ bps) with on-chain bytecode, `slot0`, and `liquidity` verification. Discovered and verified 152 active pools across Base (17), Arbitrum (55), Optimism (40), and Polygon (40).
  2. **Graph Multigraph Routing (`GraphRouteGenerator`)**: Implemented directed multigraph cycle extraction with canonical cycle deduplication. Generated 334 unique routes, including 150 closed triangular cycles ($A \to B \to C \to A$) and 184 2-hop cycles.
  3. **Candidate Validation Pipeline (`PositiveSignalValidator`)**: Implemented a 10-stage sequential forensic gate: `PRICE_DIVERGENCE` $\to$ `EXECUTABLE_GROSS_POSITIVE` $\to$ `FEE_VALIDATED` $\to$ `SLIPPAGE_VALIDATED` $\to$ `GAS_VALIDATED` $\to$ `LATENCY_VALIDATED` $\to$ `LIQUIDITY_VALIDATED` $\to$ `RISK_BUFFER_VALIDATED` $\to$ `REPEATED_REQUOTE` $\to$ `CANDIDATE_VALIDATED`.
  4. **Empirical Lifetime Tracking (`OpportunityLifetimeTracker`)**: Enforced rule that lifetime must be recorded as `UNKNOWN` when 0 positive opportunities exist (zero synthetic `0 ms` records).
  5. **Granular Failure Taxonomy (`FailureTaxonomy`)**: Implemented 16 canonical mutually exclusive failure categories without polluting economic observation distributions.
  6. **Empirical Campaign Results**: Executed 1,593 quote attempts across 4 chains, yielding 1,423 successful quotes across 9 trade tiers ($1–$1,000).
     - 150 triangular routes evaluated live on-chain for the first time (100% negative gross/net returns due to compounding 3-leg fee drag and price impact).
     - 4 micro-spread candidates observed (2 Arbitrum, 2 Polygon); all 4 submitted to `PositiveSignalValidator` and forensically rejected (Arbitrum: gas cost $0.08 exceeded $0.0005 profit; Polygon: net profit -$0.0002 failed $0.05 policy floor and vanished at $\ge \$5$).
     - Total Validated Opportunities: **0**. Total Net Profitable Executions: **0**.
  7. **Phase 5 Gate**: Phase 5 remains **STRICTLY BLOCKED**. Execution engine remains strictly LOCKED. Capital at risk remains ₹0.00.
- **Files Created/Modified**:
  - `scanner/src/discovery/DynamicPoolDiscovery.ts`
  - `scanner/src/discovery/GraphRouteGenerator.ts`
  - `scanner/src/discovery/PositiveSignalValidator.ts`
  - `scanner/src/shadow/OpportunityLifetimeTracker.ts`
  - `scanner/src/economics/FailureTaxonomy.ts`
  - `scanner/scripts/run-phase4-7-campaign.ts`
  - `scanner/tests/phase47Discovery.test.ts`
  - `docs/strategy/PHASE_4_7_OPPORTUNITY_DISCOVERY_EXPANSION.md`
  - `docs/strategy/PHASE_4_7_FINAL_REPORT.md`
- **Consequences**: Demonstrated that expanded market coverage (152 pools, 334 routes, 150 triangular cycles) does not yield profitable DEX arbitrage on L2/sidechains under current market equilibrium. The engine remains 100% safe, verified, and locked.

---

### DEC-034: Phase 4.8 MEV Reality, Opportunity Persistence & Searcher-Layer Research Findings
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.7 verified that 1,423 executable quotes across 152 pools produced 0 net profitable opportunities. Phase 4.8 was chartered to investigate the underlying market physics: whether SAHIKARA was missing opportunities due to latency, pool coverage, mempool dynamics, or private ordering infrastructure.
- **Decision**:
  1. **Baseline Forensic Audit**: Independently recomputed the Phase 4.7 dataset; verified 1,593 quote attempts, 1,423 successes, 170 failures (100% `RPC_ERROR`), 4 gross-positive micro-spreads, 0 net-positive opportunities, and 0 data integrity defects. Published `docs/strategy/PHASE_4_8_BASELINE_FORENSIC_AUDIT.md`.
  2. **Opportunity Event Timeline (`OpportunityEventTimeline`)**: Implemented non-execution latency tracking decomposing event block to observation (avg 190ms), observation to detection (avg 10ms), and quote duration (550ms to 1,975ms). Strictly prohibited labeling these as "execution latency".
  3. **Empirical Opportunity Persistence (`OpportunityPersistenceEngine`)**: Enforced rule that lifetime defaults to `UNKNOWN` when zero positive opportunities exist; prevented synthetic `0 ms` records.
  4. **Multi-Size Depth Profiler (`MultiSizePersistence`)**: Evaluated discrete tiers ($1 to $1,000) without interpolation; demonstrated that sub-$5 trades are destroyed by gas costs, while trades $\ge \$50$ suffer tick price impact exceeding fee floors.
  5. **Latency Sensitivity Model (`LatencySensitivityModel`)**: Mapped decay profile across [10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2s, 5s] with strict categorization (`OBSERVED`, `MODELED`, `ASSUMED`). Demonstrated that genuine opportunities have sub-block half-lives ($< 250$ms).
  6. **Public Mempool Reality (`MempoolObserver`)**: Empirically proved that rollup sequencers (Base, Arbitrum, Optimism) reject `eth_newPendingTransactionFilter` because they do not operate public p2p mempools. Polygon Bor supports pending transaction filters, but free RPC rate limits constrain throughput.
  7. **Searcher Competition & Ordering Architecture (`SearcherCompetitionModel`)**: Proved that public RPC observation occurs strictly at post-block settlement (Stage 7), whereas professional searchers execute via direct sequencer sockets or builder relays (Stages 2–6).
  8. **Deterministic Replay System (`DeterministicOpportunityReplayer`)**: Replayed historical Phase 4.7 candidates under recorded receipts; confirmed that all 4 candidates failed net profitability or risk buffer thresholds.
  9. **12-Stage Candidate Revalidation Gate (`CandidateRevalidator`)**: Formally upgraded the 10-stage validator into a rigorous 12-stage sequential gate requiring raw observation, token, decimal, pool, fee, same-block, quote repeat, liquidity, price impact, gas, risk buffer, and provenance validation.
  10. **Independent Quality Dimensions (`OpportunityQualityMetrics`)**: Prohibited composite or subjective scoring; exposed 12 unweighted measurable fields.
  11. **Token Safety Classifier (`TokenSafetyClassifier`)**: Established heuristic bytecode and attribute screening for long-tail research without live trading.
  12. **Explicit Coverage Denominators (`EventCoverageAuditor`)**: Enforced explicit numerator/denominator reporting for event, pool, route, and size coverage.
  13. **Economic Truth Gate (`EconomicTruthGate`)**: Codified the fundamental arbitrage equation ($AmountOut - AmountIn - Gas - Execution - Buffer > 0$).
  14. **Controlled 5-Stage Research Campaign**: Executed Stage 1 historical replay, and live Stages 2 (Base), 3 (Arbitrum), 4 (Optimism), and 5 (Polygon). Confirmed 0 validated net opportunities across all live trials.
  15. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Zero transactions, zero signing, zero live capital.
- **Files Created/Modified**:
  - `scanner/src/events/OpportunityEventTimeline.ts`
  - `scanner/src/shadow/OpportunityPersistenceEngine.ts`
  - `scanner/src/simulator/MultiSizePersistence.ts`
  - `scanner/src/simulator/LatencySensitivityModel.ts`
  - `scanner/src/observer/MempoolObserver.ts`
  - `scanner/src/simulator/SearcherCompetitionModel.ts`
  - `scanner/src/simulator/DeterministicOpportunityReplayer.ts`
  - `scanner/src/discovery/CandidateRevalidator.ts`
  - `scanner/src/economics/OpportunityQualityMetrics.ts`
  - `scanner/src/discovery/TokenSafetyClassifier.ts`
  - `scanner/src/events/EventCoverageAuditor.ts`
  - `scanner/src/economics/EconomicTruthGate.ts`
  - `scanner/scripts/run-phase4-8-campaign.ts`
  - `scanner/tests/phase48MevResearch.test.ts`
  - `docs/strategy/PHASE_4_8_MEV_REALITY_RESEARCH.md`
  - `docs/strategy/PHASE_4_8_BASELINE_FORENSIC_AUDIT.md`
  - `docs/strategy/PHASE_4_8_FINAL_REPORT.md`
- **Consequences**: Resolved the core empirical questions. Established that DEX arbitrage profitability is gated not by pool coverage, but by private sequencer ordering, colocation, and sub-10ms local state simulation. Repository memory is 100% synchronized and verified.

---

### DEC-035: Phase 4.9 Execution-Layer Feasibility & Economic Sensitivity Gate
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Critical re-examination of Phase 4.8 claims and rigorous investigation of economic sensitivity, latency disaggregation, historical record fidelity, ordering layer dynamics, infrastructure trade-offs, and search-space blind spots.
- **Decision**:
  1. **Forensic Audit & Epistemic Downgrades**: Audited six core Phase 4.8 assertions. Downscaled pool coverage claim from "REFUTED" to "UNPROVEN OUTSIDE MONITORED UNIVERSE". Downscaled private order flow claim from "HEAVILY CONFIRMED" to "THEORETICAL INFERENCE / UNPROVEN BY DIRECT DATA". Reclassified 550–1,975ms metric from "Public RPC latency" to "Compound Quote Duration". Reclassified $0.25 risk buffer from fixed policy constant to trade-size-dependent parameter ($250 @ 10 bps). Published `docs/strategy/PHASE_4_9_PHASE_4_8_CRITICAL_AUDIT.md`.
  2. **Economic Sensitivity Matrix (`EconomicSensitivityMatrix`)**: Implemented parameterized research matrix evaluating risk buffers $\in \{\$0.00, \$0.001, \$0.005, \$0.010, \$0.025, \$0.050, \$0.100, \$0.250\}$. Confirmed that 0 out of 4 historical candidates achieve positive net profit even at $\$0.00$ risk buffer. Established that fixed L2/L1 gas cost drag is the sole barrier to profitability. Published `docs/strategy/PHASE_4_9_ECONOMIC_SENSITIVITY.md`.
  3. **Latency Disaggregation & RPC Benchmark (`RpcLatencyBenchmark`)**: Disaggregated latency into raw network RPC latency, event observation latency, quote simulation duration, and economic evaluation latency. Empirically measured five core methods (`eth_blockNumber`, `eth_getBlockByNumber`, `eth_call`, `multicall`, `eth_getLogs`) across Base (273ms), Arbitrum (287ms), Optimism (496ms), and Polygon (285ms). Demonstrated that local CPU evaluation takes $\le 1.0$ms, whereas EVM quote simulation takes 540–810ms. Published `docs/strategy/PHASE_4_9_LATENCY_RESEARCH.md`.
  4. **Historical Record Taxonomy & Count Reconciliation (`HistoricalReplayClassifier`)**: Established strict non-fungible taxonomy: `ONE_WAY_QUOTE` (43,554 rows), `ROUND_TRIP_QUOTE` (17,976 rows), `FULL_ROUTE_EVALUATION` (1,423 in Phase 4.7 + 70 in Phase 4.8 = 1,493 total), `EXACT_REPLAY` (0), `QUOTE_REPLAY` (4), `SIMULATED_REPLAY` (sensitivity tiers). Prohibited upgrading lower-fidelity records.
  5. **Ordering-Layer Architectures (`PHASE_4_9_ORDERING_LAYER_RESEARCH.md`)**: Analyzed sequencer queues, builder relays, and searcher interfaces on Base (Coinbase OP Stack), Arbitrum One (Nitro Sequencer Feed / Timeboost), Optimism (OP Stack), and Polygon (Bor P2P txpool). Enacted strict epistemic partitioning between Fact, Inference, Hypothesis, and Unproven claims.
  6. **Infrastructure Options & Search-Space Blind Spots (`PHASE_4_9_INFRASTRUCTURE_OPTIONS.md`)**: Evaluated 6 infrastructure tiers (Public RPC, Premium RPC, WebSocket RPC, Dedicated Node, Dedicated Archive, Specialized Searcher). Audited search-space limitations, quantifying that 152 canonical pools represent $<1\%$ of active pools and completely exclude Curve, Balancer, Camelot, Velodrome, QuickSwap, and long-tail pairs.
  7. **Phase 5 Feasibility Gate (`PHASE_4_9_FINAL_REPORT.md`)**: Classified Phase 5 feasibility:
     - Technical Feasibility: **TECHNICALLY FEASIBLE**.
     - Economic Feasibility: **NOT YET DEMONSTRATED** (0/1,493 opportunities profitable).
     - Phase 5 Directive: **STRICTLY BLOCKED**.
- **Files Created/Modified**:
  - `scanner/src/economics/EconomicSensitivityMatrix.ts`
  - `scanner/src/rpc/RpcLatencyBenchmark.ts`
  - `scanner/src/simulator/HistoricalReplayClassifier.ts`
  - `scanner/scripts/run-rpc-latency-benchmark.ts`
  - `scanner/tests/phase49FeasibilitySensitivity.test.ts`
  - `docs/strategy/PHASE_4_9_PHASE_4_8_CRITICAL_AUDIT.md`
  - `docs/strategy/PHASE_4_9_ECONOMIC_SENSITIVITY.md`
  - `docs/strategy/PHASE_4_9_LATENCY_RESEARCH.md`
  - `docs/strategy/PHASE_4_9_ORDERING_LAYER_RESEARCH.md`
  - `docs/strategy/PHASE_4_9_INFRASTRUCTURE_OPTIONS.md`
  - `docs/strategy/PHASE_4_9_FINAL_REPORT.md`
- **Consequences**: Established rigorous epistemic boundaries across all research claims. Proved that risk buffers are not the cause of negative net returns. Synchronized project memory. Capital at risk remains ₹0.00 / $0.00. Execution strictly locked. Phase 5 strictly blocked.

---

### DEC-036: Phase 4.10 DEX Ecosystem & Market-Universe Expansion
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.9 established that economic viability had not been demonstrated within the 152 monitored pools on Base, but acknowledged that major venues (Curve, Balancer, Camelot, Velodrome, QuickSwap, SushiSwap) remained outside the monitored universe. Phase 4.10 investigated whether expanding the universe would reveal economically viable DEX arbitrage on public state.
- **Decision**:
  1. **Multi-DEX Protocol Adapters**: Implemented 6 new protocol adapters conforming to `IPoolAdapter`: `CurveAdapter` (Stableswap `get_dy`), `BalancerV2Adapter` (Vault `getPoolTokens`), `CamelotAdapter` (Arbitrum directional `getAmountOut`), `VelodromeAdapter` (Optimism volatile/stable `getAmountOut`), `QuickSwapAdapter` (Polygon `getReserves`), and `SushiSwapAdapter` (Multi-chain `getReserves`).
  2. **Canonical Contract Bytecode Verification**: Confirmed canonical CREATE2 Vault for Balancer v2 (`0xBA12222222228d8Ba445958a75a0704d566BF2C8`) across Base, Arbitrum, Optimism, and Polygon; Camelot v2 Factory on Arbitrum (`0x6EcCab422D763aC031210895C81787E87B43A652`); Velodrome v2 Factory on Optimism (`0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a`); QuickSwap v2 Factory on Polygon (`0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`); SushiSwap v2 on Arbitrum and Polygon; Curve 2pool and Aave pools. Formally rejected SushiSwap on Base as an unsupported RouteProcessor.
  3. **Strict Token Identity & Valuation Separation**: Enforced canonical token identity by `chainId + address`. Established token relationship taxonomy (`NATIVE_CANONICAL`, `BRIDGED`, `LEGACY`, `UNKNOWN`). Strictly isolated valuation fields (`nativeGasTokenPriceUsd`, `baseTradeTokenPriceUsd`, `tokenPriceUsd`) to eliminate gas-price leakage into trade-token economics.
  4. **Pool Quality Tiers & Market Graph Routing**: Introduced 4 explicit tiers (`TIER_0`, `TIER_1`, `TIER_2`, `REJECTED`). Generated 78 multi-hop cross-DEX routes across 4 chains (58 2-hop cycles, 20 triangular cycles) strictly confined within each individual chain.
  5. **9-Stage Forensic Validation Pipeline**: Upgraded `PositiveSignalValidator` to execute a 9-stage validation process with formal taxonomy (`POSITIVE_GROSS_ONLY`, `POSITIVE_AFTER_FEES`, `POSITIVE_AFTER_GAS`, `POSITIVE_AFTER_SLIPPAGE`, `POSITIVE_AFTER_RISK`, `REVALIDATED`, `EXPIRED`, `INVALIDATED`, `FALSE_POSITIVE`, `INSUFFICIENT_DATA`).
  6. **Multi-Size Empirical Quote Campaign ($1 to $500)**: Evaluated sampled cross-DEX routes across 8 trade sizes. Established that AMM price parity and swap fee friction (8–60 bps) eliminate 100% of public cross-DEX round-trips. Zero positive gross or net opportunities observed.
  7. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Zero capital at risk (₹0.00 / $0.00). Execution engine remains locked.
- **Files Created/Modified**:
  - `scanner/src/config/tokens.ts`
  - `scanner/src/adapters/CurveAdapter.ts`
  - `scanner/src/adapters/BalancerV2Adapter.ts`
  - `scanner/src/adapters/CamelotAdapter.ts`
  - `scanner/src/adapters/VelodromeAdapter.ts`
  - `scanner/src/adapters/QuickSwapAdapter.ts`
  - `scanner/src/adapters/SushiSwapAdapter.ts`
  - `scanner/src/config/pools.ts`
  - `scanner/src/config/pools-arbitrum.ts`
  - `scanner/src/config/pools-optimism.ts`
  - `scanner/src/config/pools-polygon.ts`
  - `scanner/src/discovery/DynamicPoolDiscovery.ts`
  - `scanner/src/discovery/GraphRouteGenerator.ts`
  - `scanner/src/discovery/PositiveSignalValidator.ts`
  - `scanner/src/economics/roundTripEvaluator.ts`
  - `scanner/scripts/run-phase4-10-campaign.ts`
  - `scanner/tests/phase410DexExpansion.test.ts`
  - `docs/strategy/dex/curve.md`
  - `docs/strategy/dex/balancer.md`
  - `docs/strategy/dex/camelot.md`
  - `docs/strategy/dex/velodrome.md`
  - `docs/strategy/dex/quickswap.md`
  - `docs/strategy/dex/sushi.md`
  - `docs/strategy/dex/uniswap-v2.md`
  - `docs/strategy/PHASE_4_10_PLAN.md`
  - `docs/strategy/PHASE_4_10_DEX_EXPANSION.md`
  - `docs/strategy/PHASE_4_10_RESULTS.md`
  - `docs/strategy/PHASE_4_10_ECONOMIC_AUDIT.md`
  - `docs/strategy/PHASE_4_10_COVERAGE_AUDIT.md`
  - `docs/strategy/PHASE_4_10_FINAL_REPORT.md`
- **Consequences**: Expanded monitored universe beyond Uniswap v3 / Aerodrome without capital risk. Demonstrated that expanding pool and DEX coverage on public L2 state does not yield positive gross arbitrage. Phase 5 remains strictly blocked.

---

### DEC-037: Phase 4.11 Full Route Coverage & DEX Adapter Forensics
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: In Phase 4.10, 78 same-chain routes across 8 DEX adapters and 4 chains were generated, but only a 16-route representative sample was economically evaluated. Phase 4.11 was chartered to achieve 100% exhaustive route coverage across all 78 valid generated routes and 8 discrete trade sizes ($1 to $500), perform live protocol quote cross-checks against canonical mainnet router contracts, and execute adapter forensics.
- **Decision**:
  1. **Full Exhaustive Route Matrix**: Evaluated all 78 valid generated routes across all 8 trade sizes ($1, $5, $10, $25, $50, $100, $250, $500), creating a 624-evaluation nominal matrix.
  2. **Authoritative On-Chain Quote Cross-Checks**: Verified 6 out of 6 adapters against live mainnet router/quoter contracts (QuickSwapRouter, SushiSwapRouter, VelodromePair, CamelotPair, CurvePool, QuoterV2) with a predefined 0.5 bps tolerance. All 6 achieved an exact **0 wei / 0.0000 bps difference** (`MATCH`).
  3. **Balancer V2 Pool Typing**: Formally categorized Balancer pool types (`WEIGHTED`, `STABLE`, `OTHER_SUPPORTED`, `UNSUPPORTED`) in `BalancerV2Adapter.ts` and strictly gated quoting to weighted pools to eliminate unvalidated mathematical approximations.
  4. **Strict Fee Accounting**: Audited all 8 DEX adapters and confirmed native fee deduction in quote amounts; verified zero fee double-counting.
  5. **Empirical Campaign Findings**: Across 592 successful live on-chain round-trip quotes (and 32 structured revert failures), 0 gross-positive and 0 net-positive opportunities were observed. Confirmed that Phase 4.10's "zero positive gross" finding was not a sampling artifact.
  6. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Capital at risk remains ₹0.00 / $0.00. Execution engine remains locked.
- **Files Created/Modified**:
  - `scanner/src/adapters/BalancerV2Adapter.ts`
  - `scanner/scripts/run-quote-crosschecks.ts`
  - `scanner/scripts/run-phase4-11-campaign.ts`
  - `scanner/tests/phase411RouteForensics.test.ts`
  - `docs/strategy/PHASE_4_11_PLAN.md`
  - `docs/strategy/PHASE_4_11_ROUTE_COVERAGE.md`
  - `docs/strategy/PHASE_4_11_ADAPTER_FORENSICS.md`
  - `docs/strategy/PHASE_4_11_QUOTE_CROSSCHECK.md`
  - `docs/strategy/PHASE_4_11_ECONOMIC_AUDIT.md`
  - `docs/strategy/PHASE_4_11_PERSISTENCE.md`
  - `docs/strategy/PHASE_4_11_RESULTS.md`
  - `docs/strategy/PHASE_4_11_FINAL_REPORT.md`
- **Consequences**: Demonstrated full route universe coverage without sampling bias. Proved DEX adapter precision against mainnet deployments. Synchronized project memory. Capital at risk remains strictly zero.

---

### DEC-038: Phase 4.12 Opportunity-Universe Expansion & Independent Validation
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.11 proved that across 78 generated routes and 43 verified pools, zero gross-positive arbitrage opportunities existed in settled on-chain state. To test whether this finding was an artifact of universe selection, Phase 4.12 was chartered to systematically expand the monitored market universe across deeper liquidity tiers, secondary pairs, and additional DEX protocols on Base, Arbitrum One, Optimism, and Polygon PoS, reaching 137 verified pools and 300 generated routes across 8 discrete trade sizes ($1 to $500).
- **Decision**:
  1. **Systematic On-Chain Pool Expansion**: Discovered and verified 122 new active liquidity pools directly from protocol factories (`eth_getCode` > 4 bytes, positive reserves), expanding the active monitored universe from 43 to 137 unique pools (+218.6% increase).
  2. **Expanded Cyclic Route Inventory**: Generated 300 high-quality closed cyclic routes (200 two-hop cross-DEX cycles and 100 three-hop triangular cycles) spanning 8 DEX protocols without hidden profitability pruning.
  3. **Pre-Campaign Quote Cross-Checks**: Verified DEX adapters against independent on-chain router/quoter contracts under identical block state; all 4 verified protocols achieved exact **0 wei / 0.0000 bps discrepancy** (`MATCH`).
  4. **Multi-Size Matrix Campaign Execution**: Evaluated 2,400 nominal route-size evaluations ($1 to $500) under live RPC simulation with native fee inclusion and gas valuation decoupling.
  5. **Empirical Robustness Finding**: Confirmed that the zero-opportunity conclusion remains invariant under market universe expansion; settled committed state across public AMMs reflects post-arbitrage equilibrium.
  6. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Capital at risk remains ₹0.00 / $0.00. Execution engine remains locked.
- **Files Created/Modified**:
  - `scanner/scripts/run-phase4-12-discovery-verify.ts`
  - `scanner/scripts/run-phase4-12-crosschecks.ts`
  - `scanner/scripts/run-phase4-12-campaign.ts`
  - `scanner/data/pool_verification_phase412.json`
  - `scanner/data/quote_crosscheck_phase412.json`
  - `scanner/data/campaign_phase412_results.json`
  - `scanner/tests/phase412UniverseExpansion.test.ts`
  - `docs/strategy/PHASE_4_12_PLAN.md`
  - `docs/strategy/PHASE_4_12_UNIVERSE_DISCOVERY.md`
  - `docs/strategy/PHASE_4_12_POOL_VERIFICATION.md`
  - `docs/strategy/PHASE_4_12_ROUTE_COVERAGE.md`
  - `docs/strategy/PHASE_4_12_ADAPTER_VALIDATION.md`
  - `docs/strategy/PHASE_4_12_QUOTE_CROSSCHECK.md`
  - `docs/strategy/PHASE_4_12_ECONOMIC_AUDIT.md`
  - `docs/strategy/PHASE_4_12_PERSISTENCE.md`
  - `docs/strategy/PHASE_4_12_FAILURE_TAXONOMY.md`
  - `docs/strategy/PHASE_4_12_RESULTS.md`
  - `docs/strategy/PHASE_4_12_FINAL_REPORT.md`
- **Consequences**: Established empirical proof that the absence of cross-DEX arbitrage in public state is a general market invariant rather than a universe-selection artifact. Maintained 100% security invariants. Capital at risk remains zero.

---

### DEC-039: Phase 4.13A Event-Driven Sub-Block, Ordering & Opportunity-Timing Research
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phases 4.7–4.12 analyzed settled block states via public RPC polling, consistently observing zero authentic net-positive arbitrage opportunities. To investigate whether this result was an artifact of periodic settled-state observation missing transient sub-block or intra-block opportunities, Phase 4.13A instrumented a high-resolution monotonic telemetry pipeline, decoupled latency components, benchmarked event-driven vs periodic evaluation, and analyzed sequencer ordering and pending mempool visibility across Base, Arbitrum One, Optimism, and Polygon PoS.
- **Decision**:
  1. **Pre-Phase 4.12 Forensic Patch**: Reconciled all 39 Phase 4.12 raw candidates, proved on-chain the Polygon address-sorting numerical order inversion bug causing spurious spreads, added permanent regression tests (`phase413aForensicPatch.test.ts`), resolved the adapter evidence classification (`MATCH` vs `IMPLEMENTATION_FORENSICS_PASS` / `INDEPENDENT_QUOTE_VALIDATION_OPEN`), and corrected overbroad wording.
  2. **Latency Decoupling**: Implemented `HighResolutionTimeline` using `process.hrtime.bigint()` to strictly isolate Network RPC Latency ($188.74\text{ ms}$ mean), Observation Latency ($1,980.1\text{ ms}$ mean), Quote Duration ($19.82\text{ ms}$ mean), and Evaluation Latency ($0.01\text{ ms}$ mean).
  3. **Ordering Evidence Taxonomy**: Formalized 6 Ordering Evidence Levels (LEVEL 0–5); classified Base, Arbitrum One, and Optimism at LEVEL 2 (Event-Order Reconstruction) and Polygon PoS at LEVEL 3 (Public Pending Transaction Filter); confirmed LEVEL 5 (Direct Private Order Flow) is strictly unobservable via public nodes.
  4. **Same-Block Replay & Drift Protection**: Built `QuoteAgeTracker` and `CrossBlockDriftDetector` to enforce same-block quotation integrity (`leg1Block === leg2Block`) and classified replay capability as `EVENT_SEQUENCE_RECONSTRUCTION`.
  5. **Event-Driven Efficiency**: Proved that indexing pool state-changing events (`Swap`, `Sync`, `Mint`) to affected routes reduces RPC call overhead by **97.33%** (40 quotes vs 1,500 quotes) while observing identical negative post-event market states (median gross spread $-50.17\text{ bps}$).
  6. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Capital at risk remains ₹0.00 / $0.00. Execution engine remains locked.
- **Files Created/Modified**:
  - `scanner/src/events/HighResolutionTimeline.ts`
  - `scanner/src/events/OrderingEvidenceClassifier.ts`
  - `scanner/src/events/QuoteAgeTracker.ts`
  - `scanner/src/events/RpcTemporalBenchmark.ts`
  - `scanner/scripts/run-phase4-13a-campaign.ts`
  - `scanner/data/temporal_campaign_phase413_results.json`
  - `scanner/tests/phase413aForensicPatch.test.ts`
  - `scanner/tests/phase413aTemporal.test.ts`
  - `docs/strategy/PHASE_4_13A_PLAN.md`
  - `docs/strategy/PHASE_4_13A_PHASE_4_12_FORENSIC_PATCH.md`
  - `docs/strategy/PHASE_4_13A_TEMPORAL_ARCHITECTURE.md`
  - `docs/strategy/PHASE_4_13A_EVENT_DRIVEN_RESULTS.md`
  - `docs/strategy/PHASE_4_13A_RPC_LATENCY.md`
  - `docs/strategy/PHASE_4_13A_PENDING_STATE_RESEARCH.md`
  - `docs/strategy/PHASE_4_13A_ORDERING_RESEARCH.md`
  - `docs/strategy/PHASE_4_13A_OPPORTUNITY_LIFETIME.md`
  - `docs/strategy/PHASE_4_13A_ECONOMIC_AUDIT.md`
  - `docs/strategy/PHASE_4_13A_RESULTS.md`
  - `docs/strategy/PHASE_4_13A_FINAL_REPORT.md`
  - `docs/strategy/PHASE_4_13B_CEX_DEX_RESEARCH_SCOPE.md`
- **Consequences**: Conclusively proved that local computational latency ($<20\text{ ms}$) is not the reason arbitrage opportunities are not captured; public settled AMM pools remain arbitrage-free post-event; public RPCs experience $\approx 2.0\text{ s}$ observation lag; and private sub-block order flow is unobservable without specialized builder connections. Capital at risk remains strictly zero.

---

### DEC-040: Phase 4.13A.1 Temporal Measurement Forensics & Timestamp Validation
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.13A reported an "event observation latency ≈ 1.98 seconds". Phase 4.13A.1 was initiated to forensically audit this measurement, determine whether it represented genuine network/provider delivery latency, protocol timestamp semantics, or a local methodology artifact, and establish a mathematically sound, clock-domain-separated measurement framework.
- **Decision**:
  1. **Reconstruction & Reclassification**: The ~1.98s figure was mathematically proven to be a combination of in-runner simulation offset (`Date.now() - (Date.now() - 2000)`) and invalid cross-domain subtraction (`localWallClock - block.timestamp`). It did NOT represent physical network latency or RPC event delivery delay. Formally reclassified as a combination of (B) Blockchain timestamp semantics / clock-reference difference and (C) Local measurement methodology artifact. Canonical statement: *"The previously reported ~1.98 s event observation latency was not a valid measurement of RPC/network latency and has been reclassified."*
  2. **Strict Clock-Domain Separation**: Implemented `ClockDomainManager.ts` enforcing strict separation between `PROTOCOL_TIME`, `LOCAL_WALL_TIME`, and `LOCAL_MONOTONIC_TIME`. Prohibited cross-domain subtraction without calibration. Labeled `localWallClock - block.timestamp` strictly as `TIMESTAMP_REFERENCE_DELTA`.
  3. **Event Observation Latency Classification**: Designated event observation latency as `UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN` due to the lack of provider-side emission timestamps on public JSON-RPC nodes.
  4. **Empirical RPC Benchmarking**: Instrumented `TemporalMeasurementForensics.ts` with monotonic `performance.now()` across 160 requests ($N=20$ per chain). Established true `eth_getBlock` retrieval durations: Base ($247.50\text{ ms}$ median), Arbitrum One ($239.18\text{ ms}$ median), Polygon PoS ($162.80\text{ ms}$ median), OP Mainnet ($411.08\text{ ms}$ median).
  5. **Local Execution Pipeline Latency**: Confirmed that local processing overhead is negligible ($<20\text{ \mu s}$ for decoding, route matching, and economic evaluation; $16.21\text{ ms}$ total local pipeline with contract queries).
  6. **Phase 5 Gate Directive**: Phase 5 remains **STRICTLY BLOCKED**. Capital at risk remains ₹0.00 / $0.00. Execution engine remains locked.
- **Files Created/Modified**:
  - `scanner/src/events/ClockDomainManager.ts`
  - `scanner/src/events/TemporalMeasurementForensics.ts`
  - `scanner/scripts/run-phase4-13a1-forensics.ts`
  - `scanner/data/temporal_forensics_phase413a1_results.json`
  - `scanner/tests/phase413a1Forensics.test.ts`
  - `docs/strategy/PHASE_4_13A_1_PLAN.md`
  - `docs/strategy/PHASE_4_13A_1_TIMESTAMP_FORENSICS.md`
  - `docs/strategy/PHASE_4_13A_1_CLOCK_DOMAINS.md`
  - `docs/strategy/PHASE_4_13A_1_HTTP_LATENCY.md`
  - `docs/strategy/PHASE_4_13A_1_WEBSOCKET_LATENCY.md`
  - `docs/strategy/PHASE_4_13A_1_EVENT_TIMING.md`
  - `docs/strategy/PHASE_4_13A_1_CHAIN_TIMESTAMP_RESEARCH.md`
  - `docs/strategy/PHASE_4_13A_1_RESULTS.md`
  - `docs/strategy/PHASE_4_13A_1_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
- **Consequences**: Eliminates methodological artifacts in temporal benchmarking, establishes rigorous cross-domain clock governance, updates the project memory with empirical L2 RPC round-trip distributions, and maintains 100% security invariants. Capital at risk remains zero.

---

### DEC-041: Phase 4.13B CEX-DEX Arbitrage Research & Feasibility
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phases 4.7 through 4.13A.1 established that pure on-chain DEX–DEX settled state produces zero authentic net-positive arbitrage opportunities due to pool fee hurdles (30–60 bps) and L2 gas drag. Phase 4.13B was chartered to investigate whether incorporating off-chain Central Limit Order Book (CLOB) market data from centralized exchanges reveals persistent, observable, and economically viable arbitrage opportunities.
- **Decision**:
  1. **Strict Safety Boundary & Public Market Data**: Maintained zero exchange account creation, zero API trading keys, zero trading permissions, zero order dispatch, zero wallets, zero signers, and zero transaction broadcasting. Queried exclusively unauthenticated public endpoints from Binance, Coinbase, and Kraken. Capital at risk remains ₹0.00 / $0.00. Phase 5 remains **STRICTLY BLOCKED**.
  2. **Deterministic Order Book VWAP**: Implemented `CexOrderBook.ts` and `CexVwapCalculator.ts` to simulate exact order-book traversal across simulated notional trade sizes ($10, $25, $50, $100, $250, $500, $1,000, $5,000); strictly prohibited extrapolation beyond available depth (`INSUFFICIENT_DEPTH`).
  3. **Multi-Domain Clock Governance**: Implemented `CrossVenueClockModel.ts` segregating `EXCHANGE_TIME`, `PROTOCOL_TIME`, `LOCAL_WALL_TIME`, and `LOCAL_MONOTONIC_TIME`. Measured empirical server offsets: Coinbase ($-439\text{ ms}$), Binance ($-480\text{ ms}$), Kraken ($+186\text{ ms}$). Prohibited cross-domain subtraction.
  4. **Dual Inventory & Transfer Latency Constraints**: Built `InventoryModel.ts` and `TransferCostModel.ts`. Formally proved that sequential transfer arbitrage (Model A) is non-viable due to confirmation delays (16–256s) and unhedged market exposure (`NOT_ATOMIC`, `LATENCY_IMPAIRED`). Proved that pre-positioned inventory (Model B) requires $10\times$ committed capital, diluting net per-trade returns tenfold.
  5. **Empirical Results & Decision Gate Classification**: Executed controlled campaign across 192 evaluations: captured 12 authentic gross-positive price dislocations (+0.11 to +0.35 bps), all revalidated; 0 net-positive opportunities observed after realistic friction (CEX taker fee 10 bps, DEX gas, risk buffer 10 bps). Formally classified under Decision Gate **C: AUTHENTIC GROSS OPPORTUNITIES OBSERVED**.
- **Files Created/Modified**:
  - `scanner/src/cex/ICexMarketDataSource.ts`
  - `scanner/src/cex/CexMarketEvent.ts`
  - `scanner/src/cex/CexSymbolMapper.ts`
  - `scanner/src/cex/CexOrderBook.ts`
  - `scanner/src/cex/CexVwapCalculator.ts`
  - `scanner/src/cex/CexMarketDataNormalizer.ts`
  - `scanner/src/crossvenue/InventoryModel.ts`
  - `scanner/src/crossvenue/TransferCostModel.ts`
  - `scanner/src/crossvenue/CrossVenueEconomics.ts`
  - `scanner/src/crossvenue/OpportunityPersistence.ts`
  - `scanner/src/crossvenue/CrossVenueValidator.ts`
  - `scanner/src/crossvenue/CrossVenueOpportunityDetector.ts`
  - `scanner/src/timing/CrossVenueClockModel.ts`
  - `scanner/scripts/run-phase4-13b-research.ts`
  - `scanner/data/cex_dex_phase413b_results.json`
  - `scanner/tests/cexOrderBookAndVwap.test.ts`
  - `scanner/tests/symbolMapping.test.ts`
  - `scanner/tests/crossVenueEconomics.test.ts`
  - `scanner/tests/crossVenueValidation.test.ts`
  - `scanner/tests/inventoryAndTransfer.test.ts`
  - `scanner/tests/crossVenueTiming.test.ts`
  - `docs/strategy/PHASE_4_13B_PLAN.md`
  - `docs/strategy/PHASE_4_13B_CEX_RESEARCH.md`
  - `docs/strategy/PHASE_4_13B_DATA_SOURCES.md`
  - `docs/strategy/PHASE_4_13B_SYMBOL_MAPPING.md`
  - `docs/strategy/PHASE_4_13B_ORDERBOOK_MODEL.md`
  - `docs/strategy/PHASE_4_13B_TIMING.md`
  - `docs/strategy/PHASE_4_13B_INVENTORY_MODEL.md`
  - `docs/strategy/PHASE_4_13B_ECONOMICS.md`
  - `docs/strategy/PHASE_4_13B_OPPORTUNITY_FORENSICS.md`
  - `docs/strategy/PHASE_4_13B_RESULTS.md`
  - `docs/strategy/PHASE_4_13B_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
- **Consequences**: Established the first rigorous empirical CEX-DEX baseline in SAHIKARA; conclusively proved that while gross dislocations are observable in real time, standard taker fees and non-atomic execution friction prevent positive net economic realization; preserved 100% security invariants. Capital at risk remains strictly zero.

---

### DEC-042: Phase 4.13B.1 CEX-DEX Economic & Evidence Forensics Rectification
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Prior to advancing to Phase 4.14, a forensic audit was mandated to verify the mathematical calculations, parameter provenance, and semantic framing of the Phase 4.13B results.
- **Decision**:
  1. **Independent Recalculation**: Independently verified all 12 gross-positive candidates reported in Phase 4.13B (+0.025 to +0.35 bps). Discrepancy between reported and recalculated gross spread is exactly 0.0000 bps. Zero silent differences.
  2. **False-Positive Claim Rectification**: Replaced overbroad claim of "zero false positives" with bounded standard: *"No false positives were identified among the 12 candidates that passed the implemented validation gates."*
  3. **Inventory Model Provenance**: Reclassified the 10× inventory multiplier as a `[MODEL ASSUMPTION]` / simulation parameter rather than an empirical blockchain requirement. Proved that capital utilization scales inversely with buffer size ($1\times \to 100\%$, $10\times \to 10\%$, $20\times \to 5\%$).
  4. **Transfer Latency De-conflation**: Proved that protocol confirmation (e.g., 12 Base blocks / ~24s) does not equal end-to-end deposit crediting or withdrawal availability. Real settlement latency is `UNKNOWN / VARIABLE` and cannot be observed without live funded accounts.
  5. **Parameter Provenance**: Explicitly tagged CEX taker fee (10 bps) as `[MODEL ASSUMPTION]`, DEX gas as `[ESTIMATED SIMULATION]`, risk buffer as `[POLICY ASSUMPTION]`, and DEX pool fee as `[EMBEDDED IN QUOTE]`.
  6. **Sensitivity Analysis & Hypothetical Classification**: Evaluated fee sensitivity (10 to 0 bps), risk buffer sensitivity (20 to 0 bps), and gas sensitivity (5x to 0.1x). Proved that 100% of candidates remain net negative under any realistic fee/risk parameter. Classified zero-fee hypothetical positives strictly as `HYPOTHETICAL_NET_POSITIVE`.
  7. **Decision Gate Reaffirmation**: Reaffirmed Decision Gate **C: AUTHENTIC GROSS OPPORTUNITIES OBSERVED** with tightened bounded interpretation.
- **Files Created/Modified**:
  - `docs/strategy/PHASE_4_13B_1_FORENSIC_AUDIT.md`
  - `docs/strategy/PHASE_4_13B_1_FEE_SENSITIVITY.md`
  - `docs/strategy/PHASE_4_13B_1_INVENTORY_SENSITIVITY.md`
  - `docs/strategy/PHASE_4_13B_1_TRANSFER_ASSUMPTIONS.md`
  - `docs/strategy/PHASE_4_13B_1_FINAL_REPORT.md`
  - `docs/strategy/PHASE_4_13B_FINAL_REPORT.md`
  - `scanner/tests/phase413b1Forensics.test.ts`
  - `PROJECT_STATE.md`
- **Consequences**: Hardened the scientific integrity and epistemic boundaries of SAHIKARA's CEX–DEX research. Proved that observed micro-dislocations (+0.025 to +0.35 bps) cannot support net profitable execution under realistic friction. Phase 5 remains strictly BLOCKED. Capital remains ₹0.00 / $0.00.

---

### DEC-043: Phase 4.14 High-Resolution CEX–DEX Microstructure & Volatility-Regime Research
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Investigated whether continuous public WebSocket order-book streams reveal CEX–DEX gross price dislocations materially larger than the +0.35 bps baseline observed in the bounded Phase 4.13B REST experiment.
- **Decision**:
  1. **Continuous WebSocket Streaming**: Deployed native public WebSocket feeds for Binance (`ethusdc@depth20@100ms`), Coinbase (`level2_batch`, `ticker`), and Kraken (`book`), receiving 1,688 messages and 1,474 book updates with deterministic sequence validation and zero sequence gaps or invalidations.
  2. **Microstructure & Regime Telemetry**: Implemented `MicrostructureMetrics` (spread bps, depth imbalance $\frac{\text{Bid}-\text{Ask}}{\text{Bid}+\text{Ask}}$, book slope, update frequencies), `VolatilityRegimeClassifier` (`LOW`, `NORMAL`, `ELEVATED`, `HIGH`), and `HighResolutionPersistence` (update-level dissipation tracking).
  3. **Multi-Notional Empirical Campaign**: Executed 144 evaluations across 8 notional sizes ($10 to $5,000) against Base Uniswap V3 across LOW and ELEVATED volatility conditions.
  4. **Empirical Spread Findings**: Observed maximum gross spread of **-2.7754 bps** (median -6.9223 bps), strictly below the historical Phase 4.13B maximum (+0.3506 bps). Recorded exactly 0 gross-positive and 0 net-positive candidates.
  5. **Fee & Risk Sensitivity Matrix**: Tested progressive CEX fee tiers (10 bps down to 0 bps), gas scaling ($0.1\times$ to $2\times$), and risk buffers (0 to 10 bps). Confirmed that 0 candidates survived even under hyper-frictionless 0 bps fee assumptions.
  6. **Evidence Classification**: Formally classified under Evidence Category **B: OBSERVABLE BUT ECONOMICALLY UNPROVEN**.
  7. **Phase 5 & Security Invariants**: Phase 5 remains strictly **BLOCKED**. Capital at risk strictly ₹0.00 / $0.00. Zero trading credentials, zero live orders, zero on-chain broadcasts.
- **Files Created/Modified**:
  - `scanner/src/cex/CexWebSocketFeed.ts`
  - `scanner/src/cex/MicrostructureMetrics.ts`
  - `scanner/src/crossvenue/VolatilityRegimeClassifier.ts`
  - `scanner/src/crossvenue/HighResolutionPersistence.ts`
  - `scanner/scripts/run-phase4-14-research.ts`
  - `scanner/tests/phase414Microstructure.test.ts`
  - `scanner/data/cex_dex_phase414_results.json`
  - `docs/strategy/PHASE_4_14_PLAN.md`
  - `docs/strategy/PHASE_4_14_WEBSOCKET_MICROSTRUCTURE.md`
  - `docs/strategy/PHASE_4_14_ORDERBOOK_DYNAMICS.md`
  - `docs/strategy/PHASE_4_14_VOLATILITY_REGIMES.md`
  - `docs/strategy/PHASE_4_14_TIMING.md`
  - `docs/strategy/PHASE_4_14_OPPORTUNITY_PERSISTENCE.md`
  - `docs/strategy/PHASE_4_14_FEE_SENSITIVITY.md`
  - `docs/strategy/PHASE_4_14_DATA_QUALITY.md`
  - `docs/strategy/PHASE_4_14_FORENSICS.md`
  - `docs/strategy/PHASE_4_14_RESULTS.md`
  - `docs/strategy/PHASE_4_14_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
- **Consequences**: Conclusively established that high-resolution continuous WebSocket market data does not reveal hidden large gross price dislocations exceeding +0.35 bps on the monitored ETH/USDC pairs. Centralized order books and decentralized pools remain tightly coupled within ~2.8 bps. Capital remains strictly preserved at ₹0.00.

---

### DEC-044: Phase 4.14.1 Freshness, Cache Integrity & Synchronization Forensics
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Forensic audit of Phase 4.14 high-resolution dataset, quote provenance, rate limiting handling, and sample independence before accepting economic conclusions into canonical memory.
- **Decision**:
  1. **Evaluation Provenance Deconstruction**: Proved that public RPC rate-limited rounds (Rounds 4–12) were aborted via `continue;` and produced 0 evaluations, refuting the narrative of a cross-round cache fallback. All 144 evaluations were generated in Rounds 1–3 where quotes were queried once per round and reused across the 48 venue/size permutations.
  2. **Quote Age & Asynchrony Audit**: Measured quote ages across 6 standardized tiers (50ms to 2s). Confirmed that 0/144 evaluations (0.0%) achieved sub-500ms contemporaneity due to public Base RPC network round-trip floor (~300–450 ms). All evaluations represent `ASYNCHRONOUS_COMPARISON` over a 519–1,535 ms window (median 836 ms).
  3. **Segregated Population Recalculation**: Independently recalculated separate populations: Population A1 direct initial ($N=6$, max -3.69 bps), Population A2 contemporaneous $\le 1.0\text{ s}$ ($N=112$, max -2.78 bps), Population B stale $> 1.0\text{ s}$ ($N=32$, max -4.19 bps). All populations confirmed 0 gross-positive and 0 net-positive candidates.
  4. **Exact Candidate Verification**: Verified Evaluation #18 on Coinbase ($-2.7754\text{ bps}$) with exact 0.0000 bps arithmetic error at quote age 842 ms.
  5. **Microstructure vs Cross-Venue Segregation**: Disentangled the +6.6761 bps Kraken internal bid-ask spread from cross-venue arbitrage edge.
  6. **Effective Sample Size Bounding**: Demonstrated that nominal $N=144$ represents $N_{\text{eff}} = 3$ independent market state rounds ($N_{\text{LOW}} = 2, N_{\text{ELEVATED}} = 1$). Bounded all volatility conclusions to this sample.
  7. **Evidence Classification**: Confirmed Evidence Category **B: OBSERVABLE BUT ECONOMICALLY UNPROVEN**.
  8. **Security & Phase 5**: Zero trading credentials, zero live orders, ₹0.00 capital. Phase 5 strictly **BLOCKED**.
- **Files Created/Modified**:
  - `scanner/tests/phase4141FreshnessForensics.test.ts`
  - `docs/strategy/PHASE_4_14_1_FORENSIC_AUDIT.md`
  - `docs/strategy/PHASE_4_14_1_QUOTE_FRESHNESS.md`
  - `docs/strategy/PHASE_4_14_1_CACHE_INTEGRITY.md`
  - `docs/strategy/PHASE_4_14_1_SYNCHRONIZATION.md`
  - `docs/strategy/PHASE_4_14_1_SAMPLE_INDEPENDENCE.md`
  - `docs/strategy/PHASE_4_14_1_FINAL_REPORT.md`
  - `docs/strategy/PHASE_4_14_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
- **Consequences**: Established complete forensic clarity over the Phase 4.14 dataset. Proved that rate limiting prevented cross-round cache contamination, but within-round quote reuse and public RPC latency created an asynchronous comparison (~836 ms). Verified that whether fresh or cached, zero arbitrage opportunities existed.

---

### DEC-045: Phase 4.15 CEX–DEX Transport Feasibility & Latency Floor Benchmark
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Operator authorized Phase 4.15 to experimentally determine whether SAHIKARA can obtain sufficiently low and measurable transport latency between CEX market data and DEX on-chain QuoterV2 state to support contemporaneous cross-venue arbitrage evaluation. Initial probe script stalled because persistent WebSocket handles kept the Node.js event loop active and calls lacked bounded deadlines.
- **Decision**:
  1. **Probe Architecture Rectification**: Enforced strict 5,000 ms per-request timeouts with `AbortController` and explicit WebSocket client socket teardown in a `finally` block to guarantee deterministic process termination.
  2. **Bounded 3 HTTP + 3 WebSocket Comparison**: Executed controlled QuoterV2 calls (`quoteExactInputSingle` for $1.0\text{ WETH} \rightarrow \text{USDC}$ on Base Uniswap v3 pool `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`).
  3. **Exact Measured Observations**:
     - HTTP (`https://mainnet.base.org`): 575.55 ms (cold), 459.36 ms (warm keep-alive), 456.08 ms (warm keep-alive).
     - WebSocket (`wss://base-rpc.publicnode.com`): 571.16 ms, 605.62 ms, 641.67 ms.
  4. **Strict Epistemic Language Corrections**:
     - Bounded latency claim: Across the six measured QuoterV2 requests, observed round-trip latency ranged from 456 ms to 642 ms from the tested client environment.
     - Feasibility bounding: Sub-100ms QuoterV2 round-trip latency was not achieved using the tested unauthenticated public RPC endpoints from the tested client environment. This experiment does not establish that sub-100ms latency is technically impossible with other providers, geographic locations, dedicated infrastructure, private nodes, or alternative architectures.
     - Transport comparison: In this six-request probe, WebSocket QuoterV2 calls were slower than the two warm HTTP observations (preliminary observation, not a provider-wide transport conclusion).
     - Metric semantics: Combined RPC transport and on-chain state simulation/QuoterV2 call latency (not block confirmation).
  5. **Feasibility Classification**: Classified under **Category C: TRANSPORT-LIMITED**.
  6. **No Broad Market Campaign**: Prohibited starting a broad market campaign over unauthenticated public RPC endpoints since data would remain asynchronous.
  7. **Security & Gating**: ₹0.00 capital, 0 wallets, 0 signers, 0 trading keys. Phase 5 strictly **BLOCKED**.
- **Files Created/Modified**:
  - `scanner/scripts/probe-quoterv2-transport.ts`
  - `docs/strategy/PHASE_4_15_TRANSPORT_FEASIBILITY.md`
  - `docs/strategy/PHASE_4_15_LATENCY_METHODOLOGY.md`
  - `docs/strategy/PHASE_4_15_PROVIDER_COMPARISON.md`
  - `docs/strategy/PHASE_4_15_SYNCHRONIZATION.md`
  - `docs/strategy/PHASE_4_15_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
  - `EXPERIMENTS.md`
  - `LESSONS_LEARNED.md`
  - `CHANGELOG.md`
- **Consequences**: Established empirical proof that unauthenticated public RPC transport (both HTTP and WebSocket) incurs ~450–650 ms round-trip latency for on-chain QuoterV2 state resolution from this environment. Bounded market research to prevent generating broad market statistics from asynchronous data.

---

### DEC-046: Phase 4.16 DEX State Acquisition & Local Price Engine Architecture
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.15 established that remote QuoterV2 RPC round-trip latencies range between 280 ms and 650 ms, while centralized exchange order books update every 50 to 100 ms. Relying on remote Quoter calls creates an insurmountable latency bottleneck that prevents contemporaneous cross-venue arbitrage evaluation. Phase 4.16 evaluated whether SAHIKARA can maintain DEX pool state locally in memory and calculate candidate prices locally, while retaining authoritative on-chain Quoter verification as a mandatory safety gate before any hypothetical execution.
- **Decision**:
  1. **Local State Model**: Implemented `LocalPoolStateManager` in `scanner/src/dexstate/LocalPoolState.ts` supporting V2 constant-product reserves and V3 concentrated-liquidity `(slot0, liquidity, ticks)` with strict sequence validation, parent hash reorg detection, and freshness classes (`STATE_FRESH`, `STATE_RECENT`, `STATE_STALE`, `STATE_UNKNOWN`, `STATE_INVALID`).
  2. **In-Memory Price Engine**: Implemented `LocalPriceEngine` in `scanner/src/dexstate/LocalPriceEngine.ts` executing BigInt swap simulations in 14–22 microseconds (~17,600x faster than remote QuoterV2).
  3. **State-Aligned On-Chain Verification**: Executed live Base Mainnet benchmark (`run-phase4-16-state-benchmark.ts`) at Block 51438991 against authoritative QuoterV2 on `0xd0b53D9277642d899DF5C87A3966A349A798F224`:
     - $0.01\text{ WETH}$: 0 wei diff (+0.0000 bps) -> `MATCH`
     - $0.10\text{ WETH}$: 0 wei diff (+0.0000 bps) -> `MATCH`
     - $1.00\text{ WETH}$: 0 wei diff (+0.0000 bps) -> `MATCH`
     - $2.00\text{ WETH}$: 122 wei diff (-0.000248 bps) -> `MINOR_DIFFERENCE`
  4. **Adopt Hybrid Architecture C**: Recommended Architecture C: In-memory local state pre-filtering (0 RPC calls for non-candidates) + authoritative on-chain QuoterV2 verification triggered ONLY when local spread indicates an authentic candidate. Reduces network RPC volume by **99.75%**.
  5. **Failure & Reorg Safety Suite**: Implemented and verified 15 deterministic failure and reorg regression tests in `tests/phase416DexStateAcquisition.test.ts` (15/15 passing). Full test suite expanded to 413/413 tests passing (100%).
  6. **Security & Gating**: Maintained ₹0.00 capital, 0 wallets, 0 signers, 0 trading keys, 0 live orders, 0 broadcasts. Phase 5 strictly **BLOCKED**.
- **Files Created/Modified**:
  - `scanner/src/dexstate/LocalPoolState.ts`
  - `scanner/src/dexstate/LocalPriceEngine.ts`
  - `scanner/src/dexstate/StateAlignedValidator.ts`
  - `scanner/scripts/run-phase4-16-state-benchmark.ts`
  - `scanner/tests/phase416DexStateAcquisition.test.ts`
  - `docs/strategy/PHASE_4_16_STATE_ACQUISITION.md`
  - `docs/strategy/PHASE_4_16_LOCAL_STATE_ARCHITECTURE.md`
  - `docs/strategy/PHASE_4_16_VALIDATION.md`
  - `docs/strategy/PHASE_4_16_LATENCY.md`
  - `docs/strategy/PHASE_4_16_FAILURE_MODES.md`
  - `docs/strategy/PHASE_4_16_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
  - `EXPERIMENTS.md`
  - `LESSONS_LEARNED.md`
  - `CHANGELOG.md`
- **Consequences**: Conclusively proved that local state acquisition solves the transport bottleneck for continuous cross-venue candidate detection, reducing calculation time from ~280 ms to ~15 microseconds while eliminating 99.75% of RPC calls. Mandatory on-chain verification preserves execution safety without bypassing security gates.

---

### DEC-047: Phase 4.17 Production-Grade Local DEX State Reconstruction & Cross-DEX Validation
- **Status**: **APPROVED**
- **Date**: 2026-09-17
- **Context**: Phase 4.16 demonstrated that local in-memory quote calculations could achieve 0 wei parity for intra-tick trades on Uniswap V3. Phase 4.17 required hardening this architecture into a production-grade local DEX state engine handling multi-tick crossings, sparse tick bitmap bitwise indexing, event-driven state transitions (`Swap`, `Mint`, `Burn`), state lifecycle state machines, restart persistence recovery, and cross-DEX validation against Aerodrome V2 pools.
- **Decision**:
  1. **Multi-Tick Quote Engine**: Upgraded `LocalPriceEngine.ts` with `quoteV3MultiTick` supporting iterative tick boundary crossings, pure BigInt integer arithmetic (`mulDivRoundingUp`, `getAmount0Delta`, `getAmount1Delta`, `getNextSqrtPriceFromInput`, `computeSwapStep`), bitwise bitmap searching (`mostSignificantBit`, `leastSignificantBit`), and directional liquidity net adjustment ($L \pm \text{liquidityNet}$).
  2. **Event-Driven State Engine**: Extended `LocalPoolState.ts` with full lifecycle states (`BOOTSTRAP`, `SYNCING`, `VALID`, `UPDATED`, `STALE`, `INVALID`, `INCOMPLETE`, `RESYNC_REQUIRED`) and canonical log handlers for `Swap`, `Mint`, `Burn`, and `Sync` events.
  3. **Fail-Closed Missing Tick Invariant**: Mandated that if a swap crosses into an un-cached tick boundary or un-indexed bitmap word, the engine fails closed with `INCOMPLETE_STATE` rather than approximating liquidity.
  4. **State Persistence & Cold Restart**: Implemented JSON snapshot export and import protocols with BigInt string serialization. Cold start recovery verified with exact 0 wei quote parity pre- and post-restart.
  5. **Live Base Mainnet Validation**: Executed `run-phase4-17-production-benchmark.ts` at Block 51439647:
     - Uniswap V3 WETH/USDC ($0.001$, $0.01$, $0.10$, $1.00$, $2.00$, $5.00$ WETH): Exact 0 wei delta (0.000000 bps) across all 6 trade sizes (`MATCH`).
     - Aerodrome V2 Volatile WETH/USDC ($0.01$, $1.00$, $5.00$ WETH): Exact 0 wei delta (0.000000 bps) across all 3 trade sizes (`MATCH`).
     - Latency: Local V3 multi-tick quote median 1,206.9 µs vs QuoterV2 median 228.90 ms (~190x speedup); Local V2 quote median 48.2 µs vs RPC 243.05 ms (~5,000x speedup).
  6. **Aerodrome Taxonomy**: Formally classified Aerodrome Slipstream concentrated liquidity as `NOT_IMPLEMENTED / NOT_VALIDATED` pursuant to DEC-015; Aerodrome V2 constant-product validated.
  7. **Comprehensive Safety & Regression Suite**: Added 25 unit and invariant tests in `tests/phase417ProductionDexState.test.ts` (25/25 passing). Total test suite expanded to 438/438 passing (100%).
  8. **Security & Gating**: Maintained ₹0.00 capital, 0 wallets, 0 signers, 0 trading keys, 0 live orders, 0 broadcasts. Phase 5 strictly **BLOCKED**.
- **Files Created/Modified**:
  - `scanner/src/dexstate/LocalPoolState.ts`
  - `scanner/src/dexstate/LocalPriceEngine.ts`
  - `scanner/src/dexstate/StateAlignedValidator.ts`
  - `scanner/scripts/run-phase4-17-production-benchmark.ts`
  - `scanner/tests/phase417ProductionDexState.test.ts`
  - `docs/strategy/PHASE_4_17_UNISWAP_V3_STATE.md`
  - `docs/strategy/PHASE_4_17_TICK_RECONSTRUCTION.md`
  - `docs/strategy/PHASE_4_17_AERODROME_STATE.md`
  - `docs/strategy/PHASE_4_17_VALIDATION.md`
  - `docs/strategy/PHASE_4_17_RESTART_RECOVERY.md`
  - `docs/strategy/PHASE_4_17_FAILURE_MODES.md`
  - `docs/strategy/PHASE_4_17_LATENCY.md`
  - `docs/strategy/PHASE_4_17_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
  - `EXPERIMENTS.md`
  - `LESSONS_LEARNED.md`
  - `CHANGELOG.md`
- **Consequences**: Validated that local in-memory state reconstruction achieves bit-for-bit mathematical parity (0 wei error) across multi-tick crossings and cross-DEX constant-product pools, while cold restart persistence and fail-closed reorg guards maintain rigorous capital security invariants. Phase 5 remains strictly blocked pending operator review.

---

### DEC-048: Phase 4.18 Continuous Read-Only Shadow Detection Pipeline & Microsecond Candidate Screening
- **Status**: **APPROVED**
- **Date**: 2026-09-18
- **Context**: Phases 4.16 and 4.17 proved that local in-memory state models could achieve bit-exact parity (0 wei delta) against on-chain QuoterV2 and `getAmountOut` calls. However, those tests operated as isolated single-block validation micro-benchmarks. Phase 4.18 required integrating CEX market orderbooks, local DEX state tracking, microsecond candidate screening, economic/risk gating, authoritative on-chain verification, candidate revalidation, and shadow outcome persistence into a continuous, unified read-only runner.
- **Decision**:
  1. **Continuous Pipeline Architecture**: Built `ContinuousShadowPipeline.ts` orchestrating CEX feeds (Coinbase, Binance, Kraken), DEX state updates, candidate generation across 8 trade notionals ($100 to $100k), economic gating, authoritative on-chain QuoterV2 verification, and shadow outcome persistence.
  2. **Comprehensive Epistemic Provenance**: Implemented `ShadowForensicTypes.ts` standardizing provenance tags (`[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, `[ASSUMPTION]`), state health statuses, candidate lifecycle stages, discrepancy classifications (`EXACT`, `SUB_BPS_DRIFT`, `LOW_DRIFT`, `MATERIAL_DRIFT`, `INVALID_STATE`), quote freshness classes, 19-category failure taxonomy, and the 12-question forensic reproducibility record.
  3. **Screening vs. Verification Separation**: Enforced the cardinal architectural rule that local DEX state is strictly for candidate screening. Authoritative on-chain quotes are the mandatory, final verification for any candidate surviving economic filters.
  4. **Empirical Base Mainnet Parity**: Executed `run-phase4-18-shadow-campaign.ts` at Block 51440832. Live QuoterV2 vs `LocalPriceEngine` verification on 1.0 WETH swap produced:
     - Local predicted: `2454007702` atomic units
     - QuoterV2 quoted: `2454007702` atomic units
     - Absolute delta: `0` wei (`0.0000 bps` drift) -> **EXACT MATCH**.
  5. **100% Spurious RPC Call Reduction**: Local candidate screening evaluated 292 candidate paths with median latency of 51.20 µs (p95: 230.10 µs). All 292 unviable candidates were filtered locally by economic gates, eliminating 292 spurious on-chain RPC calls (100% avoidance ratio).
  6. **Sample Independence**: Enforced state hashing ($\text{block} \oplus \text{sqrtPrice} \oplus \text{reserve}$). 23 raw event cycles collapsed to 5 unique market states, quantifying a 4.60x state redundancy factor and preventing repeated-iteration statistical inflation.
  7. **Strict Safety & Execution Boundary**: Confirmed wallets = 0, signers = 0, orders = 0, transactions broadcast = 0, capital deployed = ₹0.00 / $0.00. 15/15 AST security checks passed across 110 files. All 447 tests pass (100%).
  8. **Gating**: Phase 4.18 marked complete. Phase 5 remains strictly BLOCKED pending Operator review.
- **Files Created/Modified**:
  - `scanner/src/shadow/ShadowForensicTypes.ts`
  - `scanner/src/shadow/ContinuousShadowPipeline.ts`
  - `scanner/src/shadow/index.ts`
  - `scanner/src/dexstate/LocalPoolState.ts`
  - `scanner/scripts/run-phase4-18-shadow-campaign.ts`
  - `scanner/tests/phase418ContinuousShadow.test.ts`
  - `scanner/data/phase418_shadow_campaign_results.json`
  - `docs/strategy/PHASE_4_18_PLAN.md`
  - `docs/strategy/PHASE_4_18_ARCHITECTURE.md`
  - `docs/strategy/PHASE_4_18_RUNBOOK.md`
  - `docs/strategy/PHASE_4_18_FORENSIC_REPORT.md`
  - `docs/strategy/PHASE_4_18_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
  - `CHANGELOG.md`
  - `EXPERIMENTS.md`
  - `LESSONS_LEARNED.md`
- **Consequences**: Confirmed that SAHIKARA's continuous shadow pipeline functions with microsecond screening speed, exact on-chain mathematical parity, 100% spurious RPC call reduction, and robust fail-closed state invariants, all while preserving an absolute ₹0.00 capital boundary. Phase 5 requires an explicit Operator decision.

---

### DEC-049: Phase 4.18.1 Forensic Correction & Economic Accounting Audit
- **Status**: **APPROVED**
- **Date**: 2026-09-18
- **Context**: Following the completion of Phase 4.18, a comprehensive forensic audit was initiated to verify all economic formulas, claim language, timing measurements, and sample population separation prior to any Phase 5 consideration.
- **Decision**:
  1. **DEX Swap Fee Accounting**: Reaffirmed and verified that DEX swap fees (5 bps Uniswap V3, 30 bps Aerodrome V2) are embedded directly in swap output quantities and are never deducted twice.
  2. **Directional Cash-Flow Formula Correction**: Fixed `ContinuousShadowPipeline.evaluateCexDex` to use exact bidirectional cash-flow equations for `CEX_TO_DEX` and `DEX_TO_CEX`, eliminating an omission of DEX output in `DEX_TO_CEX`.
  3. **RPC Avoidance Claim Discipline**: Replaced "292 spurious RPC calls avoided" with "292 local candidate evaluations rejected before authoritative RPC verification by local pre-filtering (100% avoidance ratio within observed sample)".
  4. **Strict Population Separation**: Formally separated findings into Population A (Continuous campaign: N=292, 0 RPC calls sent, 0 drift checks within continuous loop) and Population B (Standalone Quoter benchmark: N=1, exact match 0 wei delta, 0.0000 bps drift). Bounded the accuracy claim strictly to the tested configuration.
  5. **Shadow Terminology Discipline**: Renamed lifecycle state from `SHADOW_EXECUTABLE` to `SHADOW_SIMULATED`, adding explicit disclaimers: `SHADOW_SIMULATED ≠ ACTUAL EXECUTION`.
  6. **Timing Domain Provenance**: Classified local screening speed (38–51 µs) strictly as `LOCAL_PROCESSING_LATENCY` in `LOCAL_MONOTONIC_TIME`. Classified cross-venue synchronized latency as `UNKNOWN`.
  7. **Security & Zero-Execution Invariants**: Reaffirmed wallets = 0, signers = 0, orders = 0, transactions broadcast = 0, capital deployed = ₹0.00 / $0.00. 15/15 AST security checks passed across all 110 files. All 452 tests pass (100%).
- **Files Created/Modified**:
  - `scanner/src/shadow/ShadowForensicTypes.ts`
  - `scanner/src/shadow/ContinuousShadowPipeline.ts`
  - `scanner/scripts/run-phase4-18-shadow-campaign.ts`
  - `scanner/tests/phase418ContinuousShadow.test.ts`
  - `scanner/data/phase418_shadow_campaign_results.json`
  - `docs/strategy/PHASE_4_18_1_FORENSIC_CORRECTION.md`
  - `docs/strategy/PHASE_4_18_FORENSIC_REPORT.md`
  - `docs/strategy/PHASE_4_18_FINAL_REPORT.md`
  - `PROJECT_STATE.md`
  - `DECISIONS.md`
  - `CHANGELOG.md`
  - `EXPERIMENTS.md`
  - `LESSONS_LEARNED.md`
- **Consequences**: Phase 4.18 validated after forensic correction. All economic accounting and claims are rigorously bounded and reproducible. Phase 5 remains strictly BLOCKED pending Operator review.








