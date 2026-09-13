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
