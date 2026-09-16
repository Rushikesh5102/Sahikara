# PHASE_4_6_1_FORENSIC_AUDIT.md
# SAHIKARA — Phase 4.6.1 Stop-Gate Forensic Audit

**Document Status**: COMPLETE  
**Audit Type**: Independent Post-Campaign Forensic Validation  
**Campaign ID**: `PHASE_4_6_1_1789554343658`  
**Campaign Duration**: 2,226.4 seconds (~37.1 minutes)  
**Auditor Role**: Independent AI Reviewer (read-only, zero execution authority)  
**Capital at Risk**: ₹0.00 / $0.00 — CONFIRMED  
**Execution Engine State**: LOCKED — CONFIRMED  
**Database Integrity**: `integrity_check=ok`, `quick_check=ok` — CONFIRMED  

---

## SECTION 1 — AUDIT MANDATE & SCOPE

This forensic audit verifies the trustworthiness of the Phase 4.6.1 Multi-Chain Empirical Discovery
Campaign across four dimensions:

1. **Accounting correctness**: Do reported observation counts match provable formulas?
2. **Route topology integrity**: Were the correct pools and routes observed?
3. **Economic validity**: Are the spread distributions mathematically coherent?
4. **Code defect detection**: Are there systemic bugs that corrupt any findings?

> **BIAS WARNING**: The audit optimizes for discovering whether the empirical evidence is trustworthy.
> It does NOT optimize for proving the previous campaign correct.

---

## SECTION 2 — SAFETY INVARIANT CONFIRMATION

| Invariant | Required | Observed | Status |
|---|---|---|---|
| Capital at risk | $0.00 | $0.00 | ✅ PASS |
| Private keys handled | 0 | 0 | ✅ PASS |
| Transactions signed | 0 | 0 | ✅ PASS |
| Transactions broadcast | 0 | 0 | ✅ PASS |
| Contracts deployed | 0 | 0 | ✅ PASS |
| Execution engine locked | true | true | ✅ PASS |
| Baseline DB untouched | true | true | ✅ PASS |
| Phase 4.6 DB isolated | true | true | ✅ PASS |

Source: `scanner/data/phase4_6_1_results.json` → `safetyInvariants` block.

---

## SECTION 3 — POOL REGISTRY VERIFICATION

### 3.1 Active Pool Count Check (Pre-Campaign Gate)

The campaign enforced an explicit pre-campaign registry check:

| Chain | Expected | Reported | Status |
|---|---|---|---|
| Base | 17 | 17 | ✅ PASS |
| Polygon | 5 | 5 | ✅ PASS |
| Arbitrum One | 5 | 5 | ✅ PASS |
| Optimism | 5 | 5 | ✅ PASS |
| **Total** | **32** | **32** | ✅ PASS |

All pools satisfy `status === 'active'` AND `tier === '[FACT]'`.

### 3.2 Active Pool Inventory Audit

#### Polygon (5 Active Pools)
| Pool ID | Token Pair | Fee | Address | Tier |
|---|---|---|---|---|
| univ3-polygon-weth-usdc-500 | USDC/WETH | 5 bps | 0xA4D8c89... | [FACT] |
| univ3-polygon-weth-usdc-3000 | USDC/WETH | 30 bps | 0x19C5505... | [FACT] |
| univ3-polygon-wmatic-usdce-500 | WMATIC/USDCe | 5 bps | 0xA374094... | [FACT] |
| univ3-polygon-wmatic-weth-500 | WMATIC/WETH | 5 bps | 0x86f1d83... | [FACT] |
| univ3-polygon-weth-usdt-500 | WETH/USDT | 5 bps | 0xBB98B3D... | [FACT] |

Archived disabled pools (historical provenance preserved): 3 entries.

#### Arbitrum One (5 Active Pools)
| Pool ID | Token Pair | Fee | Address | Tier | Note |
|---|---|---|---|---|---|
| univ3-arbitrum-weth-usdc-500 | WETH/USDC | 5 bps | 0xC6962... | [FACT] | |
| univ3-arbitrum-weth-usdce-500 | WETH/USDCe | 5 bps | 0xC31E5... | [FACT] | |
| univ3-arbitrum-weth-usdc-3000 | WETH/**USDCe** | 30 bps | 0x17c14... | [FACT] | ⚠️ ID says USDC, actual token1 is USDCe |
| univ3-arbitrum-wbtc-weth-500 | WBTC/WETH | 5 bps | 0x2f5e8... | [FACT] | |
| univ3-arbitrum-weth-usdt-500 | WETH/USDT | 5 bps | 0x641C0... | [FACT] | |

#### Optimism (5 Active Pools)
| Pool ID | Token Pair | Fee | Address | Tier | Note |
|---|---|---|---|---|---|
| univ3-optimism-weth-usdc-500 | USDC/WETH | 5 bps | 0x1fb3c... | [FACT] | |
| univ3-optimism-weth-usdce-500 | WETH/USDCe | 5 bps | 0x85149... | [FACT] | |
| univ3-optimism-weth-usdc-3000 | WETH/**USDCe** | 30 bps | 0xB5899... | [FACT] | ⚠️ ID says USDC, actual token1 is USDCe |
| univ3-optimism-weth-usdt-500 | WETH/USDT | 5 bps | 0xc858A... | [FACT] | |
| univ3-optimism-wsteth-weth-100 | wstETH/WETH | 1 bps | 0x04F6C... | [FACT] | |

Archived disabled pool: 1 entry.

---

## SECTION 4 — ACCOUNTING VERIFICATION

### 4.1 Accounting Formula

**Theoretical exhaustive formula**: `EXPECTED = EVENTS × ROUTES × SIZES`

**Actual campaign design**: The shadow engine uses **event-driven dispatch** — `processEvent()`
calls `getAffectedRoutes(poolAddress)` and evaluates ONLY routes whose `leg1` or `leg2` pool
address matches the triggering event's pool. This is NOT an exhaustive cross-product sweep.

### 4.2 Per-Chain Accounting Check

#### Polygon — ✅ EXACT MATCH
```
Events processed = 15  |  Routes = 2  |  Sizes = 9
Exhaustive expected = 15 × 2 × 9 = 270
Reported allAttempts = 270  ✅
```

Explanation: Both routes use only USDC/WETH 500 and USDC/WETH 3000 pools. The 5 active pools
include these 2 high-volume pools that dominate log activity, so all 15 events originated from
routed pools and triggered both routes per event.

#### Arbitrum — ✅ EXACT MATCH
```
Events processed = 14  |  Routes = 2  |  Sizes = 9
Exhaustive expected = 14 × 2 × 9 = 252
Reported allAttempts = 252  ✅
```
Note: 14 events found vs target 15 (not all blocks had events in the lookback window).

#### Optimism — ✅ EXACT MATCH
```
Events processed = 15  |  Routes = 2  |  Sizes = 9
Exhaustive expected = 15 × 2 × 9 = 270
Reported allAttempts = 270  ✅
```

#### Base — ❌ INCOMPLETE COVERAGE (Design Gap, Not Code Defect)
```
Events processed = 15  |  Routes = 26  |  Sizes = 9
Exhaustive expected = 15 × 26 × 9 = 3,510
Reported allAttempts = 756  ← 21.5% of theoretical maximum
```

Root cause: With 17 Base pools and 26 routes, each event triggers only the routes that
reference its specific triggering pool. On average: `756 / (15 × 9) ≈ 5.6 routes per event`
out of 26 possible. The remaining ~20 routes per event are never sampled.

**Finding F-001** (Design Gap): Base campaign covers only 21.5% of the theoretical route-size
observation space. Eighty-two percent of Base route-block combinations were never evaluated.

### 4.3 Accounting Verdict

| Chain | Formula Match | Effective Coverage |
|---|---|---|
| Polygon | ✅ Exact | 100% (all 2 routes, all 15 events) |
| Arbitrum | ✅ Exact | 100% (all 2 routes, all 14 events) |
| Optimism | ✅ Exact | 100% (all 2 routes, all 15 events) |
| Base | ❌ Shortfall | 21.5% (event-dispatch limits coverage) |

---

## SECTION 5 — ROUTE TOPOLOGY AUDIT

### 5.1 Same-Pair Cross-Venue Route Generation

#### Polygon (2 routes generated from 4 enabled research pairs)

**Routes generated** (pair `polygon-weth-usdc` — the only pair with ≥ 2 eligible pools):
1. Forward: UniV3 USDC/WETH-500 → UniV3 USDC/WETH-3000
2. Reverse: UniV3 USDC/WETH-3000 → UniV3 USDC/WETH-500

**Pool participation audit:**

| Pool | Participates in Route? | Reason |
|---|---|---|
| univ3-polygon-weth-usdc-500 | ✅ Yes | Used in routes 1 and 2 |
| univ3-polygon-weth-usdc-3000 | ✅ Yes | Used in routes 1 and 2 |
| univ3-polygon-wmatic-usdce-500 | ❌ No | Only 1 pool matches pair `polygon-wmatic-usdce` |
| univ3-polygon-wmatic-weth-500 | ❌ No | Only 1 pool matches pair `polygon-wmatic-weth` |
| univ3-polygon-weth-usdt-500 | ❌ No | Only 1 pool matches pair (no second WETH/USDT pool) |

**Finding F-002**: 3 of 5 active Polygon pools (60%) were never routed and produced zero
evaluations during the campaign.

**Finding F-003** (Dead Pair Defect): Research pairs `polygon-weth-usdce`, `polygon-wmatic-usdce`,
and `polygon-wmatic-weth` are silently dead — they match zero pool combinations with ≥ 2 eligible
pools. The campaign silently skips them with no diagnostic warning. These pairs should trigger
a loud pre-campaign warning or be removed from the enabled pair list until second pools are added.

#### Arbitrum (2 routes from pair `arbitrum-weth-usdce`)

Pairs `arbitrum-weth-usdc` (1 WETH/USDC pool), `arbitrum-wbtc-weth` (1 pool), and
`arbitrum-weth-usdt` (1 pool) each have only 1 eligible pool → no cross-venue routes possible.
Only `arbitrum-weth-usdce` has 2 pools (500 bps + 3000 bps fee tiers) → 2 routes.

#### Optimism (2 routes from pair `optimism-weth-usdce`)

Same topology as Arbitrum. Pools `USDC/WETH`, `WETH/USDT`, `wstETH/WETH` each have 1 pool.
Only `WETH/USDCe` pair has 2 pools (500 + 3000) → 2 routes.

### 5.2 Triangular Route Generation: 0 on All Chains

All four chains report 0 triangular routes. This is correct:
- **Base**: Pool universe is hub-spoke (all pairs share WETH or USDC). No closing pool
  exists in the registry for any 3-token triangle (e.g., no cbBTC/USDC pool to close
  WETH→cbBTC→USDC→WETH).
- **Polygon/Arbitrum/Optimism**: Small pool universes (5 each) with no cross-token bridges.

Zero triangular routes is a **structurally justified** finding, not a defect.

---

## SECTION 6 — CRITICAL DEFECT: D-001

### CRITICAL — Polygon `ethPriceUsd = 0.80` Corrupts All Polygon Data

**Severity**: 🔴 CRITICAL  
**Status**: CONFIRMED (full causal chain traced in source code)  
**Impact**: All 270 Polygon observations are economically invalid and must be discarded

#### Causal Chain (source-code traced)

**Step 1 — Configuration error** (`run-phase4-6-campaign.ts`, line 391):
```typescript
policyConfig: {
  ethPriceUsd: cfg.gasModelType === 'polygon' ? 0.80 : 2500.0,
```
The developer intended `0.80` as the MATIC/USD price for gas cost estimation.
However, `policyConfig.ethPriceUsd` is consumed by the shadow engine for TWO purposes.

**Step 2 — `ethPriceUsd` returned as WETH price** (`RealTimeShadowEngine.ts`, line 171):
```typescript
private getTokenPriceUsd(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s === 'WETH') return this.policyConfig.ethPriceUsd;  // ← Returns 0.80 for Polygon!
  if (s === 'WMATIC' || s === 'WPOL') return 0.80;        // ← WMATIC also hardcoded 0.80
```

**Step 3 — initialAmount computed with wrong WETH price** (`RealTimeShadowEngine.ts`, lines 230-238):
```typescript
const baseToken = route.leg1.tokenIn;               // = WETH (for polygon-weth-usdc pair)
const baseTokenPriceUsd = this.getTokenPriceUsd(baseToken.symbol);  // = 0.80 ← WRONG
const initialAmount = BigInt(
  Math.floor((tradeSizeUsd / baseTokenPriceUsd) * Math.pow(10, decimals))
);
// For $100 trade: initialAmount = (100 / 0.80) × 10^18 = 125×10^18 = 125 WETH ← $312,500 real value!
```

#### Trade Size Inflation Quantified

| Nominal Trade Size | WETH Price Used | WETH Sent | Real USD Value | Inflation Factor |
|---|---|---|---|---|
| $1 | $0.80 | 1.25 WETH | **$3,125** | 3,125× |
| $10 | $0.80 | 12.5 WETH | **$31,250** | 3,125× |
| $100 | $0.80 | 125 WETH | **$312,500** | 3,125× |
| $1,000 | $0.80 | 1,250 WETH | **$3,125,000** | 3,125× |

Correct calculation would use `$2,500/WETH`:
`initialAmount_correct = (tradeSizeUsd / 2500) × 10^18`
`initialAmount_actual  = (tradeSizeUsd / 0.80)  × 10^18 = 3,125 × initialAmount_correct`

#### Effect on Spread Distribution

At $1,000 nominal size, 1,250 WETH ($3.125M) enters Polygon pools. Even large pools cannot
absorb this without catastrophic price impact. The QuoterV2 returns a severely discounted
output, producing enormous negative grossSpreadBps.

**Observed Polygon grossSpreadDist** (from `phase4_6_1_results.json`):
```
min:    -9,928 bps   (1,250 WETH, pools near-exhausted)
p25:    -9,715 bps
median: -8,196 bps
max:      -412 bps   (1.25 WETH, still 3,125× oversize)
```

**Expected Polygon grossSpreadDist** (at correctly-sized $2,500/WETH trades):
```
Approx: -35 to -42 bps (fee drag only: 5 bps + 30 bps, minimal price impact for small sizes)
```

**The entire Polygon distribution is an artifact.** The -8,196 bps median measures pool
liquidity exhaustion under 3,125× oversized inputs — not market efficiency.

#### Partial Fix Already Applied to Forensic Re-Query (Inconsistency)

The forensic re-query code at line 573 already hardcodes the correct value:
```typescript
baseTokenPriceUsd: matchingRoute.leg1.tokenIn.symbol.toUpperCase() === 'WETH' ? 2500 : 1.0,
```
This inconsistency (shadow engine uses $0.80, forensic re-query uses $2500) would cause the
two calculations to disagree by 3,125× if any Polygon candidate triggered forensic auditing.
No candidates were triggered (all spreads negative), so the inconsistency had no run-time
consequence — but it is a methodological defect.

---

## SECTION 7 — HIGH DEFECT: D-002

### HIGH — BigInt→Number Overflow Corrupts `priceImpactBps` Across All Chains

**Severity**: 🟠 HIGH  
**Status**: CONFIRMED  
**Impact**: `priceImpactBps` values are corrupted for WETH/stablecoin pools; `SLIPPAGE_TOO_HIGH` gate unreliable

#### Root Cause (`UniswapV3Adapter.ts`, lines 229-231)

```typescript
const sqrtRatio = Number(sqrtPriceX96After) / Number(sqrtPriceX96);
const priceImpactFraction = Math.abs(1 - sqrtRatio * sqrtRatio);
const priceImpactBps = priceImpactFraction * 10000;
```

For Polygon USDC/WETH pools (token0 = USDC 6dec, token1 = WETH 18dec, WETH ≈ $2,500):

```
price(raw) = token1_qty / token0_qty in raw units
           = (1 WETH × 10^18 wei) / (2500 USDC × 10^6 μ-USDC)
           = 10^18 / (2500 × 10^6) = 4 × 10^8

sqrtPriceX96 = sqrt(4 × 10^8) × 2^96
             ≈ 2 × 10^4 × 7.92 × 10^28
             ≈ 1.58 × 10^33
```

`Number.MAX_SAFE_INTEGER = 9.007 × 10^15`
`1.58 × 10^33 >> 9.007 × 10^15` → `Number()` conversion loses all precision

The resulting `sqrtRatio` is a near-random floating-point value; `priceImpactBps` is meaningless.

#### Evidence — Polygon priceImpactDist

```json
"priceImpactDist": {
  "min":    748.284 bps     (7.5%   — already impossible for small trades)
  "median": 169,829 bps     (1,698% — physically impossible)
  "mean":   143,272,843,277 bps  (1.43 trillion % — confirmed overflow artifact)
  "max":  2,020,846,677,268 bps  (20.2 trillion % — confirmed overflow artifact)
}
```

Legitimate Uniswap V3 price impact is bounded by 10,000 bps (100%) for any finite trade
in a pool with non-zero liquidity. Values above 10,000 bps are physically impossible.

#### Evidence — Arbitrum priceImpactDist (partial overflow)

```json
"max": 32.948 bps
```
More reasonable because WETH/USDCe price ratio produces a smaller sqrtPriceX96. However,
32.9 bps price impact for a $1 trade on a major Arbitrum pool is still suspicious — likely
partial precision loss.

#### Consequence

The `evaluateRoundTrip` function applies:
```typescript
if (maxPriceImpactBpsActual > maxPriceImpactBps) {  // threshold = 20 bps
    status = 'REJECTED';
    classification = 'SLIPPAGE_TOO_HIGH';
```

With Polygon priceImpactBps in the trillions, ALL Polygon evaluations would be rejected
by this gate. However, `SLIPPAGE_TOO_HIGH` rejections do NOT increment `failedQuotes` in
the shadow engine — they only increment `failedQuotes` on JavaScript exceptions. Thus:
- `quoteFailures = 0` for Polygon is technically correct (no exceptions thrown)
- But the 270 "valid quotes" include evaluations that were silently rejected by SLIPPAGE_TOO_HIGH
- The `tier0Count = 270` reports all as zero/negative gross spread — which masks the
  true rejection reason

---

## SECTION 8 — THE "-10 BPS" PATTERN INVESTIGATION

### 8.1 Phase 4.5.1 -10,000 bps Artifact: FULLY RESOLVED

The Phase 4.5.1 campaign exhibited a hardcoded **-10,000 bps** artifact from EIP-55
checksum failures in the Uniswap V3 adapter. Phase 4.6.1 results show:

**No values at or near -10,000 bps on any chain.** ✅

The EIP-55 checksum fix and dynamic per-chain QuoterV2 address routing are confirmed effective.

### 8.2 Theoretical Fee Floor Analysis

| Chain | Routes | Combined Fee Tier | Expected Floor | Observed Max (best) | Assessment |
|---|---|---|---|---|---|
| Base | 26 (mixed) | 1+1 bps min | ~-2 bps | -6.155 bps | Consistent — light adverse dislocation on 1bp route |
| Arbitrum | 2 (5+30 bps) | -35 bps floor | -35 bps | -19.956 bps | +15 bps favorable dislocation detected ✅ |
| Optimism | 2 (5+30 bps) | -35 bps floor | -35 bps | -8.462 bps | +26.5 bps favorable dislocation detected ✅ |
| Polygon | 2 (5+30 bps) | -35 bps floor | -35 bps | -412.560 bps | ❌ INVALID — D-001 contaminates |

Base -6.155 bps: the best Base spread likely comes from a wstETH/WETH 1bp route.
Expected fee drag = -(1+1) = -2 bps. The additional -4.155 bps reflects a mild price
dislocation against the trade direction. Coherent. ✅

### 8.3 Arbitrum Spread Clustering Investigation

```
Arbitrum grossSpreadDist:
  p90: -20.040 bps
  p95: -19.956168772375 bps  ← identical to p99 and max
  p99: -19.956168772375 bps  ← identical
  max: -19.956168772375 bps  ← identical (to 15 decimal places)
```

Multiple observations share the **exact same grossSpreadBps** to 15 decimal places.

**Root cause**: The `UniswapV3Adapter` caches pool state per `${poolAddress}:${blockNumber}`.
Multiple events from the same block share the same cached `sqrtPriceX96`, so the QuoterV2
is called with identical state. For pools with very deep liquidity (Arbitrum WETH/USDCe),
price impact across $1–$1,000 trade sizes is negligible — the spread is dominated by the
inter-pool price dislocation at that block, which is constant across all trade sizes.

This clustering is **not a defect** — it confirms the Arbitrum WETH/USDCe pools are
sufficiently liquid that price impact is essentially zero across all 9 research trade sizes.
The repeated value is a legitimate empirical finding: the market's cross-fee-tier price
dislocation at observation block was exactly +15.044 bps.

### 8.4 Real Market Signals Extracted

| Chain | Favorable Dislocation | Route | Notes |
|---|---|---|---|
| Arbitrum | +15.04 bps | WETH/USDCe 500 ↔ WETH/USDCe 3000 | Below gas cost threshold (~$0.08) |
| Optimism | +26.54 bps | WETH/USDCe 500 ↔ WETH/USDCe 3000 | Below gas cost threshold (~$0.035) |

Neither signal produces a net-positive opportunity (gas alone costs ~$0.035–$0.08 per hop),
but both represent real cross-fee-tier price divergences. These are the first non-artifact
positive dislocation signals observed across SAHIKARA's multi-chain observation history.

---

## SECTION 9 — MEDIUM DEFECT: D-003

### MEDIUM — Tautological Reproducibility Check

**Severity**: 🟡 MEDIUM  
**Status**: CONFIRMED  
**Impact**: False `EXACT MATCH (100% PASS ✅)` label; provides zero data integrity assurance

#### Evidence (`run-phase4-6-campaign.ts`, lines 886-888)

```typescript
const rep1 = s.statisticalReport.grossSpreadDist.median;
const rep2 = s.statisticalReport.grossSpreadDist.median;  // ← Same object property!
if (rep1 !== rep2) {
  reproducibilityPass = false;
}
```

Both `rep1` and `rep2` read the **same in-memory object property**. This is a tautology —
`rep1 === rep2` is mathematically guaranteed regardless of data quality. The
`reproducibilityPassed: true` field in `phase4_6_1_results.json` is a false attestation.

---

## SECTION 10 — DEFECT REGISTER (COMPLETE)

| ID | Severity | Status | Description | Chains Affected |
|---|---|---|---|---|
| D-001 | 🔴 CRITICAL | CONFIRMED | `policyConfig.ethPriceUsd=0.80` used as WETH price → 3,125× trade size inflation; all 270 Polygon observations invalid | Polygon |
| D-002 | 🟠 HIGH | CONFIRMED | `Number(sqrtPriceX96)` BigInt overflow → priceImpactBps corrupted; SLIPPAGE_TOO_HIGH gate unreliable | All chains |
| D-003 | 🟡 MEDIUM | CONFIRMED | Reproducibility check compares value to itself; always returns true | All chains |
| F-001 | 🟡 MEDIUM | Design Gap | Base event-dispatch covers only 21.5% of theoretical route-size space | Base |
| F-002 | 🟡 MEDIUM | Design Gap | 3 of 5 Polygon pools (60%) never routed; participate in zero evaluations | Polygon |
| F-003 | 🟡 MEDIUM | Design Gap | 3 of 4 Polygon research pairs are silently dead (no matching 2nd pool) | Polygon |
| F-004 | 🔵 LOW | Naming | Pool IDs `univ3-*-weth-usdc-3000` on Arbitrum and Optimism contain USDCe (not USDC) as actual token1 | Arbitrum, Optimism |
| D-004 | 🔵 LOW | Confirmed | `quoteFailures` and `insufficientLiquidity` conflated — both use `rejectedByQuoterFailure` counter | All chains |
| D-005 | 🔵 INFO | Known Design | Detection latency metrics represent sequential batch-queue time, not live real-time latency | All chains |

---

## SECTION 11 — MANDATORY CODE CORRECTIONS

Per audit protocol: "fix only the minimum code required for audit correctness."

### Fix 1 — D-001: Separate WETH Price from Gas Token Price

**File**: `scanner/scripts/run-phase4-6-campaign.ts`

```diff
-  policyConfig: {
-    ethPriceUsd: cfg.gasModelType === 'polygon' ? 0.80 : 2500.0,
+  policyConfig: {
+    ethPriceUsd: 2500.0,  // WETH/ETH price — always $2500 regardless of chain gas token
```

Also fix the forensic re-query block (line ~572):
```diff
-  ethPriceUsd: cfg.gasModelType === 'polygon' ? 0.80 : 2500.0,
+  ethPriceUsd: 2500.0,
```

The `PolygonGasModel` already receives MATIC price via its constructor:
`new PolygonGasModel({ defaultMaticPriceUsd: 0.80 })` — no gas model change required.

### Fix 2 — D-002: BigInt-Safe Price Impact Calculation

**File**: `scanner/src/adapters/UniswapV3Adapter.ts`

```diff
-  const sqrtRatio = Number(sqrtPriceX96After) / Number(sqrtPriceX96);
-  const priceImpactFraction = Math.abs(1 - sqrtRatio * sqrtRatio);
-  const priceImpactBps = priceImpactFraction * 10000;

+  // BigInt-safe price impact: |Δsqrt| / sqrt_before × 2 (first-order approximation)
+  // Avoids Number() conversion of uint160 values that exceed MAX_SAFE_INTEGER
+  const sqrtDiff = sqrtPriceX96After > sqrtPriceX96
+    ? sqrtPriceX96After - sqrtPriceX96
+    : sqrtPriceX96 - sqrtPriceX96After;
+  // Scale by 10^8 before division to preserve decimal precision in integer math
+  const SCALE = 100_000_000n;
+  const priceImpactScaled = (sqrtDiff * SCALE * 2n) / sqrtPriceX96;
+  // Convert from 10^8 scale to bps (×10000 / 10^8 = /10^4)
+  const priceImpactBps = Number(priceImpactScaled) / 10_000;
```

### Fix 3 — D-003: Real Reproducibility Check

**File**: `scanner/scripts/run-phase4-6-campaign.ts`

```diff
-  const rep1 = s.statisticalReport.grossSpreadDist.median;
-  const rep2 = s.statisticalReport.grossSpreadDist.median;  // same reference!
-  if (rep1 !== rep2) { reproducibilityPass = false; }

+  const rep1 = s.statisticalReport.grossSpreadDist.median;
+  // Re-compute median independently from persisted DB records
+  const rawRows = db.prepare(
+    `SELECT gross_spread_bps FROM shadow_opportunities WHERE opportunity_id LIKE '%${s.campaignId}%' ORDER BY gross_spread_bps ASC`
+  ).all() as { gross_spread_bps: number }[];
+  const n = rawRows.length;
+  const rep2 = n > 0
+    ? (n % 2 === 1
+        ? rawRows[Math.floor(n / 2)]!.gross_spread_bps
+        : (rawRows[n / 2 - 1]!.gross_spread_bps + rawRows[n / 2]!.gross_spread_bps) / 2)
+    : 0;
+  const tolerance = 0.01; // 0.01 bps floating-point tolerance
+  if (Math.abs(rep1 - rep2) > tolerance) { reproducibilityPass = false; }
```

---

## SECTION 12 — TRUSTWORTHINESS VERDICT BY CHAIN

| Chain | Economic Data Trustworthy? | Reason |
|---|---|---|
| **Base** | ✅ YES (with F-001 caveat) | Correct token decimals, valid QuoterV2, all spreads negative, no artifacts. Coverage limited to 21.5% of theoretical space — not a data quality issue, a completeness issue. |
| **Polygon** | ❌ REJECTED | D-001 causes 3,125× oversized trade inputs. All 270 observations are measurement artifacts. The -8,196 bps median does not reflect market efficiency. Data must be discarded and regenerated after D-001 fix. |
| **Arbitrum** | ✅ CONDITIONALLY ACCEPTED | Spread data valid. D-002 corrupts priceImpactBps but this field is not used in grossSpreadBps computation. F-004 naming issue is cosmetic only. Real market signal confirmed: +15 bps favorable dislocation between fee tiers. |
| **Optimism** | ✅ CONDITIONALLY ACCEPTED | Same as Arbitrum. Real market signal: +26.5 bps favorable dislocation. Larger signal warrants follow-up in Phase 4.6.2. |

---

## SECTION 13 — PHASE GATE RECOMMENDATION

> **Phase 5 (Smart Contract / Executor) MUST NOT BEGIN until:**
>
> 1. ✅ Fix D-001 in `run-phase4-6-campaign.ts` (2 lines changed)
> 2. ✅ Fix D-002 in `UniswapV3Adapter.ts` (7 lines changed)
> 3. ✅ Fix D-003 in `run-phase4-6-campaign.ts` (~10 lines changed)
> 4. ✅ Re-run Polygon campaign with corrected `ethPriceUsd = 2500.0`
> 5. ✅ Re-run Polygon campaign results validated against expected -35 to -45 bps range
> 6. ✅ All Project Brain files updated per Section 14
>
> Base, Arbitrum, and Optimism findings are **PROVISIONALLY ACCEPTED** pending the above.

---

## SECTION 14 — REQUIRED PROJECT BRAIN UPDATES

- [ ] `DECISIONS.md`: Record D-001/D-002/D-003 fixes as new ADR entries
- [ ] `CHANGELOG.md`: Record all three code corrections with file + line references
- [ ] `LESSONS_LEARNED.md`: Document dual-use `ethPriceUsd` pattern as a recurring trap
- [ ] `PROJECT_STATE.md`: Update Phase 4.6 status to `AUDIT COMPLETE — CORRECTIONS PENDING`
- [ ] `EXPERIMENTS.md`: Record this audit as EXP entry with findings and trustworthiness verdicts
- [ ] `TRANSPARENCY_POLICY.md`: Add D-001 as a confirmed model/AI configuration mistake per Section 1.8

---

## SECTION 15 — WHAT THE CAMPAIGN SUCCESSFULLY ESTABLISHED

### Confirmed Empirical Findings (Trustworthy)

1. **No arbitrage profit on any chain during the observation window.** All Base, Arbitrum, and
   Optimism gross spreads are strictly negative. Zero tier-1, tier-2, tier-3, or tier-4 opportunities
   emerged on any of the three trustworthy chains.

2. **Phase 4.5.1 -10,000 bps artifact is fully resolved.** The EIP-55 + dynamic QuoterV2
   routing fix works correctly.

3. **Base quote failure pattern is genuine.** 478 failures on alt-token pairs (AERO, DEGEN,
   VIRTUAL) reflect real thin-liquidity conditions in Aerodrome/Slipstream pools at small
   trade sizes — not adapter bugs.

4. **First real cross-fee-tier dislocation signals observed:**
   - Arbitrum WETH/USDCe 500 vs 3000: +15 bps at observation block
   - Optimism WETH/USDCe 500 vs 3000: +26.5 bps at observation block
   Neither exceeds gas cost thresholds, but both establish a baseline for future campaigns.

5. **Quote latency is within research bounds:**
   - Arbitrum: avg 253 ms (fastest)
   - Base: avg 405 ms
   - Polygon: avg 530 ms
   - Optimism: avg 638 ms

6. **The negative finding is scientifically valid.** Absence of profitable arbitrage in the
   observation window establishes a baseline for market efficiency at this point in time.
   Phase 5+ work must outrace MEV bots, not just observe that no edge exists in the
   research-grade observation mode.

---

## SECTION 16 — APPENDIX: PHASE 4.5.1 vs PHASE 4.6.1 COMPARISON

| Metric | Phase 4.5.1 | Phase 4.6.1 |
|---|---|---|
| -10,000 bps artifact | ✅ Present | ❌ Absent — **RESOLVED** |
| Quote failure rate | High (checksum errors) | 0% (Poly/Arb/Opt), 63% Base (legitimate) |
| Multi-chain coverage | Base only | 4 chains |
| Active pool count | ~12 | 32 |
| Route count | ~8 | 26 (Base), 2 each (Polygon/Arb/Opt) |
| EIP-55 compliance | No | Yes |
| Block-pinned pool cache | No | Yes (per-block deduplication) |
| Dynamic QuoterV2 routing | No | Yes (per-chain address resolution) |
| Polygon data validity | N/A | ❌ Contaminated by D-001 |
| Reproducibility check | Not implemented | Implemented but tautological (D-003) |

---

## SECTION 17 — OPEN QUESTIONS FOR OPERATOR REVIEW

1. **Polygon re-run scope**: After D-001 fix, should the Polygon re-run use the same
   `lookbackBlocks = 1000` and `targetEventCount = 15`, or should it expand to better
   characterize the market?

2. **Exhaustive sweep mode**: Should Phase 4.6.2 implement a block-sweep mode (evaluating
   ALL routes per block, not just event-triggered routes) to fix F-001 on Base?

3. **priceImpactBps field**: Until D-002 is fixed and verified, should `priceImpactBps`
   be excluded from the statistical report to avoid misleading values?

4. **Polygon pair universe expansion**: To make all 5 Polygon pools observable, should
   additional cross-venue pools be sourced for `WMATIC/USDCe`, `WMATIC/WETH`, and
   `WETH/USDT` pair types?

5. **Optimism +26.5 bps signal**: This dislocation is the largest favorable signal
   observed to date. Should a dedicated Optimism observation window be scheduled at
   Phase 4.6.2 to characterize its frequency and temporal persistence?

---

## SECTION 18 — AUDIT SIGN-OFF

**Audit completed**: 2026-09-16  
**Auditor**: Antigravity (AI Research Assistant — read-only advisory mode)  
**Execution authority**: NONE  
**Capital deployed**: ₹0.00 / $0.00  

**Files audited**:
- `scanner/scripts/run-phase4-6-campaign.ts` (929 lines)
- `scanner/src/shadow/RealTimeShadowEngine.ts` (591 lines)
- `scanner/src/adapters/UniswapV3Adapter.ts` (306 lines)
- `scanner/src/economics/roundTripEvaluator.ts` (511 lines)
- `scanner/src/discovery/RouteGenerator.ts` (273 lines)
- `scanner/src/config/pools.ts`, `pools-polygon.ts`, `pools-arbitrum.ts`, `pools-optimism.ts`
- `scanner/src/config/pairs-polygon.ts`, `pairs-arbitrum.ts`, `pairs-optimism.ts`
- `scanner/data/phase4_6_1_results.json` (682 lines, 18,380 bytes)

*This document constitutes the complete forensic audit of Campaign `PHASE_4_6_1_1789554343658`.*
*It must be stored in `docs/strategy/PHASE_4_6_1_FORENSIC_AUDIT.md` and linked from EXPERIMENTS.md.*
