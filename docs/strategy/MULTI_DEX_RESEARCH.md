# MULTI_DEX_RESEARCH.md — Multi-DEX Architecture, Protocols, and Quoting Mechanics

> **STATUS**: **ACTIVE SPECIFICATION (Phase 1E)**  
> **SCOPE**: Venue Mechanics & Adapter Specifications  
> **EPISTEMIC TAGS**: [FACT] = verified on-chain, [PROVISIONAL] = working adapter, [ESTIMATE] = gas model  

---

## 1. Overview & Multi-DEX Strategy

Phase 1E expands SAHIKARA's DEX registry and adapter architecture beyond Uniswap V3 and Aerodrome Volatile. To achieve genuine deterministic market discovery, the engine must compare prices across diverse AMM invariants (Constant Product, Concentrated Liquidity, and StableSwap) without violating capital safety or fabricating data.

---

## 2. Supported Protocol Implementations

### 1. Uniswap V3 (`uniswap-v3`)
- **Protocol Type**: Concentrated Liquidity AMM.
- **Contract Used**: `QuoterV2` (`0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` on Base).
- **Execution Mechanism**: `eth_call` to `quoteExactInputSingle((address,address,uint256,uint24,uint160))`.
- **Properties**: Returns exact `amountOut`, `sqrtPriceX96After`, `initializedTicksCrossed`, and `gasEstimate`.
- **Fee Tiers Supported**: 100 (1 bps), 500 (5 bps), 3000 (30 bps), 10000 (100 bps).
- **Status**: **ACTIVE & PROVEN** [FACT].

### 2. Aerodrome Volatile (`aerodrome-volatile`)
- **Protocol Type**: Constant Product AMM ($x \cdot y = k$).
- **Contract Used**: Aerodrome Router (`0xcF77a3Ba9A5CA399B7c97c748544594B7377576F` on Base).
- **Execution Mechanism**: `eth_call` to `getAmountsOut(uint256, (address,address,bool)[])`.
- **Properties**: Returns exact output array across pool hops with `stable = false`.
- **Fee**: Fixed 30 bps (0.30%).
- **Status**: **ACTIVE & PROVEN** [FACT].

### 3. Aerodrome Stable (`aerodrome-stable`)
- **Protocol Type**: Curve-style StableSwap invariant ($x^3y + y^3x = k$).
- **Contract Used**: Aerodrome Router (`0xcF77a3Ba9A5CA399B7c97c748544594B7377576F` on Base).
- **Execution Mechanism**: `eth_call` to `getAmountsOut` with `stable = true`.
- **Fee**: Low pool fee (typically 1 to 5 bps).
- **Status**: **ACTIVE** [FACT].

### 4. PancakeSwap V3 (`pancakeswap-v3`)
- **Protocol Type**: Concentrated Liquidity AMM (Uniswap V3 fork).
- **Contract Used**: `PancakeSwapV3QuoterV2` (`0x8553AA1615549A86882151784b329B017aA7c832` on Base).
- **Execution Mechanism**: `eth_call` to `quoteExactInputSingle`.
- **Handling of Uninitialized/Reverting Pools**: If a pool is empty or the quoter call reverts, `PancakeSwapV3Adapter` catches the error, records `QUOTE_FAILED`, and rejects the opportunity safely. Zero fake quotes are produced.
- **Status**: **INTEGRATED & VERIFIED** [FACT].

### 5. Aerodrome Slipstream (`aerodrome-slipstream`)
- **Protocol Type**: Aerodrome Concentrated Liquidity AMM (CL200).
- **Status**: **STUB / NOT_READY** [PROVISIONAL].
- **Handling**: `supports()` returns `false`. `getQuote()` returns explicit `ADAPTER_NOT_READY` error. Per DEC-015 and Project Rules, no fake data or approximations are generated until the on-chain quoter contract is verified and tested.

---

## 3. Granular Pool-Level Observation Identity

In multi-pool, multi-fee environments, identifying an observation solely by `(chain, pair, dex, block)` is insufficient because multiple pools can exist for the same pair and DEX (e.g. Uniswap V3 5 bps vs Uniswap V3 30 bps vs Uniswap V3 100 bps).

In Phase 1E, the canonical round-trip observation identity is defined as:
```typescript
const observationId = [
  'rt',
  blockNumber.toString(),
  route.id,
  route.leg1.pool.address.toLowerCase(),
  route.leg2.pool.address.toLowerCase(),
  amountIn.toString(),
].join('-');
```

Database uniqueness constraint:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_rt_logical_pool_unique 
ON round_trip_observations (pool_leg1, pool_leg2, amount_in, block_number);
```
This guarantees:
1. Exact duplicates are rejected idempotently.
2. Different fee tiers or pool addresses at the same block are preserved as distinct observations.
3. Different trade sizes are preserved as distinct observations.
