# PHASE 4.15 — Latency Measurement Methodology & Clock Discipline

> **STATUS**: PRELIMINARY TRANSPORT PROBE COMPLETE  
> **SCOPE**: Epistemic and methodological standards for transport latency measurement.

---

## 1. Multi-Clock Domain Discipline

Phase 4.15 enforces strict segregation across three independent clock domains, formalized in Phase 4.13A.1 and Phase 4.13B:

1. **`PROTOCOL_TIME`**:
   - Source: Blockchain block header timestamp (`block.timestamp`).
   - Units: Integer seconds since Unix epoch.
   - Semantics: Consensus-assigned timestamp. Quantized by sequencer batch intervals (e.g. 2.0s on Base). Cannot be used for network transport latency calculation.
2. **`LOCAL_WALL_TIME`**:
   - Source: Host operating system clock (`Date.now()`).
   - Units: UTC milliseconds.
   - Semantics: Subject to NTP adjustments, daylight saving corrections, and manual clock adjustments.
3. **`LOCAL_MONOTONIC_TIME`**:
   - Source: CPU high-resolution hardware counters (`process.hrtime.bigint()` / `performance.now()`).
   - Units: Nanoseconds / sub-millisecond floats.
   - Semantics: Strictly non-decreasing elapsed time. Never jumps backward. Guaranteed free from NTP or system-clock adjustments.

### Critical Rule
Never subtract timestamps across domains to measure network or transport latency:
$$\Delta t_{\text{transport}} = t_{\text{end, monotonic}} - t_{\text{start, monotonic}}$$

Any comparison between host wall-clock and remote exchange or blockchain timestamps must be labeled as `TIMESTAMP_REFERENCE_DELTA` or classified as `UNKNOWN`.

---

## 2. Bounded Per-Request Timeouts & Socket Lifecycle

1. **Per-Request Timeout Enforcement**:
   - Every network call (HTTP or WebSocket) is wrapped with an explicit deadline (`TIMEOUT_MS = 5,000 ms`).
   - HTTP requests utilize `AbortController` passed to the transport signal.
   - WebSocket requests track pending request IDs with an internal timer; if no response is received within 5,000 ms, the promise rejects with `TIMEOUT`.
2. **Explicit Socket Lifecycle Termination**:
   - WebSocket connections maintain persistent socket handles on the runtime event loop.
   - All benchmark scripts must implement explicit `close()` routines within `finally` blocks, ensuring that zero orphaned socket listeners prevent clean process termination.

---

## 3. Failure Taxonomy

Every network interaction is deterministically classified into exactly one category:

| Category | Definition | Trigger Conditions |
|---|---|---|
| **`SUCCESS`** | Valid response received within timeout window | Complete JSON-RPC result parsed and decoded |
| **`TIMEOUT`** | Deadline elapsed before response received | Request elapsed time $\ge 5,000\text{ ms}$; `AbortError` or timeout timer |
| **`RATE_LIMITED`** | Endpoint rejected request due to rate limit | HTTP 429 status; error message containing `rate limit`, `over rate`, `exceeded limit` |
| **`CONNECTION_ERROR`** | Physical transport or socket drop | `ECONNREFUSED`, `ECONNRESET`, WebSocket error/close event prior to response |
| **`RPC_ERROR`** | Node returned structured JSON-RPC error | Payload containing `error: { code, message }` (e.g. invalid params, revert) |

---

## 4. Quote Freshness Classification

To eliminate the methodological ambiguity audited in Phase 4.14.1, all DEX quote states are classified into four mutually exclusive categories:

1. **`FRESH_ONCHAIN_QUOTE`**:
   - A quote obtained directly from an active `eth_call` execution.
   - Accompanied by request monotonic start, response monotonic end, block number, and block hash.
   - ONLY this population may be used for latency or contemporaneity analysis.
2. **`CACHED_ONCHAIN_QUOTE`**:
   - A previously obtained on-chain quote reused for subsequent evaluations.
   - Must be labeled `[CACHED]` and strictly segregated from fresh latency benchmarks.
3. **`SIMULATED_QUOTE`**:
   - A quote computed via local mathematical model without querying node state.
   - Must be labeled `[SIMULATED]` and excluded from authentic opportunity counts.
4. **`MISSING_QUOTE`**:
   - Absence of valid DEX pricing due to network failure, timeout, or rate limiting.

---

## 5. Measured Operation Semantics

The measured metric in Phase 4.15 is the:
$$\text{Combined RPC transport and on-chain state simulation / QuoterV2 call latency}$$

It represents:
1. Local serialization of JSON-RPC `eth_call` with QuoterV2 calldata.
2. Client-to-node network transit.
3. Node EVM execution of `QuoterV2.quoteExactInputSingle`.
4. Node-to-client response network transit.
5. Local deserialization and ABI decoding.

It is NOT "block confirmation," as no state transition or block sealing is executed during read-only view calls.
