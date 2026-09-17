# PHASE 4.13A.1: Local Event Pipeline Timing & Internal Latency Benchmarks

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL DATA**: `scanner/data/temporal_forensics_phase413a1_results.json`  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED  

---

## 1. Local Monotonic Timing Model

Once an on-chain event is delivered to SAHIKARA, the local processing pipeline proceeds through distinct internal stages, all instrumented using `process.hrtime.bigint()` in nanoseconds:

```
[Event Arrives at Client]
          │
          ▼  (Event Decode Latency: < 10 microseconds)
[Decoded Event / Topics Identified]
          │
          ▼  (Route Lookup Latency: < 2 microseconds)
[Affected Routes Extracted from Index]
          │
          ▼  (Multi-Leg Quote Latency: ~16.19 ms)
[Leg 1 & Leg 2 Quotes Complete]
          │
          ▼  (Economic Evaluation Latency: < 2 microseconds)
[Gross Spread / Net Profit Calculated & Stage 10 Gate Evaluated]
```

---

## 2. Empirical Benchmark Measurements ($N = 100$)

Measurements captured during controlled benchmarking in `run-phase4-13a1-forensics.ts`:

| Pipeline Stage | Monotonic Timestamp Span | Min | Median | p95 | Max | Mean | Clock Domain |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Event Log Decoding** | $T_6 - T_5$ | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.000\text{ ms}$ | $0.001\text{ ms}$ | $0.000\text{ ms}$ | `LOCAL_MONOTONIC` |
| **Affected Route Lookup** | $T_7 - T_6$ | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.001\text{ ms}$ | $0.002\text{ ms}$ | $0.000\text{ ms}$ | `LOCAL_MONOTONIC` |
| **Multi-Leg Quote Query** | $T_9 - T_8$ | $15.45\text{ ms}$ | **$16.19\text{ ms}$** | $29.54\text{ ms}$ | $30.11\text{ ms}$ | $19.82\text{ ms}$ | `LOCAL_MONOTONIC` |
| **Economic Math Evaluation**| $T_{10} - T_9$ | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.001\text{ ms}$ | $0.001\text{ ms}$ | $0.000\text{ ms}$ | `LOCAL_MONOTONIC` |
| **Total Local Pipeline** | $T_{10} - T_5$ | $15.47\text{ ms}$ | **$16.21\text{ ms}$** | $29.56\text{ ms}$ | $30.13\text{ ms}$ | $19.84\text{ ms}$ | `LOCAL_MONOTONIC` |

*Note on microsecond precision*: In Node.js V8 runtime, in-memory Map lookup and integer arithmetic execute in under $2\text{ microseconds}$ ($0.002\text{ ms}$), rounding to $0.000\text{ ms}$ at 3 decimal places.

---

## 3. Analysis & Key Conclusions

1. **Local Compute is NOT a Bottleneck**:
   - Decoding logs, indexing affected routes, calculating Constant Product AMM output, and evaluating fees/gas hurdles require $<20\text{ microseconds}$ of total CPU time.
   - The engine's internal latency contributes virtually zero delay to opportunity detection.

2. **Network Quoting Dominates Local Duration**:
   - The only non-trivial component of the decision pipeline is querying pool state (multicall or adapter quote), requiring $\approx 16.19\text{ ms}$ (median) over local fast connections.

3. **Total Local Pipeline Concludes in $\approx 16.2\text{ ms}$**:
   - From the exact nanosecond an event callback is triggered in the Node.js event loop, SAHIKARA completes all multi-hop route calculations and economic gate validations within $16.21\text{ ms}$.
   - Any perceived multi-second latency exists entirely outside the local execution engine (in sequencer block-time quantization and public RPC network transport).
