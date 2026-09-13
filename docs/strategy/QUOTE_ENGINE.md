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
  amountOut,              // exact output tokens after all fees (fee already deducted)
  sqrtPriceX96After,      // price after the hypothetical swap
  initializedTicksCrossed,// number of tick boundaries crossed
  gasEstimate             // gas estimate from the quoter itself
]
```

> [!IMPORTANT]
> **Fee Treatment Invariant (Phase 1C.2.1 Audit)**: The returned `amountOut` from `QuoterV2.quoteExactInputSingle` already accounts for the pool swap fee (e.g. 5 bps for pool 500). The economics engine must **never** subtract the swap fee from gross profit again.

### Known Limitations
1. **`[FACT]`** QuoterV2 canonical address on Base is `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` (empirically verified on-chain). The previous provisional address was malformed by 1 missing hex character.
2. **`[ESTIMATE]`** QuoterV2 `gasEstimate` output is NOT used for gas cost calculation — we use our own dynamic estimate from `gasEstimator.ts` to maintain consistency.
3. Each quote call costs ~1 RPC compute unit. At a 30-second poll interval, this is well within Alchemy free tier limits.
4. QuoterV2 calls `nonpayable` functions — but since we use `eth_call`, no gas is actually consumed or transaction submitted.
5. **Observation Context**: Block number, timestamp, and quotes are retrieved directly in the same observation cycle from the live RPC head (e.g. block ~51,270,xxx on Base mainnet).

### Accuracy
- **Within a single tick**: Exact (uses on-chain virtual reserves)
- **Across tick crossings**: Exact (QuoterV2 simulates full tick traversal)
- **Staleness**: Quote reflects state at the block when the call is made. By the time execution would occur (Phase 5+), state may have changed.

---

## 3. Aerodrome Volatile Pool Quoting

**Status: COMPLETE**

### Method
`Pool.getAmountOut(amountIn, tokenIn)` via `eth_call` (read-only)

> [!IMPORTANT]
> **Fee Treatment Invariant**: Aerodrome's `getAmountOut` applies `fee = (amountIn * factory.getFee(pool, stable)) / 10000` internally before computing the constant-product swap output ($x \cdot y = k$). The returned `amountOut` is already net of swap fees. Gross round-trip PnL ($Q_{\text{out}} - Q_{\text{in}}$) already incorporates this friction. Pool fees must NOT be subtracted a second time.

### AMM Model
Constant product: `x · y = k`

### Why getAmountOut?
- On-chain function that handles fee deduction internally
- Returns exact executable output for the current reserve state
- Avoids reimplementing fee logic off-chain (potential for error)

### What is Read
1. `getReserves()` — for liquidity check and price impact calculation
2. `Factory.getFee(poolAddress, stable)` — on-chain fee queried from Aerodrome PoolFactory (`0x420DD381b31aEf6683db6B902084cB0FFECe40Da`)
3. `getAmountOut(amountIn, tokenIn)` — native executable quote

### Known Limitations
1. **`[FACT]`** Aerodrome pools do not expose a public `fee()` getter. **Actual fee is read on-chain via `Factory.getFee(poolAddress, stable)`** and overrides any configured value.
2. **`[FACT]`** Volatile WETH/USDC fee is 30 bps (0.30%); Stable USDC/USDbC fee is 5 bps (0.05%).
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

---

## 8. Cross-DEX Round-Trip Quoting (Phase 1C.2)

### Architecture
True arbitrage cannot be evaluated using one-way conversion prices. The engine implements explicit 2-leg round-trip quoting via `RoundTripEvaluator`:
- **Leg 1**: `Token A -> Token B` using Pool 1 adapter's `getDirectionalQuote(pool, tokenIn, ...)`
- **Leg 2**: `Token B -> Token A` using Pool 2 adapter's `getDirectionalQuote(pool, tokenIn, ...)` with the exact `leg1Output` as the input.

### Directional Quoting
Both `UniswapV3Adapter` and `AerodromeAdapter` support bidirectional quoting:
- Uniswap v3: Dynamically swaps `tokenIn` and `tokenOut` in `QuoterV2.quoteExactInputSingle` params.
- Aerodrome: Calls native `getAmountOut(amountIn, tokenIn)` for either token address, deriving the counterpart token output.

### Exact Net Calculation vs External USD Substitutes
The round-trip engine strictly compares token quantities (`leg2Output - initialAmount`). It **never** uses external USD price feeds to substitute for executable return. Token quantities are converted to USD solely for standardized reporting, fee accounting, and threshold gating.
