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

| Pool ID | Token Pair | Fee Tier | Address [FACT] | Priority | Verification Result |
|---|---|---|---|---|---|
| `univ3-base-weth-usdc-500` | WETH/USDC | 5 bps (0.05%) | `0xd0b53D9277642d899DF5C87A3966A349A798F224` | **PRIMARY** | VERIFIED: Factory.getPool(WETH, USDC, 500) |
| `univ3-base-usdc-usdbc-100` | USDC/USDbC | 1 bps (0.01%) | `0x06959273E9A65433De71F5A452D529544E07dDD0` | Secondary | VERIFIED: Factory.getPool(USDC, USDbC, 100) |
| `univ3-base-weth-cbbtc-500` | WETH/cbBTC | 5 bps (0.05%) | `0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1` | Secondary | VERIFIED: Factory.getPool(WETH, cbBTC, 500) |

> **`[FACT]`** Uniswap v3 Factory on Base: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (bytecode verified: 24,670 bytes)  
> **`[FACT]`** Uniswap v3 QuoterV2 on Base: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` (bytecode verified: 16,548 bytes)  
> **`[INVALIDATED]`** Previous provisional Quoter address `0x3d4e44eb1374240ce5f1b13678dadb69ba684bb` had 39 hex characters (malformed). Correct canonical address is `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`.  
> **`[INVALIDATED]`** Previous provisional WETH/cbBTC address `0x3c0ece5bed2f09df5e8d33ab17cdb9e3bc00d9af` returned empty data (`0x`). Correct canonical address discovered from factory is `0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1`.

### 3.2 Aerodrome Finance Pools (Base Mainnet)

| Pool ID | Token Pair | Type | Fee Tier [FACT] | Address [FACT] | Priority | Verification Result |
|---|---|---|---|---|---|---|
| `aero-base-weth-usdc-volatile` | WETH/USDC | Volatile (x·y=k) | 30 bps (0.30%) | `0xcDAC0d6c6C59727a65F871236188350531885C43` | **PRIMARY** | VERIFIED: Factory.getPool(WETH, USDC, false) |
| `aero-base-usdc-usdbc-stable` | USDC/USDbC | Stable (stableswap) | 5 bps (0.05%) | `0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD` | Secondary | VERIFIED: Factory.getPool(USDC, USDbC, true) |
| `aero-base-weth-usdc-slipstream` | WETH/USDC | Slipstream (CL) | 5 bps [PROVISIONAL] | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | **STUB** | Deferred per DEC-015 |

> **`[FACT]`** Aerodrome Factory on Base: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` (checksum validated; Router defaultFactory() confirmed)  
> **`[FACT]`** Aerodrome Router on Base: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` (bytecode verified: 47,164 bytes)  
> **`[CORRECTION]`** Aerodrome pools do not expose a public `fee()` getter. Fees must be queried from the factory via `Factory.getFee(poolAddress, stable)`. Volatile WETH/USDC fee is 30 bps (0.30%); Stable USDC/USDbC fee is 5 bps (0.05%).

---

## 4. Cross-DEX Research Pairs

These are the pairs the observation engine actively monitors for spatial arbitrage opportunities:

| Pair ID | Description | Status |
|---|---|---|
| `weth-usdc-univ3-vs-aero-volatile` | WETH/USDC: Uniswap v3 (5 bps) ↔ Aerodrome volatile (30 bps) — **Primary [DEC-011]** | Observable (Active) |
| `usdc-usdbc-univ3-vs-aero-stable` | USDC/USDbC: Uniswap v3 (1 bps) ↔ Aerodrome stable (5 bps) — Stablecoin peg dislocation | Observable (Active) |

---

## 5. Pool Address Verification Procedure

> [!IMPORTANT]
> All active pool addresses in the registry have now been empirically verified on-chain via contract factory calls on Base Mainnet.

**For Uniswap v3:**
```
Call: IUniswapV3Factory(0x33128a8fC17869897dcE68Ed026d694621f6FDfD).getPool(token0, token1, fee)
Example: getPool(WETH, USDC, 500) → returns 0xd0b53D9277642d899DF5C87A3966A349A798F224 [FACT]
```

**For Aerodrome:**
```
Call: IPoolFactory(0x420DD381b31aEf6683db6B902084cB0FFECe40Da).getPool(token0, token1, stable)
Example: getPool(WETH, USDC, false) → returns 0xcDAC0d6c6C59727a65F871236188350531885C43 [FACT]
         getPool(USDC, USDbC, true) → returns 0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD [FACT]
Call: IPoolFactory(0x420DD381b31aEf6683db6B902084cB0FFECe40Da).getFee(pool, stable)
Example: getFee(0xcDAC0d6c..., false) → 30 bps [FACT]
         getFee(0x27a8Afa3..., true)  → 5 bps [FACT]
```

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
