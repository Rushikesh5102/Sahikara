# PHASE 4.17 — Engine Restart & Persistence Recovery

**Phase**: 4.17 (Production-Grade Local DEX State Reconstruction & Cross-DEX Validation)  
**Date**: 2026-09-17  
**Status**: VALIDATED  
**Capital at Risk**: ₹0.00 / $0.00  
**Phase 5 Status**: STRICTLY BLOCKED  

---

## 1. Requirement & Architecture

In an autonomous market monitoring system, process crashes, node restarts, network disconnects, or deployment rollouts must not corrupt pool state or emit invalid price quotes during initialization.

Phase 4.17 implemented explicit state snapshot export, serialization, and deterministic state restoration:

```
[Running LocalPoolStateManager]
       ↓
exportStateSnapshot(poolAddress) -> JSON String
       ↓
[Process Termination / Cold Restart]
       ↓
[New LocalPoolStateManager]
       ↓
importStateSnapshot(jsonString)
       ↓
Compare State & Quotes at Identical Block
       ↓
MATCH (0 wei) or enter RESYNC_REQUIRED
```

---

## 2. Serialization Protocol

The snapshot serialization format handles native JavaScript `BigInt` values by converting them to string representations during export and parsing them back during import:

```typescript
export interface SerializedV3PoolState {
  poolAddress: string;
  protocol: 'uniswap-v3';
  token0: string;
  token1: string;
  decimals0: number;
  decimals1: number;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  initializedTicks: Array<{
    tick: number;
    liquidityGross: string;
    liquidityNet: string;
    initialized: boolean;
  }>;
  tickBitmap: Array<[number, string]>; // [wordPos, wordString]
  stateVersion: number;
  blockNumber: string;
  blockHash: string;
  logIndex: number;
  parentHash?: string;
  lastUpdatedMs: number;
  lifecycle: StateLifecycleStatus;
}
```

---

## 3. Empirical Restart Test Verification

On Base Mainnet at block `51439647`:
1. **State Export**: The active Uniswap V3 WETH/USDC state was serialized into a snapshot payload of **1,870 bytes**.
2. **Cold Reconstruction**: A completely uninitialized `LocalPoolStateManager` instance was instantiated, and `importStateSnapshot(snapshotJson)` was invoked.
3. **Restored State Inspection**:
   - `sqrtPriceX96`: Identical bit-for-bit (`3928671473216311124686695`)
   - `tick`: Identical (`-198246`)
   - `liquidity`: Identical (`1484499265633474258`)
   - `initializedTicks`: All 9 ticks restored with exact gross/net values
   - `tickBitmap`: Sparse bitmap words restored bit-for-bit
   - `blockNumber` / `blockHash`: Perfectly preserved
4. **Comparative Quote Parity**:
   - Quote Pre-Restart: `2457539791` wei
   - Quote Post-Restart: `2457539791` wei
   - Absolute Delta: **0 wei (`MATCH`)**
   - Result: **PERFECT 0 WEI MATCH ✅**

---

## 4. Cold-Start vs Hot-Recovery Decision Matrix

| Condition | Action | Rationale |
| :--- | :--- | :--- |
| **Snapshot Available & Block Age $< 15 \text{ seconds}$** | Restore snapshot and transition to `VALID` | Warm start minimizes candidate downtime. |
| **Snapshot Available but Block Gap $> 0$** | Restore snapshot, mark `RESYNC_REQUIRED`, backfill logs via `eth_getLogs` | Avoids stale trading on unobserved blocks. |
| **Parent Hash Mismatch on Next Block** | Mark `INVALID`, transition to `RESYNC_REQUIRED`, full RPC refresh | Protects against reorgs occurring during downtime. |
| **No Snapshot Available** | Cold bootstrap from contract calls (`slot0`, `ticks`, `liquidity`) | Deterministic clean slate initialization. |
