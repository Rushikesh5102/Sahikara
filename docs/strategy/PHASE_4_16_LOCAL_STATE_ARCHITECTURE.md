# PHASE 4.16 — Local DEX State Architecture & Mathematical Models

> **STATUS**: RESEARCH COMPLETE — ARCHITECTURAL SPECIFICATION  
> **SCOPE**: Data structures, mathematical swap logic, and event ingestion pipelines for in-memory pool state.

---

## 1. Local Pool State Data Model

The local state engine maintains pool snapshots in memory using two specialized structures: `V2PoolState` and `V3PoolState`.

### V2 Constant-Product State Schema
```typescript
interface V2PoolState {
  metadata: BasePoolMetadata;       // address, tokens, decimals
  reserve0: bigint;                 // Raw token0 balance
  reserve1: bigint;                 // Raw token1 balance
  feeBps: number;                   // e.g. 30 (0.30%)
  blockNumber: bigint;              // Block of last applied event
  blockHash: string;                // Block hash for reorg tracking
  parentHash?: string;              // Parent block hash
  lastLogIndex: number;             // Log index in block (sequence tracking)
  lastUpdateMonotonicMs: number;    // Local high-resolution timestamp
  lastUpdateWallClockIso: string;   // Wall-clock timestamp for provenance
  freshness: StateFreshnessClass;   // FRESH, RECENT, STALE, UNKNOWN, INVALID
}
```

### V3 Concentrated Liquidity State Schema
```typescript
interface V3PoolState {
  metadata: BasePoolMetadata;
  sqrtPriceX96: bigint;             // Current sqrt price scale factor
  tick: number;                     // Current discrete log-price index
  liquidity: bigint;                // Active virtual liquidity L
  feeUint24: number;                // e.g. 500 (0.05%)
  initializedTicks: Map<number, TickInfo>; // Tick boundary mappings
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  lastLogIndex: number;
  lastUpdateMonotonicMs: number;
  lastUpdateWallClockIso: string;
  freshness: StateFreshnessClass;
}
```

---

## 2. In-Memory Mathematical Pricing Models

### Constant-Product Swap Mathematics (`quoteV2`)
For a swap of $\Delta x$ into a pool with reserves $(R_{\text{in}}, R_{\text{out}})$ and fee $\gamma = 1 - \frac{\text{feeBps}}{10000}$:

$$\Delta x_{\text{fee}} = \Delta x \times (10000 - \text{feeBps})$$

$$\Delta y = \frac{\Delta x_{\text{fee}} \times R_{\text{out}}}{10000 \cdot R_{\text{in}} + \Delta x_{\text{fee}}}$$

Executed via native BigInt integer division with exact truncation, identical to EVM Solidity execution.

### Concentrated Liquidity Swap Step (`quoteV3`)
Within the active tick range where liquidity $L$ is constant:

1. **Deduct Fee**:
   $$\Delta x_{\text{net}} = \frac{\Delta x \times (1000000 - \text{feeUint24})}{1000000}$$

2. **Calculate Next $\sqrt{P}$**:
   - For `token0 -> token1` (selling token0, $\sqrt{P}$ decreases):
     $$\sqrt{P}_{\text{next}} = \frac{L \cdot \sqrt{P}}{L + \frac{\Delta x_{\text{net}} \cdot \sqrt{P}}{2^{96}}}$$
     $$\Delta y = \frac{L \cdot (\sqrt{P} - \sqrt{P}_{\text{next}})}{2^{96}}$$

   - For `token1 -> token0` (selling token1, $\sqrt{P}$ increases):
     $$\sqrt{P}_{\text{next}} = \sqrt{P} + \frac{\Delta y_{\text{net}} \cdot 2^{96}}{L}$$
     $$\Delta x = \frac{L \cdot 2^{96} \cdot (\sqrt{P}_{\text{next}} - \sqrt{P})}{\sqrt{P}_{\text{next}} \cdot \sqrt{P}}$$

All operations are executed using 256-bit BigInt math. Benchmarked execution time is **14 to 22 microseconds**.

---

## 3. Event Ingestion Pipeline & Sequence Safety

```
[WebSocket Pool Log Stream]
        │
        ▼
[Event Reception & Receipt Timestamping (performance.now())]
        │
        ▼
[Parent Hash & Reorg Check] ── Mismatch? ──► [STATE_INVALID & Trigger Resync]
        │
        ▼
[Block Continuity Check] ────── Gap > 1? ──► [STATE_INVALID & Trigger Resync]
        │
        ▼
[Intra-Block Log Index Check] ─ Out of order? ─► [STATE_INVALID & Trigger Resync]
        │
        ▼
[Apply Reserves / SqrtPrice Update]
        │
        ▼
[Mark STATE_FRESH & Notify Detection Engine]
```

### Invariants:
1. State updates are strictly non-retroactive: events older than the current state block are rejected.
2. Any discontinuity in log sequence numbers or block hashes immediately halts candidate generation.
3. No speculative state transition is permitted without a matching consensus block header.
