# ARCHITECTURE.md — System Design & Technical Blueprint

> **IMPLEMENTATION STATUS: PHASE 1 & PHASE 2 IMPLEMENTED**  
> The `scanner/` observation and real-time event-driven engine (Phases 1C, 1E, 1F, and Phase 2) is fully implemented as a strictly read-only research component. Components for Phase 3+ remain design-only. This document describes the full target architecture; implemented components are marked with their current status.

---

## 1. System Overview & Architectural Topology

SAHIKARA is architected as an event-driven, modular pipeline designed to minimize end-to-end detection-to-execution latency while preserving absolute safety boundaries.

```mermaid
graph LR
    subgraph Blockchain Layer [EVM Blockchain / Base Mainnet]
        DEX1[Uniswap v3 Pools]
        DEX2[Aerodrome Slipstream / V2 Pools]
        DEX3[PancakeSwap v3 Pools]
        Mempool[Block State / Mempool]
        Contract[ArbitrageExecutor Contract]
    end

    subgraph Scanner Layer [scanner/ — Phase 1 & 2 Implemented]
        Listener[WebSocket Block/Log Ingestion]
        Deduplicator[Event Deduplicator & Stale Filter]
        PoolState[Inverted Pool Index Cache]
        Dispatcher[Selective Route Dispatcher]
        Quoter[Multicall3 Quoter]
        Store[(SQLite Observation Store)]
    end

    subgraph Simulation Layer [simulator/ — Phase 3 Design]
        MathEngine[Exact Swap Math Engine]
        GasModel[Dynamic Gas & Fee Predictor]
        ProfitFilter[Net Profit & Risk Gate]
    end

    subgraph Execution Layer [executor/ — Phase 5 Design]
        TxBuilder[Atomic Tx Builder]
        Signer[Secure Keystore Signer]
        TxDispatcher[Private RPC / Mempool Dispatcher]
    end

    subgraph Guardrails & Telemetry [infrastructure/ & dashboard/]
        RiskManager[Risk Guard & Circuit Breaker]
        KillSwitch[Emergency Kill Switch]
        Telemetry[Latency & Candidate Telemetry]
    end

    DEX1 -.->|Swap / Sync Logs| Listener
    DEX2 -.->|Swap / Sync Logs| Listener
    DEX3 -.->|Swap / Sync Logs| Listener
    Mempool -.->|New Blocks| Listener
    Listener --> Deduplicator
    Deduplicator --> PoolState
    PoolState --> Dispatcher
    Dispatcher -->|Selective Affected Routes| Quoter
    Quoter --> Store
    Quoter --> MathEngine
    MathEngine --> GasModel
    GasModel --> ProfitFilter
    ProfitFilter -->|If Net Profit > Min Threshold| RiskManager
    RiskManager -->|Assert Limits Passed| TxBuilder
    RiskManager -.->|Trip Condition| KillSwitch
    KillSwitch -.->|Lockdown| TxBuilder
    TxBuilder --> Signer
    Signer --> TxDispatcher
    TxDispatcher -->|Atomic Execution Call| Contract
    Contract -->|Multi-Hop Swaps| DEX1
    Contract -->|Multi-Hop Swaps| DEX2
    Contract -.->|Revert on Loss| Blockchain Layer
    TxDispatcher -.-> Telemetry
```

---

## 2. Component Specifications

### 2.1 Scanner & Discovery Engine (`scanner/` — Phase 1 Implemented)
- **Role**: Continuously ingests blockchain state, models multi-pair cross-DEX executable quotes, and records observations to SQLite.
- **Key Components**:
  - **RPC Abstraction Layer (`src/rpc/`)**:
    - `IRpcProvider`: Contract for atomic RPC endpoints with credential masking, health monitoring, and latency histogram tracking (p50, p90, p99).
    - `RpcManager`: Resilient orchestrator implementing `IDataSource` with primary/secondary failover, bounded exponential backoff, and circuit breaker.
    - `Multicall3Batcher`: Batch contract caller utilizing canonical Multicall3 (`0xca11...ca11`) with `allowFailure: true` fault isolation.
  - **Discovery & Routing (`src/discovery/`)**:
    - `RouteGenerator`: Dynamically constructs distinct-venue 2-hop cross-DEX routes across configured research pairs without combinatorial explosion.
    - `MarketDiscoveryEngine`: Evaluates pairwise route candidates against executable on-chain quoters and tracks scanner metrics.
  - **DEX Adapters (`src/adapters/`)**:
    - Uniswap V3: Concentrated liquidity quoter (QuoterV2).
    - Aerodrome Volatile / Stable: Classical AMM and stable invariant quoter.
    - Aerodrome Slipstream: Concentrated liquidity quoter (MixedQuoterV3 `quoteExactInputSingleV3` with `tickSpacing`).
    - PancakeSwap V3: Concentrated liquidity quoter (QuoterV2 `0xB048Bbc1...`).
  - **Opportunity Classification (`IPoolAdapter.ts` & `roundTripEvaluator.ts`)**:
    - 8 mutually exclusive deterministic classifications: `NO_OPPORTUNITY`, `SPREAD_TOO_SMALL`, `QUOTE_FAILED`, `INSUFFICIENT_LIQUIDITY`, `GAS_TOO_HIGH`, `SLIPPAGE_TOO_HIGH`, `RISK_REJECTED`, `POTENTIAL_CANDIDATE`.
  - **Observation Store (`src/storage/`)**:
    - High-performance SQLite in WAL mode with granular pool-level uniqueness index on `(pool_leg1, pool_leg2, amount_in, block_number)` and dedicated `opportunity_candidates` table for post-hoc forensic reconstruction.
- **Security Invariant**: Strictly read-only (`eth_call`). No private keys, no signers, no transaction dispatchers. Capital deployed: ₹0 / $0.

### 2.2 Event-Driven Market Intelligence Engine (`scanner/src/events/` — Phase 2 Implemented)
- **Role**: Sub-second reactive event processing that detects pool state changes via WebSocket, re-quotes only affected routes, and measures end-to-end detection latency.
- **Key Components**:
  - **Event Stream Watcher (`MarketEventWatcher.ts`)**:
    - Subscribes to Base Mainnet WebSocket (`wss://`) log filters for V3 `Swap` (`Uniswap V3`, `Aerodrome Slipstream`, `PancakeSwap V3`), V2 `Swap` and `Sync` (`Aerodrome Volatile/Stable`), and new block headers.
    - Auto-reconnection engine with heartbeat, jittered exponential backoff (1s → 2s → 4s → 10s), and seamless fallback to HTTP block log polling upon network partition.
    - Fault-tolerant log processing: sliding-window LRU deduplication (`txHash:logIndex`), stale block pruning (`blockNumber < highestBlockSeen - 2`), and ascending intra-block log ordering.
    - Telemetry tracking: rolling end-to-end detection latency percentiles (min, p50, p90, p99, max).
  - **Selective Route Dispatcher (`EventRouteDispatcher.ts`)**:
    - Maintains an inverted pool index (`Map<poolAddress, RoundTripRouteDef[]>`) mapping monitored pools to dependent routes.
    - Selectively dispatches quotes only for routes directly touched by the state change event, eliminating full 26-route sequential polling cycles (**84.6% RPC call reduction**, **93.1% latency reduction**).
    - Block consistency pinning: locks both legs of multi-hop quotes to the event's `blockNumber` to eliminate inter-leg block drift.
    - Real-time candidate persistence: records any candidate meeting provisional economic criteria into the `opportunity_candidates` SQLite table.
  - **Deterministic Event Replayer (`EventReplayer.ts`)**:
    - Replays historical log sequences and synthetic market events through the identical detection, dispatch, and quote evaluation pipeline to verify mathematical determinism and reproduce past market conditions.
  - **Benchmark Comparison Engine (`BenchmarkComparison.ts`)**:
    - Quantifies empirical speedup, RPC overhead reduction, and classification parity between event-driven selective re-quoting and classical round-robin polling.

### 2.3 Simulator & Profitability Engine (`scanner/src/simulator/` — Phase 3 Implemented)
- **Role**: Execution-grade off-chain mathematical model of atomic two-leg round trips under realistic execution conditions.
- **Key Components**:
  - **Explicit Provenance Engine (`types.ts`)**: Tags every data field strictly as `[OBSERVED]`, `[QUOTED]`, `[SIMULATED]`, `[ESTIMATED]`, or `[ASSUMPTION]`.
  - **Price Impact & Slippage Engine (`PriceImpactModel.ts`)**:
    - Constant Product AMM impact: $\Delta P / P = \Delta x / (x + \Delta x)$.
    - Concentrated liquidity quoted slippage: $S = (P_{\text{marginal}} - P_{\text{effective}}) / P_{\text{marginal}}$.
    - Enforces maximum allowable slippage ceiling ($S_{\text{max}} = 20\text{ bps}$).
  - **Gas Sensitivity Matrix Engine (`GasSensitivityEngine.ts`)**:
    - Models total gas cost $C_{\text{gas}} = G \times (f_{\text{base}} + f_{\text{priority}}) \times P_{\text{ETH}}$ across multi-dimensional matrix ($0.01$–$5.0\text{ Gwei}$, $150\text{k}$–$350\text{k}$ gas).
    - Derives deterministic break-even base fee: $f_{\text{base}}^* = \frac{(Q_{\text{final}} - Q_{\text{in}} - \rho_{\text{risk}})}{G \times P_{\text{ETH}}} - f_{\text{priority}}$.
  - **Latency Drift & Opportunity Decay Engine (`LatencyDriftModel.ts`)**:
    - Sublinear adverse price drift [ASSUMPTION]: $\Delta P_{\text{drift}}(\Delta t) = \alpha \times (\Delta t / 1000)^{0.75}$ with default assumed $\alpha = 2.5\text{ to }3.5\text{ bps/sec}$.
    - Calculates spread decay and theoretical half-life: $t_{1/2} = \left(\frac{\text{Spread}_{\text{initial}}}{2 \alpha}\right)^{4/3}$.
    - Flags execution latency cutoffs ($\Delta t_{\text{max}} \le 3,000\text{ ms}$) as a conservative risk policy.
  - **Atomic Two-Leg Contract Simulator (`AtomicExecutionSimulator.ts`)**:
    - Strict economic formula: $\Pi_{\text{net}} = Q_{\text{final}} - Q_{\text{in}} - C_{\text{gas}} - C_{\text{other}} - \rho_{\text{risk}}$.
    - **Zero double-counting**: Pool fees embedded in quotes are not deducted twice.
    - **Atomic revert semantics**: 100% capital principal preserved on revert; 100% gas cost lost on revert.
    - Classifies failure modes: `SLIPPAGE_EXCEEDED_LEG1/2`, `NET_LOSS_REVERT`, `INSUFFICIENT_LIQUIDITY_LEG1/2`, `GAS_SPIKE_UNPROFITABLE`.
  - **Trade-Size Sweeper & Optimizer (`TradeSizeOptimizer.ts`)**:
    - Sweeps $\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$ and dynamically characterizes concave profit curves to find optimal size $Q^*$.
    - Identifies dominant bottlenecks: `FIXED_GAS_OVERHEAD`, `SLIPPAGE_CONVEXITY`, `NEGATIVE_GROSS_SPREAD`.
  - **Shadow Paper Execution Engine (`ShadowExecutionEngine.ts`)**:
    - Off-chain paper trading ledger with balance tracking, win/loss accounting, and execution logs.
  - **Historical Replay Simulator (`HistoricalReplaySimulator.ts`)**:
    - Replays historical SQLite observations with granular failure diagnosis distributions.
- **Security Invariant**: Strictly read-only simulation. No private keys, no signers, no transaction dispatchers. Capital deployed: ₹0 / $0.

### 2.4 Risk Manager & Safety Guardrails (`infrastructure/` — Phase 3–7)
- **Role**: Deterministic gatekeeper sitting between the Simulator and the Executor.
- **Key Responsibilities**:
  - Enforce maximum trade size limits.
  - Enforce daily cumulative loss ceilings.
  - Enforce consecutive failure caps (trips kill switch if $N$ consecutive reverts occur).
  - Enforce max gas price caps (prevents buying during network congestion spikes).

### 2.5 Smart Contract Layer (`contracts/` — Phase 5)
- **Role**: On-chain atomic executor contract (`ArbitrageExecutor.sol`).
- **Key Responsibilities**:
  - Execute multi-hop swaps across multiple DEX routers or direct pool contracts in a single atomic transaction.
  - Verify that the final token balance after completing the cycle strictly exceeds the initial balance plus the target minimum profit.
  - **Revert atomically** if any swap slips beyond allowable bounds or if the net cycle is unprofitable, ensuring zero lost principal (aside from consumed gas).
  - Restrict caller authorization strictly to the dedicated SAHIKARA executor address via `Ownable` or custom access control.
  - Provide an emergency drain/withdraw function accessible only by the owner.

### 2.6 Execution Engine (`executor/` — Phase 5)
- **Role**: Transaction constructor, parameter packager, and secure broadcast coordinator.
- **Key Responsibilities**:
  - Encode contract calldata with precise swap parameters, deadlines, and minimum output amounts.
  - Sign transactions off-chain using isolated keystores.
  - Transmit transactions via private RPC endpoints (e.g., MEV-protected endpoints or Flashbots bundles where available) to minimize public mempool front-running.
  - Handle nonce management, replacement transactions, and timeout cancellations.

### 2.7 Monitoring, Telemetry & Dashboard (`dashboard/` — Phase 8+)
- **Role**: Operator observability, telemetry metrics, and alerting.
- **Key Responsibilities**:
  - Track real-time PnL, gas expenditure, execution latency, and success/revert ratios.
  - Send instant push notifications (via Telegram/Discord) for every executed trade, warning, or anomaly.
  - Expose a manual hardware or software Kill Switch interface for instantaneous lockdown.

---

## 3. Communication & Latency Architecture

| Pathway | Mechanism | Target Latency | Notes |
| :--- | :--- | :--- | :--- |
| **Node $\rightarrow$ Scanner** | WebSocket (`eth_subscribe`) | $<50\text{ ms}$ | Dependent on RPC provider proximity |
| **Scanner $\rightarrow$ Simulator** | In-process memory event loop | $<5\text{ ms}$ | Zero network serialization overhead |
| **Simulator $\rightarrow$ Risk Gate** | Pure deterministic function | $<1\text{ ms}$ | In-memory evaluation |
| **Risk Gate $\rightarrow$ Executor** | Transaction signing & encoding | $<10\text{ ms}$ | Local cryptographic signing |
| **Executor $\rightarrow$ Node / Relay** | HTTP POST (`eth_sendRawTransaction`) | $<100\text{ ms}$ | Target next-block inclusion |

---

## 4. Security & Fault-Tolerant Boundaries

1. **Memory Isolation**: Secret keys and signing logic are isolated within `executor/keystore` and never accessible to logging or web interfaces.
2. **Atomic Contract Guarantees**: On-chain contracts never hold idle balances. All balances return to the executor wallet or stable token vault at transaction conclusion.
3. **Fail-Safe Defaults**: Any unhandled exception, RPC timeout, or parameter mismatch results in transaction cancellation and safe abort.
