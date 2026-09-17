# PHASE 4.13A — RESEARCH & IMPLEMENTATION PLAN
## Event-Driven Sub-Block, Ordering & Opportunity-Timing Research

> **STATUS**: ACTIVE / RESEARCH ONLY  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION ENGINE**: LOCKED  
> **PHASE 5 GATE**: STRICTLY BLOCKED  
> **EVIDENCE STANDARD**: Deterministic High-Resolution Telemetry & Sequencer Ordering Forensics

---

## 1. Executive Summary & Core Mission

Phase 4.11 and Phase 4.12 established that zero gross-positive and zero net-positive cross-DEX arbitrage opportunities existed across a combined universe of 137 verified pools (300 closed routes) on settled committed state.

**Phase 4.13A Core Mission**:
> *"Determine whether the absence of validated net-positive arbitrage in Phases 4.7–4.12 is materially explained by temporal market-state effects that the existing settled-block/public-RPC observation architecture cannot capture."*

This research phase investigates whether economically viable arbitrage spreads form and disappear between settled block observations, evaluates event-driven observation vs periodic scanning, assesses public pending transaction visibility, probes WebSocket capabilities, and analyzes the ordering/sequencing models across Base, Arbitrum One, Optimism, and Polygon PoS.

---

## 2. Absolute Safety Invariants

Under SAHIKARA Project Rules (Rules 1–18) and Risk Policy:
- **Capital at Risk**: STRICTLY ₹0.00 / $0.00.
- **Wallets & Signers**: Zero wallets, zero signers, zero private keys, zero mnemonics.
- **Transaction Broadcasting**: Strictly LOCKED and DISABLED.
- **Phase 5**: Strictly BLOCKED.

---

## 3. Epistemic Decoupling of the Three Latencies

To prevent flawed conclusions, Phase 4.13A strictly decouples and instruments three distinct latency tiers:

$$\begin{aligned}
\text{Network RPC Latency} &= t_{\text{response}} - t_{\text{request}} \\
\text{Observation Latency} &= t_{\text{local\_receive}} - t_{\text{block\_timestamp}} \\
\text{Economic Evaluation Latency} &= t_{\text{eval\_complete}} - t_{\text{local\_receive}}
\end{aligned}$$

Compound quote durations are never mislabeled as "RPC latency."

---

## 4. Workstreams & Investigation Modules

1. **Pre-Phase 4.12 Forensic Patch (Module 0)**:
   - Reconcile all 39 Phase 4.12 raw signals.
   - On-chain proof of Polygon V2 token-order/decimal inversion.
   - Adapter evidence classification (`MATCH` vs `IMPLEMENTATION_FORENSICS_PASS` / `INDEPENDENT_QUOTE_VALIDATION_OPEN`).
   - Permanent regression tests added.
2. **Temporal Pipeline & Monotonic Timing (Module 1)**:
   - Nanosecond-precision monotonic timing (`process.hrtime.bigint()`).
   - Granular breakdown: receive $\to$ decode $\to$ route lookup $\to$ quote $\to$ evaluation.
3. **Event-Driven vs Periodic Comparative Benchmark (Module 2)**:
   - Measure route evaluation volume, quote call reduction, and event-to-decision latency.
4. **WebSocket & Pending State Capability Probes (Module 3)**:
   - Probe free/public RPC support for `newHeads`, `logs`, and `pendingTransactions`.
5. **Sequencer & Ordering Research (Module 4)**:
   - Analyze transaction ordering architectures across Base, Arbitrum, Optimism, and Polygon.
   - Classify ordering evidence levels (LEVEL 0 through LEVEL 5).
6. **Intra-Block Ordering & Replay Limitations (Module 5)**:
   - Deterministic sorting via `transactionIndex` and `logIndex`.
   - Classification of replay capability (`BLOCK_STATE_REPLAY` vs `EVENT_SEQUENCE_RECONSTRUCTION`).
7. **Opportunity Formation & Lifetime (Module 6)**:
   - Measure spread persistence: `SINGLE_OBSERVATION`, `SUB_BLOCK_BOUND`, `ONE_BLOCK`, `MULTI_BLOCK`, `UNKNOWN`.
   - Detect cross-block drift (`leg1Block != leg2Block`).
8. **CEX-DEX Research Scoping (Module 7)**:
   - Author `PHASE_4_13B_CEX_DEX_RESEARCH_SCOPE.md` (research boundaries only, no accounts).

---

## 5. Deliverables Matrix

12 Strategy dossiers in `docs/strategy/`:
- `PHASE_4_13A_PLAN.md`
- `PHASE_4_13A_PHASE_4_12_FORENSIC_PATCH.md`
- `PHASE_4_13A_TEMPORAL_ARCHITECTURE.md`
- `PHASE_4_13A_EVENT_DRIVEN_RESULTS.md`
- `PHASE_4_13A_RPC_LATENCY.md`
- `PHASE_4_13A_PENDING_STATE_RESEARCH.md`
- `PHASE_4_13A_ORDERING_RESEARCH.md`
- `PHASE_4_13A_OPPORTUNITY_LIFETIME.md`
- `PHASE_4_13A_ECONOMIC_AUDIT.md`
- `PHASE_4_13A_RESULTS.md`
- `PHASE_4_13A_FINAL_REPORT.md` (37 formal required sections)
- `PHASE_4_13B_CEX_DEX_RESEARCH_SCOPE.md`
