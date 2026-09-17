# PHASE 4.16 — Failure Modes, Reorg Safety & Exception Handling

> **STATUS**: RESEARCH COMPLETE — TEST SUITE VERIFIED (15/15 PASSING)  
> **SCOPE**: Comprehensive failure taxonomy, reorg handling, and stream discontinuity mitigations.

---

## 1. Failure Taxonomy & Invariants Matrix

| # | Failure Mode | Risk Description | Detection Mechanism | System Reaction | Test Verification |
|---|---|---|---|---|---|
| **1** | **Missed Log** | Event dropped in network buffer | `logIndex` discontinuity or block jump | State flipped to `STATE_INVALID`; halt quoting | Test 1 |
| **2** | **Duplicate Log** | Node re-emits same log | Identical `(blockNumber, logIndex)` | Discard silently; retain current state | Test 2 |
| **3** | **Out-of-Order Log** | Multi-threaded network reordering | `logIndex < lastLogIndex` in same block | State flipped to `STATE_INVALID`; flag corruption | Test 3 |
| **4** | **WebSocket Disconnect** | TCP drop, provider reset | `ws.onclose` / error handler | `invalidateAll('WEBSOCKET_DISCONNECTED')` | Test 4 |
| **5** | **Block Gap** | Block missed during polling | `incomingBlock > currentBlock + 1` | `STATE_INVALID`; trigger snapshot refetch | Test 5 |
| **6** | **Chain Reorg** | Fork reorganization | `parentHash !== currentBlockHash` | `STATE_INVALID`; trigger snapshot refetch | Test 6 |
| **7** | **Stale State** | No updates for $> 2$ blocks | `currentBlock - stateBlock > 2` | Downgraded to `STATE_STALE`; exclude from candidates | Test 7 |
| **8** | **Invalid State Quoting** | Quoting on corrupted state | Freshness check in `LocalPriceEngine` | Throws error; candidate generation blocked | Test 8 |
| **9** | **Token Ordering** | Uniswap token ordering reversed | Address sort check in initialization | Throws initialization error immediately | Test 9 |
| **10** | **Decimal Mismatch** | Scaling distortion across 6/18 dec | BigInt fixed-precision math | Native scale preserved without floating point | Test 10 |
| **11** | **Tick Boundary Error** | Multi-tick crossing approximation | Tick list bounds checking | Marked `MINOR_DIFFERENCE` or `RECONSTRUCTION_ERROR` | Test 11 |
| **12** | **Reserve Corruption** | Zero/negative reserves in Sync | Validation check in `applyV2Log` | State flipped to `STATE_INVALID`; reject update | Test 12 |
| **13** | **Block Mismatch** | Quote compared to differing block | Block height match in Validator | Classified as `STATE_MISMATCH`; delta zeroed | Test 13 |
| **14** | **RPC Timeout / Hang** | Remote endpoint stalls indefinitely | 5,000 ms `AbortController` timer | Fails fast with `TIMEOUT`; process unblocked | Test 14 |
| **15** | **Reconstruction Drift** | Math diverging from on-chain logic | Difference $> 0.50\text{ bps}$ | Classified as `RECONSTRUCTION_ERROR` | Test 15 |

---

## 2. Reorg & Stream Discontinuity Recovery Protocol

When any anomaly (missed block, reorg, or connection reset) occurs:

1. **Immediate State Invalidation**:
   - `poolState.freshness` is immediately set to `STATE_INVALID`.
   - All candidate generation for that pool halts instantly.
2. **Snapshot Refetch**:
   - The engine initiates an atomic snapshot read (`slot0`, `liquidity`, `blockNumber`, `blockHash`).
3. **Log Stream Catch-Up**:
   - Buffered logs occurring strictly after the snapshot block are applied in sequence.
4. **State Re-Admission**:
   - Only when a contiguous sequence of block headers and log indices is re-established does the state return to `STATE_FRESH`.

---

## 3. Test Verification Status

All 15 failure and correctness scenarios are fully implemented and verified in `scanner/tests/phase416DexStateAcquisition.test.ts`. 

Test execution confirmed:
- 15/15 tests passing (100% compliance).
- Zero uncaught exceptions or unhandled promise rejections.
- Zero state leaks across pool boundaries.
