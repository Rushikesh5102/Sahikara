# POOL_REGISTRY.md — Candidate Pool Registry

> **DOCUMENT STATUS**: ACTIVE (PHASE 1C)  
> **POOL STATUS**: ALL PROVISIONAL — No pool is finalized until empirical spread data validates it.  
> **RULE**: Do NOT permanently whitelist any token or pool based solely on this document.

---

## 1. Registry Philosophy

The pool registry (`scanner/src/config/pools.ts`) is a **configurable research tool**, not a production allowlist. Its purpose is to initialize the observation engine with candidate pools for empirical spread research.

**All entries are `[PROVISIONAL]`** unless upgraded by a formal `DECISIONS.md` entry following empirical validation.

---

## 2. Pool Selection Rationale

Pools were selected based on criteria from `DEX_COMPARISON.md` and `LIQUIDITY_RESEARCH.md`:

1. **High volume** — ensures frequent swap events that generate spread opportunities
2. **Dual-DEX coverage** — same token pair across two independent DEXs (required for spatial arbitrage)
3. **Liquid reserves** — minimum $5,000 reserve equivalent per `RISK_POLICY.md`
4. **Stable tokens** — USDC, USDT, WETH (no rebasing tokens, no low-cap tokens)
5. **Fee tier diversity** — covers ultra-low (1 bps), low (5 bps), and standard (30 bps) fee tiers

---

## 3. Current Registry

### 3.1 Uniswap v3 Pools (Base Mainnet)

| Pool ID | Token Pair | Fee Tier | Address (PROVISIONAL) | Priority |
|---|---|---|---|---|
| `univ3-base-weth-usdc-500` | WETH/USDC | 5 bps (0.05%) | `0xd0b53D9...` | **PRIMARY** |
| `univ3-base-usdc-usdbc-100` | USDC/USDbC | 1 bps (0.01%) | `0x06959273...` | Secondary |
| `univ3-base-weth-cbbtc-500` | WETH/cbBTC | 5 bps (0.05%) | `0x3C0ecE5b...` | Secondary |

> **`[FACT]`** Uniswap v3 Factory on Base: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`  
> **`[PROVISIONAL]`** Pool addresses above must be verified by calling `Factory.getPool(token0, token1, fee)`.

### 3.2 Aerodrome Finance Pools (Base Mainnet)

| Pool ID | Token Pair | Type | Fee Tier | Address (PROVISIONAL) | Priority |
|---|---|---|---|---|---|
| `aero-base-weth-usdc-volatile` | WETH/USDC | Volatile (x·y=k) | 30 bps [ASSUMPTION] | `0xcDAC0d6c...` | **PRIMARY** |
| `aero-base-usdc-usdbc-stable` | USDC/USDbC | Stable (stableswap) | 1 bps [ASSUMPTION] | `0x27a8Afa3...` | Secondary |
| `aero-base-weth-usdc-slipstream` | WETH/USDC | Slipstream (CL) | 5 bps [PROVISIONAL] | `0xb2cc224c...` | **STUB** |

> **`[FACT]`** Aerodrome Factory on Base: `0x420DD381b31aEf6683db6B902084cB0FFECe40D`  
> **`[FACT]`** Aerodrome Router on Base: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`  
> **`[PROVISIONAL]`** Pool addresses must be verified via `Factory.getPool(token0, token1, stable)`.

---

## 4. Cross-DEX Research Pairs

These are the pairs the observation engine actively monitors for spatial arbitrage opportunities:

| Pair ID | Description | Status |
|---|---|---|
| `weth-usdc-univ3-vs-aero-volatile` | WETH/USDC: Uniswap v3 (5 bps) ↔ Aerodrome volatile (30 bps) — **Primary [DEC-011]** | Observable |
| `usdc-usdbc-univ3-vs-aero-stable` | USDC/USDbC: Uniswap v3 (1 bps) ↔ Aerodrome stable (1 bps) | Observable |

---

## 5. Pool Address Verification Procedure

> [!IMPORTANT]
> All pool addresses in the registry are `[PROVISIONAL]`. Before relying on any observation data, verify each address on-chain.

**For Uniswap v3:**
```
Call: IUniswapV3Factory(0x33128a8fC17869897dcE68Ed026d694621f6FDfD).getPool(token0, token1, fee)
Example: getPool(WETH, USDC, 500) → should return the canonical WETH/USDC 0.05% pool address
```

**For Aerodrome:**
```
Call: IPoolFactory(0x420DD381b31aEf6683db6B902084cB0FFECe40D).getPool(token0, token1, stable)
Example: getPool(WETH, USDC, false) → volatile pool address
         getPool(USDC, USDbC, true) → stable pool address
```

This verification should be conducted in Phase 1D as a first empirical task.

---

## 6. Token Registry

All tokens in the registry are sourced from official deployments:

| Symbol | Address | Decimals | Source |
|---|---|---|---|
| WETH | `0x4200...0006` | 18 | [FACT] Canonical WETH9 on Base |
| USDC | `0x8335...913` | 6 | [FACT] Circle native USDC on Base |
| USDbC | `0xd9aA...4CA` | 6 | [FACT] Bridged USDC on Base |
| DAI | `0x50c5...0Cb` | 18 | [FACT] DAI on Base |
| cbBTC | `0xcbB7...bCf` | 8 | [FACT] Coinbase wrapped BTC |
| AERO | `0x9401...631` | 18 | [FACT] Aerodrome governance token |

---

## 7. Adding New Pools

To add a new pool to the registry:

1. Verify the pool address on-chain (Section 5 above)
2. Add the entry to `scanner/src/config/pools.ts` with `tier: '[PROVISIONAL]'`
3. Add a note describing the source of the address
4. Document the addition in `DECISIONS.md` if it represents a strategic choice
5. Update this document's registry table

Do NOT set `tier: '[FACT]'` until empirical spread data has been collected from that pool and the address has been independently confirmed.
