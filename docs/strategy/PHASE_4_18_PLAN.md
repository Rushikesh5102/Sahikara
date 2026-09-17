# PHASE 4.18 — CONTINUOUS READ-ONLY SHADOW DETECTION PLAN

> **SCOPE & MANDATE**: Operational execution plan for Phase 4.18: Building and validating SAHIKARA's first continuous, integrated read-only shadow detection pipeline.
> **SAFETY DIRECTIVE**: 100% READ-ONLY. Zero private keys, zero wallets, zero signers, zero transaction broadcasting, zero CEX orders, zero capital movement. Capital deployed: strictly ₹0.00 / $0.00. Phase 5 remains STRICTLY BLOCKED.

---

## 1. Executive Summary & Problem Formulation

In Phase 4.16 and 4.17, SAHIKARA developed and hardened a production-grade local DEX state engine capable of exact mathematical parity with on-chain Uniswap V3 QuoterV2 and Aerodrome V2 `getAmountOut` models. However, these tests operated predominantly as isolated point-in-time micro-benchmarks or single-pool simulations.

Phase 4.18 bridges the research/architecture foundations of Phase 4 and the eventual Phase 5 execution engine by constructing the **Continuous Read-Only Shadow Detection Pipeline**. 

The fundamental scientific question addressed in Phase 4.18:
> *Can SAHIKARA operate a continuous, unified detection loop linking CEX market feeds, local DEX state tracking, microsecond candidate screening, economic/risk gating, authoritative on-chain RPC verification, and shadow outcome persistence—without dropping state integrity, violating sample independence, or leaking execution authority?*

---

## 2. Core Architectural Pipeline

The integrated pipeline operates strictly within the following pipeline stages:

```
          CEX OrderBook Feeds (Coinbase / Binance / Kraken)
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Market Data Snapshot  │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │    Local DEX State    │ (Uniswap V3 & Aerodrome V2)
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Local Candidate Engine│ (DEX-DEX & CEX-DEX)
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Economic & Risk Gates │ (Gas + Slippage + Hurdle)
                     └───────────┬───────────┘
                                 │
                     [Only Qualifying Candidates]
                                 ▼
                     ┌───────────────────────┐
                     │  Authoritative RPC    │ (QuoterV2 / getAmountOut)
                     │     Verification      │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Candidate Revalidator │ (Discrepancy / Drift Check)
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │  Shadow Outcome Model │ (Strictly SHADOW_ONLY)
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │  Forensic Persistence │ (12 Questions Answered)
                     └───────────────────────┘
```

**Cardinal Rule**: Local DEX state is strictly for candidate screening. Authoritative on-chain quotes are the mandatory, irreplaceable verification step for every qualifying candidate.

---

## 3. Strict Prohibitions & Safety Guarantees

Under no circumstances may Phase 4.18 code:
1. Handle, generate, import, or log private keys or seed phrases.
2. Instantiate `walletClient` or signers capable of broadcasting transactions.
3. Call `eth_sendRawTransaction`, `eth_sendTransaction`, `writeContract`, or CEX order submission endpoints.
4. Promote unvalidated state models (e.g. Aerodrome Slipstream CL) into the active candidate universe.
5. Manufacture artificial timestamps or claim clock synchronization across independent physical domains.
6. Deploy capital. Balance remains ₹0.00 / $0.00.

---

## 4. Key Deliverables

1. **Pipeline Implementation**:
   - `scanner/src/shadow/ShadowForensicTypes.ts`: Comprehensive types covering epistemic provenance, state health, candidate lifecycle, discrepancy classification, freshness classes, and the 12-question forensic record.
   - `scanner/src/shadow/ContinuousShadowPipeline.ts`: The unified continuous runner orchestrating CEX/DEX event ingestion, multi-notional candidate evaluation, economic filtering, authoritative Quoter verification, and sample independence tracking.
2. **Automated Verification Suite**:
   - `scanner/tests/phase418ContinuousShadow.test.ts`: 9 rigorous tests validating lifecycle transitions, state invalidation fail-closed mechanics, drift classification, zero-execution security invariants, and graceful shutdown.
3. **Live Campaign Runner**:
   - `scanner/scripts/run-phase4-18-shadow-campaign.ts`: Production campaign runner querying Base Mainnet contracts (`0xd0b53D...` and `0xcDAC0d...`) with resilient rate-limit backoff.
4. **Strategy Dossiers & Brain Updates**:
   - 5 comprehensive dossiers in `docs/strategy/`.
   - Complete project brain synchronization across all 10 core markdown files.
