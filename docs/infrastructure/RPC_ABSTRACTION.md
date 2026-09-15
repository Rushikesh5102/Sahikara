# RPC_ABSTRACTION.md — Resilient RPC Provider Architecture & Management

> **STATUS**: **IMPLEMENTED & TESTED (Phase 1E)**  
> **SCOPE**: Read-Only RPC Infrastructure  
> **EPISTEMIC TAGS**: [FACT] = verified implementation, [PROVISIONAL] = heuristic thresholds  

---

## 1. Architectural Motivation

Prior to Phase 1E, the scanner relied on a monolithic `RpcDataSource` class that combined RPC connection management, health checking, block polling, and contract calls into a single unlayered file. This created tightly-coupled failure modes:
1. Direct dependency on specific endpoint URLs without structured abstraction.
2. Incomplete isolation between connection health and contract call logic.
3. Lack of granular latency percentiles (p50, p90, p99) required for high-frequency market intelligence.

Phase 1E introduces a decoupled RPC provider hierarchy:

```
                      IDataSource
                           │
                           ▼
                      RpcManager
              ┌────────────┴────────────┐
              ▼                         ▼
      Primary Provider         Secondary Provider
       (IRpcProvider)            (IRpcProvider)
              │                         │
              ▼                         ▼
         RpcProvider               RpcProvider
      (viem PublicClient)       (viem PublicClient)
```

---

## 2. Component Design & Interfaces

### `IRpcProvider`
Defines the atomic contract for any single RPC node:
- **`id` & `maskedUrl`**: URL sanitization that obscures private tokens, basic-auth passwords, and query parameters (e.g. `https://base.llamarpc.com` or `https://mainnet.base.org?key=***`).
- **`isHealthy()`**: Dynamic boolean reflecting consecutive error count and circuit breaker state.
- **`getMetrics()`**: Emits `RpcProviderMetrics` (total requests, successes, failures, timeouts, rate-limits, latency percentiles p50/p90/p99).
- **`getPublicClient()`**: Read-only viem client exposure for Multicall3 batching.

### `RpcProvider`
Encapsulates a viem `PublicClient` configured strictly with HTTP read transport:
- **Latency Histogram**: Tracks a sliding window of the last 100 call latencies to compute rolling p50, p90, and p99.
- **Circuit Breaker**: Trips when 5 consecutive errors occur or when a rate limit (`429 Too Many Requests`) is encountered. Remains open for a 30-second cooldown before attempting half-open recovery.

### `RpcManager`
Implements the high-level `IDataSource` interface used by `MarketObserver` and adapters:
- **Routing**: Automatically directs calls to `primaryProvider`. If primary fails or is unhealthy, routes to `secondaryProvider`.
- **Bounded Retries with Backoff**: Executes up to 3 bounded retries with exponential backoff and jitter (`initialBackoffMs: 200`, `maxBackoffMs: 2000`). Never retries indefinitely.
- **Fail-Safe Contract Calls**: If all configured providers fail, records error metrics, logs the failure, and returns an explicit error result. It never synthesizes default or zero values.

---

## 3. Security & Invariant Guarantees

1. **Credential Sanitization**: The `maskRpcUrl()` helper parses any URI and strips path secrets, query secrets, and auth credentials before the URL is logged, recorded in SQLite, or output to console.
2. **Zero Signers / Accounts**: Neither `RpcProvider` nor `RpcManager` instantiates or imports `walletClient`, private keys, or account objects.
3. **No Fabricated Fallbacks**: A failed block or gas price query throws a clear exception that halts the observation cycle safely rather than allowing the engine to trade or observe against stale or imagined block data.
