# PHASE 4.11 — DEX ADAPTER FORENSICS & IMPLEMENTATION AUDIT

**Date:** 2026-09-17  
**Status:** COMPLETE  

---

## 1. Executive Summary

Every DEX adapter integrated into SAHIKARA was independently audited for:
- Contract addresses and interfaces
- Token ordering and numerical index matching
- Fee calculation and inclusion semantics
- Mathematical precision and absence of floating-point integer truncation
- Failure handling without synthetic economic fallbacks

---

## 2. Adapter-Specific Forensic Findings

### 1. Curve Adapter (`CurveAdapter.ts`)
- **Protocol Method**: `pool.get_dy(i, j, dx)`
- **Token Indexing**: Dynamically maps `tokenIn` and `tokenOut` to numerical indices `i` and `j` based on canonical pool coin registration.
- **Decimals**: Tested with 6-decimal stablecoins (USDC/USDT) and 18-decimal stablecoins (DAI).
- **Fee Inclusion**: **YES**. `get_dy` computes output net of the Curve pool swap fee (4 bps on 2pool/Aave).
- **Pool Types Supported**: Plain Stableswap pools (2pool, Aave pool). Metapools and crypto pools are rejected as unsupported.

### 2. Balancer V2 Adapter (`BalancerV2Adapter.ts`)
- **Protocol Method**: `Vault.getPoolTokens(poolId)`
- **Pool Typing**: Formally updated in Phase 4.11 to classify pools (`WEIGHTED`, `STABLE`, `OTHER_SUPPORTED`, `UNSUPPORTED`).
- **Limitation Enforced**: Strictly restricts quoting to `WEIGHTED` pools. Composable stable and linear pools require specialized invariant calculators and are not approximated as weighted pools.
- **Math**: Exact 50/50 weighted formula:
  $$\text{amountOut} = \frac{\text{balanceOut} \cdot \text{amountInWithFee}}{\text{balanceIn} + \text{amountInWithFee}}$$
- **Fee Inclusion**: **YES**. Fee is deducted from `amountIn` before applying invariant.

### 3. Camelot V2 Adapter (`CamelotAdapter.ts`)
- **Protocol Method**: `pair.getAmountOut(amountIn, tokenIn)`
- **Dynamic Fee**: Authoritative directional fee algebra is executed directly within the pair contract.
- **Fee Inclusion**: **YES**. `getAmountOut` returns output net of directional swap fee.

### 4. Velodrome V2 Adapter (`VelodromeAdapter.ts`)
- **Protocol Method**: `pool.getAmountOut(amountIn, tokenIn)`
- **Curve Variants**: Distinct volatile ($x^3y + xy^3 = k$) and stable ($x \cdot y = k$) invariants are handled within individual pool contracts.
- **Fee Inclusion**: **YES**. Output is net of 30 bps (volatile) or 5 bps (stable).

### 5. QuickSwap V2 Adapter (`QuickSwapAdapter.ts`)
- **Protocol Method**: Constant-product reserve math via `getReserves()`.
- **Fee Model**: 30 bps (0.30%) fee factor:
  $$\text{amountInWithFee} = \text{amountIn} \cdot 9970$$
  $$\text{amountOut} = \frac{\text{amountInWithFee} \cdot \text{reserveOut}}{\text{reserveIn} \cdot 10000 + \text{amountInWithFee}}$$
- **Fee Inclusion**: **YES**. Matches QuickSwapRouter.getAmountOut exactly (0 wei diff).

### 6. SushiSwap V2 Adapter (`SushiSwapAdapter.ts`)
- **Protocol Method**: Constant-product reserve math via `getReserves()`.
- **Fee Model**: 30 bps (0.30%) standard UniswapV2 fee.
- **Fee Inclusion**: **YES**. Matches SushiSwapRouter.getAmountOut exactly (0 wei diff).

### 7. Uniswap V3 & Aerodrome Regressions
- **Uniswap V3**: `QuoterV2.quoteExactInputSingle` verified. BigInt precision maintained. No unsafe `Number(sqrtPriceX96)` conversions in quoting paths.
- **Aerodrome**: Slipstream (CL) and Volatile/Stable pair calls verified.

---

## 3. Fee Accounting Verdict

Every supported adapter outputs values **net of pool fees**. In accordance with Section 5 economic imperatives:
$$\text{grossRoundTripPnL} = \text{finalAmountOut} - \text{initialAmountIn}$$
Pool fees are **NOT** subtracted again during net profit calculation. Fee metadata (`leg1FeeBps`, `leg2FeeBps`) is recorded for informational provenance only.
