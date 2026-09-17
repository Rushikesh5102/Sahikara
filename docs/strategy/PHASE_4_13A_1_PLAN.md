# Implementation Plan: Phase 4.13A.1 — Temporal Measurement Forensics & Timestamp Validation

## Goal Description
Forensically validate the timing measurements reported by Phase 4.13A, with specific focus on dissecting the approximately 1.98-second "event observation latency" claim. We will establish whether this figure represents genuine network/event-delivery delay, blockchain protocol timestamp semantics/clock drift, local measurement methodology artifacts, or an invalid cross-domain calculation.
We will formalize three distinct clock domains (`PROTOCOL_TIME`, `LOCAL_WALL_TIME`, `LOCAL_MONOTONIC_TIME`), prevent cross-domain subtraction without synchronization, instrument real HTTP/WS latency benchmarking, and publish all required forensic strategy dossiers and validation tests.

## User Review Required
> [!IMPORTANT]
> - Capital at risk remains strictly **₹0.00 / $0.00**.
> - Execution engine remains strictly **LOCKED**.
> - **Phase 5 remains strictly BLOCKED**.
> - No live transaction broadcasting, no wallets, no private keys, no signers, no smart contract deployments.
> - Research and forensic audit only.

## Proposed Changes

### 1. Forensic Audit of Phase 4.13A Timing Implementation
- Analyze `scanner/scripts/run-phase4-13a-campaign.ts` and `scanner/src/events/HighResolutionTimeline.ts`.
- Reconstruct the exact origin of the 1.98-second figure:
  - Line 237: `const blockTimestampMs = Date.now() - 2000;`
  - Line 96: `const observationLatencyMs = Math.max(0, params.localReceiveTimestampMs - params.blockTimestampMs);`
  - In addition, inspect how subtracting `block.timestamp` from local machine wall clock (`Date.now() - block.timestamp * 1000`) conflates protocol block generation timestamps with local client arrival, suffering from NTP clock drift, sequencer quantization (2s block times), and uncalibrated clock references.

### 2. Architectural Components (`scanner/src/events/`)
- **`ClockDomainManager.ts`**:
  - Defines strict types for `ProtocolTimestamp`, `LocalWallTimestamp`, and `LocalMonotonicTimestamp`.
  - Disallows raw cross-domain arithmetic; provides explicit `calculateReferenceDelta()` for diagnostic purposes only, clearly distinguishing it from network latency.
  - Classifies `EVENT_OBSERVATION_LATENCY` as `UNMEASURABLE` when no synchronized event-origin reference exists on public RPCs.
- **`TemporalMeasurementForensics.ts`**:
  - Implements the formal T0–T11 timing event model.
  - Measures true HTTP RPC request/response duration (`requestStartMonotonic -> responseReceivedMonotonic`) using `process.hrtime.bigint()` / `performance.now()`.
  - Executes live comparative probes across public endpoints (`eth_getBlockByNumber`, `eth_getLogs`, `eth_call`, `eth_blockNumber`) with adequate statistical sampling ($N \ge 20$).
  - Evaluates WebSocket `newHeads` and `logs` callbacks on Base vs. HTTP polling for same-block arrival.
  - Produces raw timing records with `null` for unavailable values (zero synthetic timestamps).

### 3. Test Suite (`scanner/tests/`)
- **`phase413a1Forensics.test.ts`**:
  - Deterministic tests verifying monotonic timing preservation.
  - Clock-domain separation: ensures compile-time/runtime guards against invalid `Date.now() - block.timestamp` as network latency.
  - Verification that unavailable metrics are stored as `null` rather than `0` or fake numbers.
  - Same-block matching across WS and HTTP by block hash.
  - Correct calculation of HTTP request duration and internal local pipeline stages.
  - Token order regression from Phase 4.12.
  - Security invariants (zero private keys, zero signers, ₹0.00 capital).

### 4. Empirical Benchmark Script (`scanner/scripts/`)
- **`run-phase4-13a1-forensics.ts`**:
  - Runs controlled HTTP and WS benchmark across Base, Arbitrum One, Optimism, and Polygon PoS.
  - Measures request/response distributions (min, p25, median, p75, p90, p95, p99, max, mean).
  - Queries local NTP/system clock status.
  - Stores canonical results in `scanner/data/temporal_forensics_phase413a1_results.json`.

### 5. Documentation (`docs/strategy/`)
- `docs/strategy/PHASE_4_13A_1_PLAN.md`
- `docs/strategy/PHASE_4_13A_1_TIMESTAMP_FORENSICS.md`
- `docs/strategy/PHASE_4_13A_1_CLOCK_DOMAINS.md`
- `docs/strategy/PHASE_4_13A_1_HTTP_LATENCY.md`
- `docs/strategy/PHASE_4_13A_1_WEBSOCKET_LATENCY.md`
- `docs/strategy/PHASE_4_13A_1_EVENT_TIMING.md`
- `docs/strategy/PHASE_4_13A_1_CHAIN_TIMESTAMP_RESEARCH.md`
- `docs/strategy/PHASE_4_13A_1_RESULTS.md`
- `docs/strategy/PHASE_4_13A_1_FINAL_REPORT.md` (31 required sections)

### 6. Project Brain Updates
- `PROJECT_STATE.md`
- `DECISIONS.md` (`DEC-040`)
- `EXPERIMENTS.md` (`EXP-014`)
- `LESSONS_LEARNED.md` (`INC-016`)
- `CHANGELOG.md` (`[0.14.1] - 2026-09-17`)

## Verification Plan
1. `npm test` (all test suites passing, including new forensics tests).
2. `npm run typecheck` (zero TypeScript errors).
3. `npm run lint` (zero ESLint errors/warnings).
4. `npm run build` (successful compilation).
5. `npm run lint:security` (15/15 security tests passing).
6. `npm run health` (clean system state).
7. Git commit: `phase4.13a.1: temporal measurement forensics`.
8. Git push to `origin main` and verify clean working tree.
