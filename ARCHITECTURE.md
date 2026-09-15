# ARCHITECTURE.md — System Design & Technical Blueprint

> **IMPLEMENTATION STATUS: PHASE 1C PARTIAL IMPLEMENTATION**  
> The `scanner/` observation engine (Phase 1C) is fully implemented as a read-only research component. Components for Phase 2+ remain design-only. This document describes the full target architecture; implemented components are marked with their current status.

---

## 1. System Overview & Architectural Topology

SAHIKARA is architected as an event-driven, modular pipeline designed to minimize end-to-end detection-to-execution latency while preserving absolute safety boundaries.

```mermaid
graph LR
    subgraph Blockchain Layer [EVM Blockchain / Polygon]
        DEX1[Uniswap v3 Pools]
        DEX2[QuickSwap Pools]
        Mempool[Block State / Mempool]
        Contract[ArbitrageExecutor Contract]
    end

    subgraph Scanner Layer [scanner/]
        Listener[WebSocket Block/Log Ingestion]
        PoolState[Local Reserve & Tick Cache]
    end

    subgraph Simulation Layer [simulator/]
        MathEngine[Exact Swap Math Engine]
        GasModel[Dynamic Gas & Fee Predictor]
        ProfitFilter[Net Profit & Risk Gate]
    end

    subgraph Execution Layer [executor/]
        TxBuilder[Atomic Tx Builder]
        Signer[Secure Keystore Signer]
        Dispatcher[Private RPC / Mempool Dispatcher]
    end

    subgraph Guardrails & Telemetry [infrastructure/ & dashboard/]
        RiskManager[Risk Guard & Circuit Breaker]
        KillSwitch[Emergency Kill Switch]
        Telemetry[Prometheus / Alerting]
    end

    DEX1 -.->|State Logs| Listener
    DEX2 -.->|State Logs| Listener
    Mempool -.->|New Blocks| Listener
    Listener --> PoolState
    PoolState --> MathEngine
    MathEngine --> GasModel
    GasModel --> ProfitFilter
    ProfitFilter -->|If Net Profit > Min Threshold| RiskManager
    RiskManager -->|Assert Limits Passed| TxBuilder
    RiskManager -.->|Trip Condition| KillSwitch
    KillSwitch -.->|Lockdown| TxBuilder
    TxBuilder --> Signer
    Signer --> Dispatcher
    Dispatcher -->|Atomic Execution Call| Contract
    Contract -->|Multi-Hop Swaps| DEX1
    Contract -->|Multi-Hop Swaps| DEX2
    Contract -.->|Revert on Loss| Blockchain Layer
    Dispatcher -.-> Telemetry
```

---

## 2. Component Specifications

### 2.1 Scanner & Discovery Engine (`scanner/` — Phase 1C & 1E Implemented)
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
    - High-performance SQLite in WAL mode with granular pool-level uniqueness index on `(pool_leg1, pool_leg2, amount_in, block_number)`.
- **Security Invariant**: Strictly read-only (`eth_call`). No private keys, no signers, no transaction dispatchers. Capital deployed: ₹0 / $0.

### 2.2 Simulator & Profitability Engine (`simulator/` — Phase 3)
- **Role**: High-fidelity off-chain mathematical model of on-chain execution.
- **Key Responsibilities**:
  - Implement exact swap formulas ($x \cdot y = k$ for Uniswap v2/Quickswap and tick-based liquidity math for Uniswap v3).
  - Calculate realistic price impact (slippage) as a function of simulated trade size.
  - Dynamically query base gas fees and priority fees to model exact transaction costs.
  - Deduct DEX pool fees, protocol cuts, and gas overhead to produce **Net Expected Profit**.
  - Drop any opportunity where Net Expected Profit is less than the provisional threshold ($\text{Profit} \le \text{MinThreshold}$).

### 2.3 Risk Manager & Safety Guardrails (`infrastructure/` — Phase 3–7)
- **Role**: Deterministic gatekeeper sitting between the Simulator and the Executor.
- **Key Responsibilities**:
  - Enforce maximum trade size limits.
  - Enforce daily cumulative loss ceilings.
  - Enforce consecutive failure caps (trips kill switch if $N$ consecutive reverts occur).
  - Enforce max gas price caps (prevents buying during network congestion spikes).

### 2.4 Smart Contract Layer (`contracts/` — Phase 5)
- **Role**: On-chain atomic executor contract (`ArbitrageExecutor.sol`).
- **Key Responsibilities**:
  - Execute multi-hop swaps across multiple DEX routers or direct pool contracts in a single atomic transaction.
  - Verify that the final token balance after completing the cycle strictly exceeds the initial balance plus the target minimum profit.
  - **Revert atomically** if any swap slips beyond allowable bounds or if the net cycle is unprofitable, ensuring zero lost principal (aside from consumed gas).
  - Restrict caller authorization strictly to the dedicated SAHIKARA executor address via `Ownable` or custom access control.
  - Provide an emergency drain/withdraw function accessible only by the owner.

### 2.5 Execution Engine (`executor/` — Phase 5)
- **Role**: Transaction constructor, parameter packager, and secure broadcast coordinator.
- **Key Responsibilities**:
  - Encode contract calldata with precise swap parameters, deadlines, and minimum output amounts.
  - Sign transactions off-chain using isolated keystores.
  - Transmit transactions via private RPC endpoints (e.g., MEV-protected endpoints or Flashbots bundles where available) to minimize public mempool front-running.
  - Handle nonce management, replacement transactions, and timeout cancellations.

### 2.6 Monitoring, Telemetry & Dashboard (`dashboard/` — Phase 8+)
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
