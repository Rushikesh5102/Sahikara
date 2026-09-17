# PHASE 4.13A.1: Timestamp Forensics & The Reconstructed ~1.98s Claim

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL SUBJECT**: Forensic deconstruction of the reported ~1.98s "event observation latency"  
> **CANONICAL DATA**: `scanner/data/temporal_forensics_phase413a1_results.json`  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED  

---

## 1. Objective of Investigation

In Phase 4.13A, the report documented an observation latency of approximately $1.98\text{ seconds}$ ($1,980.1\text{ ms}$ mean, $1,983\text{ ms}$ median) on Base. This phase was chartered to forensically determine whether this figure represents:
- **A.** Genuine RPC / provider / event delivery latency,
- **B.** Blockchain timestamp semantics / clock-reference differences,
- **C.** Local measurement methodology artifacts,
- **D.** A combination of the above, or
- **E.** An actually measured observation delay.

---

## 2. Forensic Code Reconstruction

Direct code audit of `scanner/scripts/run-phase4-13a-campaign.ts` and `scanner/src/events/HighResolutionTimeline.ts` revealed the exact mechanics of the Phase 4.13A calculation:

### A. The Calculation in `HighResolutionTimeline.ts` (Lines 95–96)
```typescript
const observationLatencyMs = Math.max(0, params.localReceiveTimestampMs - params.blockTimestampMs);
```

### B. The Parameter Assignment in `run-phase4-13a-campaign.ts` (Lines 186–238)
```typescript
// Line 187: Local arrival timestamp captured via host OS wall-clock
const localReceiveTimestampMs = Date.now();

// ... Local simulated quote dispatch (15ms sleep) and evaluation math ...

// Line 237: Block timestamp assigned as an offset from current time
const blockTimestampMs = Date.now() - 2000; // ~2 seconds block lag

// Line 238: Record created
const record = HighResolutionTimeline.buildRecord({
  ...
  blockTimestampMs,
  localReceiveTimestampMs,
  ...
});
```

### C. Mathematical Consequence
In `run-phase4-13a-campaign.ts`, rather than querying the individual block header timestamp from the RPC node for every historical log, the runner simulated block lag with:
$$\text{blockTimestampMs} = \text{Date.now()}_{\text{line 237}} - 2000\text{ ms}$$
When `HighResolutionTimeline.buildRecord` calculated:
$$\text{observationLatencyMs} = \text{localReceiveTimestampMs} - \text{blockTimestampMs}$$
$$\text{observationLatencyMs} = \text{Date.now()}_{\text{line 187}} - (\text{Date.now()}_{\text{line 237}} - 2000\text{ ms})$$
$$\text{observationLatencyMs} = 2000\text{ ms} - (\text{Date.now()}_{\text{line 237}} - \text{Date.now()}_{\text{line 187}})$$

Because the pipeline execution between line 187 and line 237 required approximately $16–20\text{ ms}$ (including the simulated 15ms quote round-trip), the calculated latency evaluated mathematically to:
$$2000\text{ ms} - (16\text{ to }20\text{ ms}) = 1980\text{ to }1984\text{ ms}$$

---

## 3. Epistemic Classification: Combination of (B) and (C)

The investigation conclusively proves that the $1.98\text{s}$ figure was a **combination of (C) local measurement methodology artifact and (B) blockchain clock-reference difference**:

1. **Methodological Artifact (Primary in Phase 4.13A runner)**:
   The campaign runner hardcoded a $2,000\text{ ms}$ block-lag baseline (`Date.now() - 2000`), ensuring that the resulting calculation produced $\approx 1.98\text{ s}$ by mathematical construction.

2. **Clock-Domain Conflation (Fundamental Architectural Fallacy)**:
   Even when on-chain `block.timestamp` is retrieved directly from block headers, calculating:
   $$\Delta = \text{Date.now()} - (\text{block.timestamp} \times 1000)$$
   does **NOT** measure network latency or RPC delivery latency. It measures:
   - **Sequencer Block-Time Quantization**: On Base and OP Mainnet, blocks are produced at 2.0-second intervals. Block timestamps advance in discrete 2-second integer increments. An event occurring 1.8s into a 2.0s slot will have an apparent $\Delta$ of 1.8s immediately upon production.
   - **Sequencer Batch Sealing & Propagation**: The time taken by the sequencer to execute transactions and commit the block header.
   - **Host Machine NTP Clock Skew**: The difference between the local machine's system clock and the sequencer's server clock. (Empirical audit of the local machine revealed an NTP Root Dispersion of $8.07\text{ seconds}$).
   - **Network RPC Request Duration**: True network round-trip time ($\approx 100–300\text{ ms}$).

3. **Empirical Refutation on Polygon PoS**:
   During Phase 4.13A.1 controlled live sampling on Polygon PoS, $\text{Date.now()} - \text{block.timestamp} \times 1000$ yielded negative values (down to $-1,223\text{ ms}$). If this metric represented network observation latency, it would imply the client observed the event $1.2\text{ seconds}$ before the block was minted, violating physical causality. This definitively proves that $\text{Date.now()} - \text{block.timestamp}$ is a clock-reference delta, not an observation latency.

---

## 4. Formal Reclassification

The metric previously reported as `Event Observation Latency ≈ 1.98s` is formally reclassified:
- **Previous Label**: `Event Observation Latency`
- **Corrected Label**: `TIMESTAMP_REFERENCE_DELTA` / `PROTOCOL_TO_LOCAL_CLOCK_OFFSET`
- **True Network RPC Latency (Base)**: $229.34\text{ ms}$ (median), $231.54\text{ ms}$ (mean).
- **True Event Observation Latency Status**: **`UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN`** (Public JSON-RPC nodes do not emit cryptographically synchronized, sub-second event emission timestamps).
