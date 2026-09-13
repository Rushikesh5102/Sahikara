# PROJECT_STATE.md — Canonical Project State

> **CANONICAL SINGLE SOURCE OF TRUTH**: This document tracks the active operational state, phase milestones, resource allocations, and safety flags of the SAHIKARA project. It must be consulted and updated whenever project state changes.

---

## 1. Executive Summary

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Current Phase** | **PHASE 1C — Read-Only Market Observation Engine** | Phase 1C complete; observation engine built and ready to run |
| **Current Status** | **Phase 1C COMPLETE** | Observation engine built; ready for empirical data collection with a live RPC key |
| **Live Trading** | **DISABLED** | Structurally impossible — observer is read-only; zero signing code |
| **Development Wallet** | **Not Created** | Eligible in Phase 0/early Phase 1; strictly for dev/testnet; ₹0 meaningful funds; zero keys committed/pasted |
| **Production Wallet** | **No production wallet** | Strictly deferred to Phase 7/8; dedicated SAHIKARA wallet |
| **Production Capital** | **₹0.00** | No live funds allocated |
| **Experimental Target Capital** | **₹100.00** | Reserved for Phase 8 gated experiment |
| **Active Target Chain** | **Base (Primary Provisional)** | Polygon PoS (Secondary Provisional); Arbitrum & OP Mainnet (Secondary Candidates) |
| **Target DEXs** | **Base: Aerodrome & Uniswap (Primary)** | Secondary: PancakeSwap; Polygon: Uniswap & QuickSwap; No pool contracts finalized |
| **Current Blockers** | **Requires live Base RPC key to run** | Obtain free Alchemy key (see docs/infrastructure/BASE_RPC_SETUP.md) |
| **Last Updated** | **2026-09-13** | Phase 1C complete — read-only observation engine implemented |

---

## 2. Milestone Progress Tracker

- [x] **Repository Setup**: Initialized Git repository and root `.gitignore`.
- [x] **Project Brain Architecture**: Established all 17 root Project Brain files.
- [x] **Directory Hierarchy**: Established empty functional directories with `.gitkeep` anchors.
- [x] **Phase 0 Exit Gate**: Verification of documentation, memory model, and risk policies complete.
- [/] **Phase 1: Market & DEX Research**: **IN PROGRESS**
  - [x] Phase 1A: Research framework initialized (9 strategy dossiers)
  - [x] Phase 1B: Verified research — Base as primary environment (DEC-010), economics corrected
  - [x] Phase 1C: Read-only observation engine built (scanner/) — ready for empirical data collection
  - [ ] Phase 1D: Collect 72h+ of live observations; verify pool addresses on-chain; analyze spread distribution
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
- **Task ID**: `TASK-002`
- **Objective**: Phase 1C — Build read-only market observation engine for Base (Aerodrome ↔ Uniswap)
- **Assigned To**: Antigravity (Assistant) & Human Operator.
- **Status**: **COMPLETE** — All scanner/ source files, tests, and documentation created.

### Current Task
- **Task ID**: `TASK-003`
- **Objective**: Phase 1D — Run the observation engine against live Base mainnet; collect 72h+ of spread data; verify pool addresses on-chain against factory contracts; analyze spread distribution vs. viability threshold.
- **Dependencies**: Live Base RPC key (free Alchemy account). See `docs/infrastructure/BASE_RPC_SETUP.md`.
- **Status**: READY TO START — awaiting operator RPC configuration.

### Next Immediate Actions
1. Obtain free Alchemy Base RPC key
2. `cd scanner && cp .env.example .env` — fill in `BASE_RPC_URL`, `ETH_PRICE_USD`, `WETH_PRICE_USD`
3. `npm install && npm test` — verify all tests pass
4. `npm run observe` — start data collection
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
