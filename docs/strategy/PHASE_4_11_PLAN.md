# PHASE 4.11 PLAN — FULL ROUTE COVERAGE & DEX ADAPTER FORENSICS

**Phase ID:** `PHASE_4_11`  
**Date:** 2026-09-17  
**Status:** ACTIVE EXECUTION  
**Execution Engine:** STRICTLY LOCKED  
**Capital at Risk:** ₹0.00 / $0.00  
**Phase 5 Gate:** STRICTLY BLOCKED  

---

## 1. Context & Motivation

Phase 4.10 successfully expanded the monitored DEX ecosystem across 8 protocols (Curve, Balancer v2, Camelot v2, Velodrome v2, QuickSwap v2, SushiSwap v2, Uniswap v3, Aerodrome) and 4 chains (Base, Arbitrum One, Optimism, Polygon PoS), verifying 43 active pools and generating 78 routes.

However, Phase 4.10 evaluated only a representative subset of 16 routes (128 evaluations). A representative subset is not an exhaustive test of the generated market universe. 

The objective of **Phase 4.11** is to:
1. Conduct an independent forensic audit of every DEX adapter.
2. Cross-check adapter pricing against authoritative on-chain protocol routers and quoters.
3. Test **every eligible generated route** across **8 trade sizes** ($1, $5, $10, $25, $50, $100, $250, $500), achieving 100% route coverage (624 nominal evaluations).
4. Verify whether previous "zero positive gross" findings survive exhaustive route coverage.

---

## 2. Safety Invariants

1. **Zero Capital at Risk**: Absolutely no live capital, wallets, or signers.
2. **Read-Only Operation**: All evaluations use static on-chain `eth_call` queries via Viem.
3. **Phase 5 Lock**: Phase 5 remains strictly BLOCKED until verified empirical profitability is established.
4. **Epistemic Honesty**: Zero observed opportunities must never be stated as "arbitrage is globally impossible."

---

## 3. Campaign Stages

- **STAGE A**: Baseline Reconstruction & Discrepancy Reconciliation.
- **STAGE B**: Route Inventory & Topology Verification (78 routes).
- **STAGE C**: DEX Adapter Forensics & Boundary Enforcement.
- **STAGE D**: Authoritative Protocol Quote Cross-Checks.
- **STAGE E**: Exhaustive Multi-Size Evaluation Campaign (78 routes × 8 sizes = 624 evaluations).
- **STAGE F**: Positive Signal Revalidation & Multi-Block Persistence Analysis.
- **STAGE G**: Granular Statistical Distribution Analysis (by chain, size, hop count).
- **STAGE H**: Final Forensic Review & Strategy Synthesis.
