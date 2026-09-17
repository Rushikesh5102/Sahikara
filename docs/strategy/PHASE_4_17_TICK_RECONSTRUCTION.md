# PHASE 4.17 — Multi-Tick Traversal & Bitmap Reconstruction

**Phase**: 4.17 (Production-Grade Local DEX State Reconstruction & Cross-DEX Validation)  
**Date**: 2026-09-17  
**Status**: VALIDATED  
**Capital at Risk**: ₹0.00 / $0.00  
**Phase 5 Status**: STRICTLY BLOCKED  

---

## 1. Mathematical Foundations of Concentrated Liquidity

Uniswap V3 concentrated liquidity pools partition continuous price space into discrete integer ticks $i \in [\text{MIN\_TICK}, \text{MAX\_TICK}]$, where the price at tick $i$ satisfies:
$$\sqrt{P(i)} = 1.0001^{i/2}$$

Within any single tick range $[i_l, i_u)$ where virtual liquidity $L$ is constant, token amounts and price movements are governed by exact invariant equations:
$$\Delta \sqrt{P} = \frac{\Delta x \cdot \sqrt{P_a} \cdot \sqrt{P_b}}{L}$$
$$\Delta y = L \cdot (\sqrt{P_b} - \sqrt{P_a})$$

When an input token amount exceeds the liquidity available inside the active range, the price reaches an initialized tick boundary $i_{\text{next}}$. The swap must:
1. Deduct fee from amount remaining: $\text{amountRemainingAfterFee} = \text{amountRemaining} \times (1 - \text{fee})$.
2. Determine whether the tick boundary is reached.
3. If boundary is reached, consume liquidity in the current range, advance $\sqrt{P}$ to $\sqrt{P_{\text{next}}}$, and cross the tick:
   - Moving left-to-right (price increasing, token1 being bought, $zeroForOne = \text{false}$): $L_{\text{new}} = L + \text{liquidityNet}$.
   - Moving right-to-left (price decreasing, token0 being sold, $zeroForOne = \text{true}$): $L_{\text{new}} = L - \text{liquidityNet}$.
4. Advance to the next tick interval and repeat until input is exhausted.

---

## 2. Deterministic Pure BigInt Implementation

SAHIKARA implements deterministic multi-tick traversal in `LocalPriceEngine.quoteV3MultiTick` without floating-point approximations:

### 2.1 Bitwise Bitmap Searching
The bitmap compresses ticks by `tickSpacing`:
$$\text{compressed} = \lfloor \text{tick} / \text{tickSpacing} \rfloor$$
$$\text{wordPos} = \text{compressed} \gg 8 \quad (\text{int16})$$
$$\text{bitPos} = \text{compressed} \ \& \ 255 \quad (\text{uint8})$$

For directional searching:
- **`zeroForOne == true` (Price Decreasing / Selling token0)**: Search at or to the right of `bitPos` for the most significant bit ($\le \text{bitPos}$). Mask with `(1n << (bitPos + 1)) - 1n` and compute MSB.
- **`zeroForOne == false` (Price Increasing / Selling token1)**: Search to the left of `bitPos` for the least significant bit ($> \text{bitPos}$). Mask with `~((1n << (bitPos + 1)) - 1n)` and compute LSB.

### 2.2 Boundary Sqrt Price Derivation
When an initialized tick is identified, its exact Q64.96 square root price is computed deterministically via `TickMath.getSqrtRatioAtTick(nextTick)`.

### 2.3 Exact Step Calculation (`computeSwapStep`)
At each step:
$$\Delta \sqrt{P} = \text{computeNextSqrtPriceFromInput}(\sqrt{P}_{\text{current}}, L, \text{amountInStep}, zeroForOne)$$
If $\Delta \sqrt{P}$ reaches or exceeds $\sqrt{P}_{\text{next}}$, the step targets $\sqrt{P}_{\text{next}}$; otherwise it stops at $\sqrt{P}_{\text{target}}$.
Output token delta is extracted via `getAmount1Delta` or `getAmount0Delta` using exact round-down integer division:
$$\Delta y = \frac{L \cdot (\sqrt{P_{\text{upper}}} - \sqrt{P_{\text{lower}}})}{2^{96}}$$

---

## 3. Failure Safety & Missing Tick Detection

If traversal requires the next initialized tick, but:
1. The bitmap word is not loaded in `v3State.tickBitmap`, OR
2. The initialized tick record is missing from `v3State.initializedTicks`,

the engine **fails closed**:
```typescript
if (!tickData) {
  return {
    amountOut: 0n,
    finalSqrtPriceX96: currentSqrtPriceX96,
    finalTick: currentTick,
    initializedTicksCrossed: ticksCrossed,
    isIncompleteState: true,
  };
}
```
The validator classifies the quote as `INCOMPLETE_STATE`. Local screening halts for this pool until RPC resynchronization restores missing tick data.

---

## 4. Empirical Test Verification

Deterministic tests in `scanner/tests/phase417ProductionDexState.test.ts` validated:
1. **Single-tick execution**: 0 wei error vs analytical models.
2. **One-tick crossing**: Traversal moves across boundary, adjusts $L \pm \text{liquidityNet}$, and produces bit-exact outputs.
3. **Multi-tick crossing**: Swaps crossing 2+ initialized ticks maintain exact invariant conservation.
4. **Negative tick space**: Correct two's complement and word calculations across negative ranges (e.g. ticks $-198250$ to $-198240$ on Base WETH/USDC).
5. **Tick bitmap word boundary traversal**: Traversal correctly steps across adjacent 256-bit word boundaries.
