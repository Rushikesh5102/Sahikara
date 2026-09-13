# PROJECT_STATE.md — Canonical Project State

> **CANONICAL SINGLE SOURCE OF TRUTH**: This document tracks the active operational state, phase milestones, resource allocations, and safety flags of the SAHIKARA project. It must be consulted and updated whenever project state changes.

---

## 1. Executive Summary

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Current Phase** | **PHASE 1D — Pre-Run Audit Complete / Runbook Validated** | Phase 1D authorized; Final Pre-Run Audit complete; Runbook hardened |
| **Current Status** | **PHASE 1D RUNBOOK READY / 72-HOUR RUN NOT STARTED** | SQLite-safe backup (`VACUUM INTO`) tested; Idempotency uniqueness index added; Error accounting clarified; Duplicate-integrity verified; Short validation passed; awaiting operator start instruction for 72h collection. |
| **Live Trading** | **DISABLED** | Structurally impossible — observer is read-only; zero signing code |
| **Development Wallet** | **Not Created** | Eligible in Phase 0/early Phase 1; strictly for dev/testnet; ₹0 meaningful funds; zero keys committed/pasted |
| **Production Wallet** | **No production wallet** | Strictly deferred to Phase 7/8; dedicated SAHIKARA wallet |
| **Production Capital** | **₹0.00** | No live funds allocated |
| **Experimental Target Capital** | **₹100.00** | Reserved for Phase 8 gated experiment |
| **Active Target Chain** | **Base (Primary Provisional)** | Polygon PoS (Secondary Provisional); Arbitrum & OP Mainnet (Secondary Candidates) |
| **Target DEXs** | **Base: Aerodrome & Uniswap (Primary)** | Secondary: PancakeSwap; Polygon: Uniswap & QuickSwap; All active pools verified on-chain |
| **Current Blockers** | **72-Hour Collection Start Command** | Pre-run audit complete, runbook and collector hardening validated; awaiting operator start instruction |
| **Last Updated** | **2026-09-14** | Phase 1D Final Pre-Run Audit Complete — 72-hour collection NOT STARTED |

---

## 2. Milestone Progress Tracker

- [x] **Repository Setup**: Initialized Git repository and root `.gitignore`.
- [x] **Project Brain Architecture**: Established all 17 root Project Brain files.
- [x] **Directory Hierarchy**: Established empty functional directories with `.gitkeep` anchors.
- [x] **Phase 0 Exit Gate**: Verification of documentation, memory model, and risk policies complete.
- [/] **Phase 1: Market & DEX Research**: **IN PROGRESS**
  - [x] Phase 1A: Research framework initialized (9 strategy dossiers)
  - [x] Phase 1B: Verified research — Base as primary environment (DEC-010), economics corrected
  - [x] Phase 1C: Read-only observation engine built (scanner/)
  - [x] Phase 1C.1: On-chain protocol configuration & contract verification complete (Uniswap V3 + Aerodrome factory fees)
  - [x] Phase 1C.2: Economic quote correctness & bidirectional cross-DEX round-trip evaluation (WETH/USDC UniV3 ↔ Aero)
  - [x] Phase 1C.2.1: Final economic correctness audit (fee double-counting eliminated, block integrity verified, valuation layer decoupled)
  - [/] Phase 1D: Final pre-run audit complete, SQLite safe backup validated, idempotency index enforced, duplicate integrity verified (0 duplicates), short validation passed (72-hour collection NOT STARTED)
- [ ] **Phase 2 Initiation**: Real-time Arbitrage Scanner development.
- [ ] **Phase 3 Initiation**: Profitability Simulator engine implementation.
- [ ] **Phase 4 Initiation**: Live Paper Trading validation.
- [ ] **Phase 5 Initiation**: Atomic Arbitrage Smart Contract development.
- [ ] **Phase 6 Initiation**: Public Testnet deployment and automated testing.
- [ ] **Phase 7 Initiation**: Security Audit, fuzz testing, and operational runbook dry run.
- [ ] **Phase 8 Initiation**: Controlled ₹100 Mainnet experiment.
- [ ] **Phase 9 Initiation**: 24/7 Resilient node and automated execution deployment.
- [ ] **Phase 10 Initiation**: Scaling, multi-DEX, flash liquidity, and cross-chain research.

---

## 3. Current Workstream

### Completed Task
- **Task ID**: `TASK-003.0`
- **Objective**: Phase 1D Execution Runbook, Collector Hardening & Final Pre-Run Audit.
  - Corrected documentation on fee-spread friction decomposition.
  - Implemented SQLite-safe online backup via native `VACUUM INTO` (`npm run backup`) replacing raw `Copy-Item`. Tested backup creation and independent restoration integrity.
  - Refined observation identity: removed timestamp from `observation_id` (`chain:route:tradeSize:block`), preserving timestamp as data. Enforced unique index `(route, amount_in, block_number)` on round trips with `INSERT OR IGNORE`.
  - Investigated 30 historical setup errors (from early Phase 1C configuration); clarified health reporting to distinguish `recentErrors` (last 1h) from `historicalErrors`.
  - Built and ran duplicate-integrity validation: 0 duplicate one-way observations, 0 duplicate round-trip observations found.
  - Verified round-trip economics: quoted swap fees are not double-counted.
  - Created `npm run health` command for instant read-only health checks.
  - Completed short controlled validation run (2 live cycles on Base blocks `51271134` & `51271139`, row counts grew, 0 errors, clean shutdown, restart validated).
  - 99/99 tests pass, 0 lint errors, 0 typecheck errors, clean build, 15/15 security checks pass.
- **Assigned To**: Antigravity (Assistant) & Human Operator.
- **Status**: **COMPLETE** — RUNBOOK READY. 72-HOUR RUN NOT STARTED.

### Next Task (Awaiting Operator Execution Trigger)
- **Task ID**: `TASK-003.1`
- **Objective**: Phase 1D — Launch official 72-hour continuous empirical data collection run on Base mainnet.
- **Dependencies**: Phase 1D runbook, collector hardening, and pre-run audit fully validated.
- **Status**: READY FOR OPERATOR COMMAND TO LAUNCH 72-HOUR RUN.

### Next Immediate Actions
1. Await operator's explicit instruction to begin 72-hour collection
2. Operator launches collector via: `cd scanner && npm run observe` (or background task as documented in runbook)
3. Periodic health monitoring via: `npm run health`
4. Periodic online backups via: `npm run backup`
5. After 72h: query SQLite for spread distribution; update EXPERIMENTS.md
5. After 72h: query SQLite for spread distribution; update EXPERIMENTS.md

---

## 4. Operational Safety Metrics

| Metric | Target / Boundary | Current State | Status |
| :--- | :--- | :--- | :--- |
| **Active Private Keys** | 0 | 0 (Dev keys strictly forbidden from Git/AI tools; Prod keys deferred to Phase 7/8) | SECURE |
| **Live Contract Deployments**| 0 | 0 | SECURE |
| **Simulated Win Rate** | N/A (Phase 3+) | N/A | PENDING |
| **Max Single Trade Loss** | ₹0.00 | ₹0.00 | LOCKED |
| **Consecutive Failures** | 0 | 0 | NOMINAL |
| **Kill Switch State** | ARMED / TRIPPED | ACTIVE (LOCKDOWN) | LOCKED |
