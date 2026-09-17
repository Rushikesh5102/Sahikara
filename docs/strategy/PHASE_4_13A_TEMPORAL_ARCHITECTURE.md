# PHASE 4.13A — TEMPORAL ARCHITECTURE & LATENCY INSTRUMENTATION

> **STATUS**: RESEARCH DOCUMENTATION COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **EXECUTION ENGINE**: LOCKED  
> **PHASE 5 GATE**: STRICTLY BLOCKED  

---

## 1. Architectural Overview

The Phase 4.13A temporal architecture instruments the end-to-end lifecycle of on-chain state changes, from the moment a block is produced on an EVM network through event emission, local reception, log decoding, affected-route indexing, quote execution, and economic evaluation.

```
+-----------------------------------------------------------------------------------+
|                            ON-CHAIN CONSENSUS STATE                               |
|  Block N Produced (timestamp: t_block) -> Log Emitted (txIndex, logIndex)        |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Network Propagation / RPC Polling (t_rpc)
                                         v
+-----------------------------------------------------------------------------------+
|                         SAHIKARA INGESTION PIPELINE                               |
|  1. Event Received (t_receive, monotonic ns)                                      |
|  2. Event Decoded (t_decode) -> Log signature parsed (Swap / Sync / Mint)         |
|  3. Affected Route Index Lookup (t_route) -> Identifies active routes             |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Async Multi-Adapter Quoting (t_quote)
                                         v
+-----------------------------------------------------------------------------------+
|                        ECONOMIC EVALUATION & SIGNAL GATE                          |
|  4. Quote Responses Aggregated -> Leg 1 Out, Leg 2 Out, Leg 3 Out                |
|  5. Net Profit & Risk Buffer Evaluated (t_eval)                                   |
|  6. Signal Gating & Anomaly Quarantine (ANOMALY_QUARANTINED if > 1000 bps)        |
|  7. Opportunity Persistence Tracking (t_requote on N+1)                           |
+-----------------------------------------------------------------------------------+
```

---

## 2. Decoupling of the Three Latencies

To maintain scientific rigor and avoid false attributions (Directive 4), three distinct latencies are isolated:

### A. Network RPC Latency ($L_{\text{rpc}}$)
$$\Delta t_{\text{rpc}} = t_{\text{response}} - t_{\text{request}}$$
Measures the physical transport round-trip time between the local node and the public RPC provider. Evaluated via lightweight sequential `getBlockNumber()` pings.

### B. Observation / Detection Latency ($L_{\text{obs}}$)
$$\Delta t_{\text{obs}} = t_{\text{local\_receive}} - t_{\text{block\_header}}$$
Measures the delay between the miner/sequencer block header timestamp and the receipt of the block/log locally. Represents public propagation lag.

### C. Economic Evaluation Latency ($L_{\text{eval}}$)
$$\Delta t_{\text{eval}} = t_{\text{eval\_complete}} - t_{\text{local\_receive}}$$
Measures the local computational and quote retrieval duration:
$$\Delta t_{\text{eval}} = \Delta t_{\text{decode}} + \Delta t_{\text{lookup}} + \Delta t_{\text{quote}} + \Delta t_{\text{math}}$$

---

## 3. High-Resolution Monotonic Instrumentation

Standard JavaScript `Date.now()` is susceptible to system clock drift, NTP adjustments, and low granularity ($\pm 1–15\text{ ms}$ on Windows). Phase 4.13A implements monotonic nanosecond timing via `process.hrtime.bigint()` in `HighResolutionTimeline.ts`:

- Monotonically increasing: Guaranteed $\Delta t \ge 0$.
- Nanosecond resolution: Tracks micro-operations (e.g. log decoding in $0.005\text{ ms}$, route lookup in $0.002\text{ ms}$).
- Converted to high-precision floating-point milliseconds for reporting.

---

## 4. Event-to-Route Mapping Pipeline

Rather than re-evaluating the entire 300-route universe upon every state transition, the `AffectedRouteIndex` maps:
$$\text{Event Log} \implies \text{Pool Address} \implies \mathcal{R}_{\text{affected}} \subset \mathcal{R}_{\text{total}}$$

For a monitored 2-hop pool, the affected subset consists of only the 2 to 4 routes that traverse that specific liquidity pair. This decouples quote volume from universe size and achieves a $>97\%$ reduction in unnecessary RPC calls.

---

## 5. Intra-Block Ordering Model

When multiple swaps occur within a single block $N$, the ordering model deterministically reconstructs the sequence:
$$\text{Sequence Key} = \langle \text{blockNumber}, \text{transactionIndex}, \text{logIndex} \rangle$$

Events are sorted chronologically:
$$e_1 < e_2 \iff (\text{txIndex}_1 < \text{txIndex}_2) \lor (\text{txIndex}_1 = \text{txIndex}_2 \land \text{logIndex}_1 < \text{logIndex}_2)$$

This establishes event-order reconstruction (`EVENT_SEQUENCE_RECONSTRUCTION`) without falsely claiming intermediate EVM storage state.
