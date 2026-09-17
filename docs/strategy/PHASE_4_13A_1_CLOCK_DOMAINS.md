# PHASE 4.13A.1: Clock Domain Separation & Timing Principles

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL REFERENCE**: Architectural principles governing clock segregation  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED  

---

## 1. The Three Segregated Clock Domains

To prevent latency conflation and measurement artifacts, SAHIKARA establishes three strictly segregated, non-interchangeable clock domains:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLOCK DOMAIN TAXONOMY                           │
├────────────────────────┬───────────────────────┬───────────────────────┤
│ 1. PROTOCOL_TIME       │ 2. LOCAL_WALL_TIME    │ 3. LOCAL_MONOTONIC_TIME│
├────────────────────────┼───────────────────────┼───────────────────────┤
│ • Origin: Blockchain   │ • Origin: Host OS     │ • Origin: CPU Clock   │
│   Block Header         │   System Clock        │   (process.hrtime)    │
│ • Units: Integer Sec   │ • Units: Milliseconds │ • Units: Nanoseconds  │
│ • Quantization: 2s (L2)│ • Subject to NTP jump │ • Strictly Monotonic  │
│ • Proposer/Seq Clock   │ • Skew: Up to ~8s     │ • Immune to NTP skew  │
└────────────────────────┴───────────────────────┴───────────────────────┘
```

### 1. `PROTOCOL_TIME`
- **Source**: `block.timestamp` in Ethereum block headers.
- **Representation**: Unsigned integer seconds since Unix epoch ($1970\text{-}01\text{-}01\text{T}00:00:00\text{Z}$).
- **Semantics**: Set by the block proposer or sequencer at the moment of block construction.
- **Constraints**: On Base, Arbitrum One, and OP Mainnet, timestamps advance in discrete increments ($2.0\text{ s}$ on OP Stack rollups). They represent protocol state progression, not a synchronized physical stopwatch.

### 2. `LOCAL_WALL_TIME`
- **Source**: `Date.now()` / system real-time clock.
- **Representation**: Milliseconds since Unix epoch.
- **Semantics**: Calendar time maintained by the host machine operating system, periodically synchronized via NTP.
- **Constraints**: Subject to clock drift, leap seconds, manual user adjustments, and network time synchronization jumps. Windows Time Service status audit revealed an NTP Root Dispersion of $8.07\text{ seconds}$, introducing multi-second calibration uncertainty.

### 3. `LOCAL_MONOTONIC_TIME`
- **Source**: `process.hrtime.bigint()` or `performance.now()`.
- **Representation**: Nanoseconds elapsed since an arbitrary fixed starting point (e.g. machine boot or Node.js process initialization).
- **Semantics**: Monotonically increasing clock sourced directly from hardware high-resolution timers (TSC).
- **Constraints**: Guaranteed never to step backward, unaffected by NTP adjustments or timezone changes. **Mandatory for all local elapsed duration measurements.**

---

## 2. Invalidation of Cross-Domain Subtraction

### The Prohibited Calculation
$$\Delta = \text{Date.now()}_{\text{local}} - (\text{block.timestamp}_{\text{protocol}} \times 1000)$$

### Why Cross-Domain Subtraction Cannot Measure Latency
1. **Uncalibrated Reference Points**: `block.timestamp` is assigned by a remote server (e.g. Coinbase sequencer on AWS), while `Date.now()` is assigned by the local machine. Unless both clocks share an atomic synchronization mechanism (e.g. PTP IEEE 1588 with sub-microsecond GPS sync), the delta between them is dominated by relative clock skew.
2. **Quantization Artifacts**: On a 2-second block rollup, a block created at $t = 12.000\text{s}$ contains transactions executed between $t=10.000\text{s}$ and $t=12.000\text{s}$. If a transaction is processed at $t=10.050\text{s}$, its block timestamp is $12\text{s}$, producing an apparent negative lag of $-1.95\text{s}$ or an apparent positive lag depending on sequencer timestamp assignment policy.
3. **Physical Impossibility Test**: Live sampling on Polygon PoS produced $\Delta = -1,223\text{ ms}$. Interpreting $\Delta$ as network latency would imply faster-than-light causality.

---

## 3. Epistemic Rule Enforced in Code

All future timing telemetry in SAHIKARA must adhere to the following invariant:
- **RULE**: Local latency durations must be calculated strictly as:
  $$\text{Duration}_{\text{local}} = T_{\text{end\_monotonic}} - T_{\text{start\_monotonic}}$$
- **RULE**: Any comparison between local wall clock and protocol block timestamp must be classified as `TIMESTAMP_REFERENCE_DELTA` or `PROTOCOL_TO_LOCAL_CLOCK_OFFSET` with an explicit warning that it does not reflect network latency.
- **RULE**: If no external synchronized event-origin timestamp exists, `EVENT_OBSERVATION_LATENCY` must be reported as `UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN`.
