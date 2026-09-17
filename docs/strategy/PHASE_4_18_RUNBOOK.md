# PHASE 4.18 — CONTINUOUS SHADOW DETECTION RUNBOOK

> **OPERATIONAL INSTRUCTIONS FOR OPERATORS & RESEARCHERS**  
> **RUNTIME MODE**: Read-Only Observation & Forensic Telemetry  
> **CAPITAL BOUNDARY**: ₹0.00 / $0.00

---

## 1. Prerequisites & Environment Verification

Before running any shadow campaign or verification script:

1. **Verify Operating Phase & Capital Directive**:
   - Confirm active milestone is Phase 4.18.
   - Phase 5 remains strictly BLOCKED.
   - Verify environment contains no live private keys, mnemonics, or broadcast credentials.

2. **Network Connection**:
   - Base Mainnet RPC endpoint: `https://mainnet.base.org` (or configured custom backup).
   - Ensure latency is acceptable (< 500 ms).

---

## 2. Standard Commands

From the `scanner/` directory:

### 2.1 Automated Quality & Security Verification
```bash
# 1. Run complete unit and integration test suite (39 test files, 447 tests)
npm test

# 2. Verify static type safety
npm run typecheck

# 3. Verify code hygiene and stylistic consistency
npm run lint

# 4. Compile TypeScript build output
npm run build

# 5. Execute AST security scan across all 110 source files
npm run lint:security

# 6. Check database integrity and telemetry status
npm run health
```

### 2.2 Running the Bounded Live Shadow Campaign
```bash
# Execute the live Base Mainnet campaign runner
node --experimental-vm-modules "node_modules/tsx/dist/cli.mjs" scripts/run-phase4-18-shadow-campaign.ts
```

---

## 3. Interpreting Output & Telemetry

### 3.1 Verification Discrepancy
```
  Local Predicted Leg 1 (WETH->USDC): 2454007702 atomic units
  RPC QuoterV2 Leg 1 (WETH->USDC):    2454007702 atomic units
  Delta:                              0 (0.0000 bps drift)
  Discrepancy Classification:         EXACT
```
- `EXACT` (0 bps drift): Complete parity between local tick math and QuoterV2.
- `SUB_BPS_DRIFT` ($\le 1.0$ bps): Acceptable rounding / tick crossing divergence.
- `MATERIAL_DRIFT` (> 5.0 bps): Investigate missing ticks or stale pool state.

### 3.2 RPC Efficiency Metrics
- `RPC Calls Avoided`: Count of candidates filtered locally by economic gates without consuming external RPC quotas.
- `Avoided-to-Sent Ratio`: Demonstrates computational saving from local state screening.

### 3.3 Sample Independence
- `Raw Observations`: Total event cycles observed.
- `Unique Market States`: Distinct price/reserve state combinations.
- `Redundancy Factor`: Ratio of raw observations to unique states (measures market quiescence / repeated polling).

---

## 4. Emergency & Failure Response

| Failure Scenario | Classification | Action |
| :--- | :--- | :--- |
| Public RPC Rate Limit (429 / -32016) | `RPC_RATE_LIMIT` | `retryRead` performs exponential backoff; switch to backup RPC if persistent. |
| Incomplete Tick State | `MISSING_TICK` | Pipeline marks state `INCOMPLETE` / `RESYNC_REQUIRED` and fails closed. |
| Reorg / Hash Mismatch | `REORG` | Pool state invalidated; resync required from latest block. |
| Negative Expected PnL | `ECONOMICS_REJECT` | Normal operation. Candidate logged and discarded prior to RPC verification. |
