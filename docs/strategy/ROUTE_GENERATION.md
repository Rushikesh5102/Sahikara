# ROUTE_GENERATION.md — Deterministic Cross-DEX Route Generation

> **STATUS**: **IMPLEMENTED & VALIDATED (Phase 1E)**  
> **SCOPE**: Discovery Engine Routing Mechanics  
> **EPISTEMIC TAGS**: [FACT] = verified algorithm, [PROVISIONAL] = routing heuristics  

---

## 1. Problem Statement & Objectives

In Phase 1D, routes were statically hard-coded:
- Route A: Uniswap V3 (5 bps) → Aerodrome Volatile (30 bps)
- Route B: Aerodrome Volatile (30 bps) → Uniswap V3 (5 bps)

To support multiple pools per pair (e.g. 5 bps, 30 bps, 100 bps) and multiple DEX venues (Uniswap V3, Aerodrome, PancakeSwap V3, Slipstream) without manual route configuration, Phase 1E introduces the **`RouteGenerator`** (`scanner/src/discovery/RouteGenerator.ts`).

---

## 2. Route Generation Algorithm

The generator creates atomic 2-hop round-trips for each configured research pair:

```
            Initial Input Token (e.g., WETH)
                         │
                         ▼
        Leg 1: DEX Venue A (Pool A)
       Swap Token In → Intermediate Token (e.g., USDC)
                         │
                         ▼
        Leg 2: DEX Venue B (Pool B)
       Swap Intermediate Token → Final Token (WETH)
                         │
                         ▼
            Final Output Token (WETH)
```

### Constraints & Invariants:
1. **Distinct Venues**: Leg 1 DEX and Leg 2 DEX must be distinct (`leg1.pool.dex !== leg2.pool.dex`). Intra-DEX circular swaps are excluded.
2. **Adapter Readiness**: Both pools must be supported by an active, ready adapter. If an adapter returns `supports() === false` (such as the `AerodromeSlipstreamAdapter` stub), no routes involving that pool are generated.
3. **Verified Pools Only**: Only pools with verified addresses and status `active` are eligible.
4. **Directional Token Consistency**:
   - Leg 1 converts `baseToken` → `quoteToken`
   - Leg 2 converts `quoteToken` → `baseToken`
5. **Combinatorial Bounding**: Generates both forward (`DEX_A → DEX_B`) and reverse (`DEX_B → DEX_A`) paths, capped by `maxRoutesPerPair` (default: 10) to eliminate combinatorial explosion.

---

## 3. Mathematical Route Economics

For every generated route:
```
Leg 1 Quote:
  amountIn = initialTradeSize (in baseToken wei)
  intermediateAmountOut = quote(leg1.pool, amountIn)

Leg 2 Quote:
  leg2AmountIn = intermediateAmountOut
  finalAmountOut = quote(leg2.pool, leg2AmountIn)

Round-Trip Gross PnL:
  grossRoundTripPnL = finalAmountOut - initialAmountIn
```

All pool fees and slippage are already embedded inside `intermediateAmountOut` and `finalAmountOut`. Gas costs are estimated for the full 2-hop execution (`gasUnits: 260,000`), and a safety risk buffer ($0.001 - $0.010 depending on trade size) is deducted to yield `netExpectedProfit`.
