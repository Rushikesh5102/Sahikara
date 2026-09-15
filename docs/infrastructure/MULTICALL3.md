# MULTICALL3.md — Multicall3 Contract Batching & Integration

> **STATUS**: **IMPLEMENTED & TESTED (Phase 1E)**  
> **SCOPE**: Read-Only Batch Contract Polling  
> **EPISTEMIC TAGS**: [FACT] = verified implementation, [PROVISIONAL] = usage boundaries  

---

## 1. Overview & Architecture

When observing multiple pools, fee tiers, and token pairs across decentralized exchanges, issuing individual `eth_call` RPC requests for every quote or state variable causes:
- RPC rate-limit exhaustion
- Block skew (queries landing on slightly different blocks across an observation cycle)
- Inefficient network round-trip latency overhead

Phase 1E introduces `Multicall3Batcher` (`scanner/src/rpc/Multicall3Batcher.ts`), utilizing the canonical, audited, and omnipresent **Multicall3** contract:
- **Multicall3 Address (All EVM Chains)**: `0xca11bde05977b3631167028862be2a173976ca11` [FACT]
- **Chain ID Verified**: Base (`8453`)

---

## 2. Technical Implementation

`Multicall3Batcher` wraps viem's native `publicClient.multicall()` method with crucial resilience guarantees:

### Per-Call Fault Isolation (`allowFailure: true`)
```typescript
const rawResults = await client.multicall({
  contracts: contracts as never,
  allowFailure: true,
});
```
By setting `allowFailure: true`, a failure or revert in one pool (e.g. an uninitialized fee tier or a low-liquidity pool revert) does NOT abort the entire batch. Successful calls return their decoded data, while failing calls return `null` and a captured error message.

### Multicall Metrics Tracking
The batcher tracks operational metrics across batches:
- `totalBatchesExecuted`
- `totalCallsAttempted`
- `successfulCalls`
- `failedCalls`
- `lastBatchLatencyMs`

---

## 3. When to Use Multicall vs. When to Avoid It

| Scenario | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Static Pool Reserves / Slot0** | **USE MULTICALL3** | High efficiency; combines all pool states into 1 RPC request. |
| **Token Decimals / Symbols** | **USE MULTICALL3** | Ideal for batch pool registration and startup verification. |
| **QuoterV2 Executable Quotes** | **USE CAUTION / INDIVIDUAL** | Quoter contracts (e.g. Uniswap V3 QuoterV2, PancakeSwap V3 Quoter) internally simulate state changes and revert or consume significant gas. Some public RPC nodes restrict multicall calls containing nested state simulations. |
| **Empty Call Array** | **BYPASS RPC** | `executeBatch([])` immediately returns `{ results: [], latencyMs: 0 }` without performing an RPC call. |
