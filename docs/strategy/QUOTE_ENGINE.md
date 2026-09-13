# QUOTE_ENGINE.md — Quoting Methodology & Known Inaccuracies

> **DOCUMENT STATUS**: ACTIVE (PHASE 1C)  
> **PRINCIPLE**: Accuracy over breadth. Incomplete adapters are explicitly marked as stubs, not faked.

---

## 1. Quoting Philosophy

The observation engine distinguishes three categories of price information per the spec requirement:

| Category | Description | Used for |
|---|---|---|
| **Theoretical Price Difference** | Spot price ratio from pool state | Not calculated — explicitly excluded |
| **Quoted Executable Difference** | Actual output from `QuoterV2` / `getAmountOut` | `amountOut` in `PoolQuote` |
| **Estimated Net Profit** | After fees, gas, and risk buffer | `netExpectedProfitUsd` — the only candidate metric |

Only the third category should be considered a candidate opportunity.

---

## 2. Uniswap v3 Quoting

**Status: COMPLETE**

### Method
`QuoterV2.quoteExactInputSingle` via `eth_call` (read-only)

### Why QuoterV2?
- Returns the **exact** executable output for the current pool state
- Accounts for: active tick range, virtual liquidity depth, fee tier, tick crossings
- Does NOT assume zero slippage
- Does NOT use spot price approximation

### What QuoterV2 Returns
```typescript
[
  amountOut,              // exact output tokens after all fees
  sqrtPriceX96After,      // price after the hypothetical swap
  initializedTicksCrossed,// number of tick boundaries crossed
  gasEstimate             // gas estimate from the quoter itself
]
```

### Known Limitations
1. **`[ASSUMPTION]`** QuoterV2 address `0x3d4e44Eb1374240CE5F1B13678dadB69BA684Bb` on Base must be verified against [official Uniswap Base deployment docs](https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments).
2. **`[ESTIMATE]`** QuoterV2 `gasEstimate` output is NOT used for gas cost calculation — we use our own dynamic estimate from `gasEstimator.ts` to maintain consistency.
3. Each quote call costs ~1 RPC compute unit. At a 30-second poll interval, this is well within Alchemy free tier limits.
4. QuoterV2 calls `nonpayable` functions — but since we use `eth_call`, no gas is actually consumed or transaction submitted.

### Accuracy
- **Within a single tick**: Exact (uses on-chain virtual reserves)
- **Across tick crossings**: Exact (QuoterV2 simulates full tick traversal)
- **Staleness**: Quote reflects state at the block when the call is made. By the time execution would occur (Phase 5+), state may have changed.

---

## 3. Aerodrome Volatile Pool Quoting

**Status: COMPLETE**

### Method
`IPool.getAmountOut(amountIn, tokenIn)` via `eth_call`

### AMM Model
Constant product: `x · y = k`

### Why getAmountOut?
- On-chain function that handles fee deduction internally
- Returns exact executable output for the current reserve state
- Avoids reimplementing fee logic off-chain (potential for error)

### What is Read
1. `getReserves()` — for liquidity check and price impact calculation
2. `fee()` — on-chain actual fee (overrides configured fee — governance-controlled)
3. `getAmountOut(amountIn, tokenIn)` — executable quote

### Known Limitations
1. **`[ASSUMPTION]`** Default Aerodrome volatile fee = 30 bps. **Actual fee is read on-chain via `pool.fee()`** and overrides the configured value.
2. **`[PROVISIONAL]`** Pool addresses must be verified via factory query.
3. Price impact calculation uses constant-product approximation for display — the amountOut itself is exact.

---

## 4. Aerodrome Stable Pool Quoting

**Status: COMPLETE**

### Method
Same as volatile: `getAmountOut(amountIn, tokenIn)` via `eth_call`

### AMM Model
Stableswap invariant: `x³y + y³x = k`

### Why Not Reimplementing Off-Chain?
The stableswap invariant requires iterative Newton-Raphson solving to compute outputs. Reimplementing this off-chain introduces approximation risk. Instead, we delegate to the on-chain `getAmountOut` function which uses the exact same math as execution.

### Known Limitations
1. **`[ASSUMPTION]`** Price impact calculation for stable pools uses a halved constant-product approximation — this underestimates impact. Actual stable pool impact is even lower due to the stableswap curve.
2. Gas consumption for stable pool swaps (~130k units) is higher than volatile (~120k units) due to the iterative invariant solve.

---

## 5. Aerodrome Slipstream (Concentrated Liquidity) — STUB

**Status: NOT IMPLEMENTED [DEC-015]**

### What is Slipstream?
Aerodrome Slipstream is Aerodrome's concentrated liquidity pool type, implementing Uniswap v3 tick math with Aerodrome's fee and governance model.

### What is Required for Implementation
1. **Confirmed SlipstreamQuoterV2 contract address** on Base mainnet
2. **ABI verification** — confirm the interface matches `IQuoterV2` or requires adaptation
3. **Tick spacing confirmation** per pool type
4. **Fee structure verification** — Slipstream may use different fee denomination than Uniswap v3

### Why Not Faked
Per spec: *"If a protocol's on-chain quoting interface cannot yet be implemented correctly, DO NOT fake it."*

The Slipstream adapter returns `ADAPTER_STUB` rejection reason with explanation. All Slipstream observations are stored in the database with `status = ERROR` and `reason_if_rejected = 'ADAPTER_STUB'`.

### Implementation Path
When Slipstream quoter address is confirmed, the adapter can be completed by:
1. Using the same `quoteExactInputSingle` call structure as `UniswapV3Adapter`
2. Replacing the Uniswap QuoterV2 address with the Slipstream QuoterV2 address
3. Updating `AerodromeAdapter.supports()` to return `true` for `aerodrome-slipstream` with `status === 'active'`
4. Removing the stub return in `getQuote()`

---

## 6. Quote Accuracy Summary

| Protocol | Method | Accuracy | Limitations |
|---|---|---|---|
| Uniswap v3 | QuoterV2 `eth_call` | **High** — exact tick math | Address must be verified; stale by poll interval |
| Aerodrome volatile | `getAmountOut` `eth_call` | **High** — exact reserves | Address provisional; fee read on-chain |
| Aerodrome stable | `getAmountOut` `eth_call` | **High** — exact stableswap | Same as volatile |
| Aerodrome Slipstream | **STUB** | **N/A** | Requires SlipstreamQuoterV2 address |

---

## 7. Phase 2 Improvements

In Phase 2 (Real-Time Scanner), quoting will be optimized:
- Off-chain tick math replaces `eth_call` QuoterV2 for Uniswap v3 (eliminates RPC round-trip per quote)
- Pool state maintained in-memory via `Swap`/`Sync` event subscriptions
- Flashblocks WebSocket integration for 200ms pre-confirmation state
