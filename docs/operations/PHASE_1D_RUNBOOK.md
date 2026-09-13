# PHASE_1D_RUNBOOK.md — Long-Running Empirical Observation Runbook

> **TARGET PHASE**: PHASE 1D (Market & DEX Research — 72-Hour Empirical Data Collection)  
> **OPERATIONAL STATUS**: RUNBOOK VALIDATED | 72-HOUR COLLECTION NOT YET STARTED  
> **MODE**: STRICTLY READ-ONLY | ZERO CAPITAL | ZERO PRIVATE KEYS | ZERO TRANSACTIONS  
> **PRIMARY ENVIRONMENT**: Base Mainnet (Chain ID `8453`)

---

## 1. Executive Operational Overview

The Phase 1D market observation engine continuously polls live Base on-chain state via read-only `eth_call` queries to evaluate whether cross-DEX arbitrage opportunities occur between **Uniswap v3** and **Aerodrome (volatile & stable)**, and whether they are economically viable at small trade sizes ($1, $5, $10).

### Key Operational Constants
- **Default Poll Interval**: 30,000 ms (30 seconds)
- **Active Trade Sizes**: $1.00, $5.00, $10.00 (`[TEST FIXTURE]` token conversions)
- **Primary Routes**:
  - Route A: `WETH → Uniswap v3 (5 bps) → USDC → Aerodrome volatile (30 bps) → WETH`
  - Route B: `WETH → Aerodrome volatile (30 bps) → USDC → Uniswap v3 (5 bps) → WETH`
- **Database Location**: `scanner/data/observations.db` (SQLite + WAL mode)
- **Log Location**: `scanner/data/collector.log` (when daemonized/redirected)

---

## 2. Quick-Start Commands

All commands are executed from the `scanner/` directory.

### 2.1 Verify Prerequisites
```powershell
cd scanner
npm run typecheck
npm run lint
npm test
npm run build
```

### 2.2 Start the Collector (Interactive Mode)
```powershell
npm run observe
```
*Press `Ctrl+C` to initiate graceful shutdown.*

### 2.3 Start the Collector (Background Mode / Production)

#### On Windows (PowerShell Background Job):
```powershell
# Start background job writing to data/collector.log
Start-Job -Name SahikaraObserver -ScriptBlock {
  Set-Location "c:\Users\Rushi\Desktop\Projects\Websites\SAHIKARA — Autonomous DEX Arbitrage & Market Intelligence Engine\scanner"
  npm run observe 2>&1 | Tee-Object -FilePath "data/collector.log"
}
```

#### On Linux / WSL (systemd or nohup):
```bash
nohup npm run observe > data/collector.log 2>&1 &
echo $! > data/collector.pid
```

---

## 3. Graceful Shutdown & Process Termination

The engine handles `SIGINT` (Ctrl+C) and `SIGTERM` cleanly:
1. It flags `running = false`.
2. Any ongoing on-chain cycle completes its atomic database write.
3. The SQLite connection executes WAL checkpointing and `store.close()`.
4. The process terminates with exit code 0.

### Safe Termination Procedures

#### Interactive Session:
Press `Ctrl+C` once. Do not spam `Ctrl+C`, allowing the current cycle to commit cleanly:
```
[Observer] Received SIGINT. Initiating graceful shutdown...
[Observer] Shutting down...
[Observer] Database closed. Goodbye.
```

#### Background PowerShell Job:
```powershell
# Check running status
Get-Job -Name SahikaraObserver

# Stop gracefully
Stop-Job -Name SahikaraObserver
Remove-Job -Name SahikaraObserver
```

#### Direct Process Termination (Windows):
```powershell
# Identify process
Get-Process -Name node | Where-Object { $_.CommandLine -like "*src/index.ts*" }

# Stop process safely
Stop-Process -Id <PID>
```

---

## 4. Health Checks & Process Monitoring

### 4.1 Automated CLI Health Check
The engine provides a built-in read-only health inspector:
```powershell
npm run health
```

Example Output:
```
═══════════════════════════════════════════════════════════════
 SAHIKARA — Collector Health & Storage Status (Read-Only)
═══════════════════════════════════════════════════════════════
Database Path: ...\scanner\data\observations.db
Main DB Size:  216.00 KB
Total Disk:    216.00 KB

── Activity & Block Sync ──────────────────────────────────────
Last Round-Trip Block:     51270548
Last Round-Trip Timestamp: 2026-09-13T20:14:07.481Z (22s ago)
✅ Collector is actively observing.
Last One-Way Block:        51270548
Last One-Way Age:          23s ago

── Observation Statistics ─────────────────────────────────────
Total One-Way Quotes:       120
Total Round Trips:          18
Candidates (Gross > 0 & pass): 0
Rejected:                   18
Recorded Errors:            0
═══════════════════════════════════════════════════════════════
```

### 4.2 Verifying Observation Database Insertion
Inspect the most recent round-trip observations directly via SQLite:
```powershell
node -e "import('node:sqlite').then(m => { const db = new m.DatabaseSync('./data/observations.db'); console.log(db.prepare('SELECT block_number, route, gross_profit, gross_profit_usd, net_expected_profit, status, rejection_reason FROM round_trip_observations ORDER BY timestamp_ms DESC LIMIT 5').all()); db.close(); })"
```

---

## 5. Storage Growth Estimates & Data Retention

The collector runs with a 30-second polling cycle.
Each cycle records:
- 15 one-way pool quotes (5 active pools × 3 trade sizes)
- 6 round-trip evaluations (2 routes × 3 trade sizes)
- Total rows per cycle: **21 rows**
- Cycles per hour: **120 cycles**
- Total rows per hour: **2,520 rows**

### Growth Projections

| Duration | Expected Cycles | One-Way Rows | Round-Trip Rows | Total Rows | Estimated Disk Footprint |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1 Hour** | 120 | 1,800 | 720 | 2,520 | **~1.5 MB** |
| **24 Hours** | 2,880 | 43,200 | 17,280 | 60,480 | **~35 MB** |
| **72 Hours (Phase 1D Target)** | 8,640 | 129,600 | 51,840 | 181,440 | **~105 MB** |
| **7 Days** | 20,160 | 302,400 | 120,960 | 423,360 | **~245 MB** |

### Disk Safeguards
- The full 72-hour run requires only **~105 MB**, well within any standard machine threshold.
- SQLite WAL mode ensures database writes are non-blocking and crash-resilient.
- If disk space falls below 1 GB on the host drive, stop the collector immediately.

---

## 6. Error Handling & Recovery Protocols

### 6.1 RPC Failure Handling & Bounded Retry
- **Transient Network Glitches**: If an RPC query fails due to a network blip or rate-limit spike, the error is caught at the pool/quote level. Other pools continue observing.
- **Cycle-Level Failures**: If an entire block or gas price query fails, the cycle error counter increments.
- **Exponential Backoff**: Backs off by $30\text{s} \times 1.5^{n-1}$ (capped at 60s).
- **Max Consecutive Failures (Circuit Breaker)**: If **10 consecutive cycles** fail (e.g. invalid API key or extended outage), the collector halts gracefully rather than thrashing in an infinite loop.

### 6.2 Idempotency & Duplicate Observation Prevention
- **Logical Identity**:
  - One-way quotes: `(chain, protocol, pool_address, trade_size_usd, block_number)`
  - Round-trip evaluations: `(chain, route_id, trade_size_usd, block_number)`
- **Timestamp Handling**: Observation timestamp is preserved as dynamic data in `timestamp_ms`, but is **excluded** from `observation_id` to prevent identical observations from duplicate insertion if timestamps differ slightly across calls.
- **Database Constraints**:
  - `observation_id` is the primary key: `[chain, routeId, tradeSizeUsd, blockNumber].join(':')`
  - Unique index: `idx_rt_logical_unique ON round_trip_observations (route, amount_in, block_number)`
  - All inserts use `INSERT OR IGNORE`.
  - Duplicate integrity check is automated via `npm run health` and `store.checkDuplicateIntegrity()`.

### 6.3 SQLite-Safe Online Backup Strategy
> [!IMPORTANT]
> **Never use raw file copies (`Copy-Item` / `cp`) on an active WAL-mode SQLite database.** Raw copies risk capturing mismatched pages between the main `.db` and the `.db-wal` write-ahead log, resulting in partial or corrupted restore states.

To produce a transactionally consistent, isolated snapshot while the collector is running:
```powershell
npm run backup
```
- **Engine**: Executes SQLite's native `VACUUM INTO '<destination>'`.
- **Properties**:
  - Transactionally atomic snapshot.
  - Automatically incorporates and checkpoints all active WAL pages.
  - Leaves the live database completely unaffected and open for ongoing writes.
  - Validates the resulting backup with `PRAGMA integrity_check` immediately upon completion.
  - Exposes zero credentials.

### 6.4 Error Accounting & Health Monitoring
- `npm run health` provides real-time collector status:
  - **Recent Errors (Last 1h)**: Captures any active RPC timeouts, contract reversion, or network faults.
  - **Historical Errors (All time)**: Retains records of earlier setup phases (e.g. rate-limits or provisional address adjustments during Phase 1C setup). Research data is **never silently deleted**.
  - **Duplicate Integrity**: Confirms 0 duplicate logical records exist in both tables.
  - **Block Sync & Latency**: Shows age of the last observation cycle.

### 6.5 Recovery After System Crash
If the host system loses power or crashes:
1. SQLite WAL mode automatically recovers uncommitted transactions upon reconnection.
2. Run `npm run health` to verify database consistency.
3. Restart via `npm run observe`. Historical rows are preserved completely.

---

## 7. Security Invariants Checklist

Before initiating any collection period, verify that the read-only sandbox remains intact:
- [x] Zero wallets or private keys present in the repository.
- [x] Zero signing code or transaction dispatch methods (`signTransaction`, `sendTransaction`, `sendRawTransaction`).
- [x] Zero contract deployments or token approvals.
- [x] Read-only RPC calls (`eth_call`, `getBlock`, `getGasPrice`).
- [x] Security test suite passes 100% (`npm run lint:security`).
