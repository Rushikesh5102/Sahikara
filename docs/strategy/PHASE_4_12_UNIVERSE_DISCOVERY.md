# PHASE 4.12: Market-Universe Expansion & Discovery Dossier

## 1. Executive Summary

Phase 4.12 systematically expands the SAHIKARA monitored market universe beyond the Phase 4.11 baseline of 43 verified active pools and 78 generated routes. The core scientific question addressed is:
> *"Does the Phase 4.11 zero-opportunity result remain robust when the monitored universe is systematically expanded across deeper liquidity tiers, additional DEX protocols, and long-tail token pairs across all four target EVM networks?"*

This phase enforces a strict **RESEARCH AND VALIDATION ONLY** mandate. Capital at risk remains strictly **₹0.00 / $0.00**, with all execution engines locked, zero private keys or wallets instantiated, and zero transaction broadcasting capabilities enabled.

---

## 2. Discovery Methodology & Provenance

To prevent data contamination, external aggregator listings (e.g., CoinGecko, DexScreener, DefiLlama) were utilized strictly as secondary cross-references. All candidate pools were discovered and enumerated directly from authoritative on-chain factory and registry contracts:

| Chain | DEX Protocol | Canonical Factory Address | Enumeration Method |
| :--- | :--- | :--- | :--- |
| **Base** (8453) | Uniswap v3 | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | `getPool(tokenA, tokenB, fee)` |
| **Base** (8453) | Aerodrome (Volatile & Stable) | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | `getPool(tokenA, tokenB, stable)` |
| **Arbitrum One** (42161) | Uniswap v3 | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `getPool(tokenA, tokenB, fee)` |
| **Arbitrum One** (42161) | Camelot v2 | `0x6EcCab422D763aC031210895C81787E87B43A652` | `getPair(tokenA, tokenB)` |
| **Arbitrum One** (42161) | SushiSwap v2 | `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` | `getPair(tokenA, tokenB)` |
| **Arbitrum One** (42161) | Curve StableSwap | `0xb17b674d9c5cb2e441f887e5a292322056ca3734` | Address Provider / Registry |
| **Arbitrum One** (42161) | Balancer v2 | `0xBA12222222228d8Ba5314F45464202048A10E862` | Vault Pool Tokens Query |
| **Optimism** (10) | Uniswap v3 | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `getPool(tokenA, tokenB, fee)` |
| **Optimism** (10) | Velodrome v2 (Volatile & Stable)| `0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a` | `getPool(tokenA, tokenB, stable)` |
| **Polygon PoS** (137) | Uniswap v3 | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `getPool(tokenA, tokenB, fee)` |
| **Polygon PoS** (137) | QuickSwap v2 | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` | `getPair(tokenA, tokenB)` |
| **Polygon PoS** (137) | SushiSwap v2 | `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` | `getPair(tokenA, tokenB)` |

---

## 3. Discovered vs. Verified Universe Breakdown

Discovery output yielded **122 newly discovered active pools** across the 4 networks. Combined with the 43 baseline pools and deduplicated by canonical `chain:poolAddress`, the active monitored universe expanded from 43 to **137 verified pools**:

```
Baseline Verified Universe:           43 pools
Discovered Active Pools:             122 pools
Total Unique Verified Pools:         137 pools (318% increase over Phase 4.11)
```

### Breakdown by Chain

| Chain | Baseline Pools (P4.11) | Discovered Verified Pools (P4.12) | Combined Deduplicated Pools | Growth Factor |
| :--- | :---: | :---: | :---: | :---: |
| **Base** | 13 | 27 | 30 | +130.8% |
| **Arbitrum One** | 10 | 32 | 35 | +250.0% |
| **Optimism** | 8 | 28 | 32 | +300.0% |
| **Polygon PoS** | 12 | 35 | 40 | +233.3% |
| **Total** | **43** | **122** | **137** | **+218.6%** |

### Breakdown by DEX Protocol

| DEX Protocol | Type / Standard | Baseline Pools | Discovered Pools | Combined Pool Universe |
| :--- | :--- | :---: | :---: | :---: |
| **Uniswap v3** | Concentrated Liquidity | 24 | 60 | 66 |
| **Aerodrome** | V2 Volatile & Stable | 7 | 15 | 16 |
| **Aerodrome Slipstream** | Concentrated Liquidity | 2 | 2 | 2 |
| **Camelot v2** | Dual-Fee V2 Dynamic | 2 | 10 | 11 |
| **Velodrome v2** | V2 Volatile & Stable | 4 | 14 | 16 |
| **QuickSwap v2** | Constant Product (30 bps) | 2 | 10 | 11 |
| **SushiSwap v2** | Constant Product (30 bps) | 2 | 11 | 13 |
| **Curve** | StableSwap Invariant | 1 | 0 (Retained) | 1 |
| **Balancer v2** | 50/50 Weighted | 1 | 0 (Retained) | 1 |

---

## 4. Liquidity & Quality Stratification

Discovered pools were categorized into four formal research tiers:

- **TIER_0 (Current Verified Research Core)**: High-volume pools previously validated in Phase 4.10 and 4.11 ($5M+ TVL).
- **TIER_1 (Major Liquid Pools)**: Discovered on-chain pools with confirmed reserve depth exceeding $100,000 equivalent.
- **TIER_2 (Medium Liquidity Pools)**: Discovered pools with reserve depth between $10,000 and $100,000 equivalent.
- **TIER_3 (Controlled Long-Tail Sample)**: Select smaller pairs with reserve depth between $2,000 and $10,000 equivalent.
- **TIER_4 (Dust / Illiquid / Rejected)**: Zero or sub-threshold liquidity pools rejected during verification.

All 122 newly discovered candidate pools successfully satisfied Tier 1 and Tier 2 criteria with positive on-chain liquidity reserves.
