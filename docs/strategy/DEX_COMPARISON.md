# DEX_COMPARISON.md — Decentralized Exchange Protocol Evaluation

> **DOCUMENT STATUS**: ACTIVE RESEARCH (PHASE 1)  
> **PURPOSE**: Profile and evaluate candidate DEX protocols across mathematical model, pool structure, fee tiers, quoting interfaces, and execution efficiency.  
> **RULE**: Do NOT assume all protocols exist on all chains. Mark claims with truth-tier labels (`[FACT]`, `[ASSUMPTION]`, `[HYPOTHESIS]`).

---

## 1. Candidate DEX Protocols & Regional Priority

### 1.1 Priority Architecture by Network

#### A. Base Network (Primary Provisional Research Environment)
- **PRIMARY PROTOCOLS**:
  - **Aerodrome Finance**: Dominant native liquidity engine (>50% market share on Base) operating dual-curve and concentrated Slipstream pools.
  - **Uniswap v3**: Premier global routing volume on Base with deep concentrated liquidity pools.
  - *Provisional Route*: **Aerodrome ↔ Uniswap** is designated as the **first provisional cross-DEX pair** for opportunity research (`DEC-011`).
- **SECONDARY PROTOCOLS**:
  - **PancakeSwap v3**: Active multi-chain fork on Base with secondary liquidity.
  - **SushiSwap v3 / Curve**: Monitored as auxiliary liquidity sources.

#### B. Polygon PoS (Secondary Research Environment)
- **SECONDARY PROTOCOLS**:
  - **Uniswap v3**: Deepest concentrated liquidity pools on Polygon.
  - **QuickSwap**: Leading native Polygon DEX (Algebra concentrated v3 + legacy v2).
  - *Provisional Route*: **Uniswap v3 ↔ QuickSwap** maintained for secondary comparative research (`DEC-009`).

> **CRITICAL POOL STATUS NOTICE**: **No pool contracts are finalized.** All specific pool addresses, token pairings, and fee tier parameters remain under active research and will only be locked after empirical spread data is collected.

---

## 2. Candidate DEX Protocols Overview

| Protocol | Target Chain Role | AMM Math Model | Fee Tiers | Quoting Interface |
| :--- | :--- | :--- | :--- | :--- |
| **Aerodrome** | Base (PRIMARY) | ve(3,3) Volatile ($x \cdot y = k$), Stable, & Slipstream (CL) | 0.01% to 1.00% (Pair specific) | `Router.getAmountsOut` / `SlipstreamQuoter` |
| **Uniswap v3** | Base (PRIMARY) / Polygon (SECONDARY) | Concentrated Liquidity ($L, \sqrt{P}, \text{ticks}$) | 0.01%, 0.05%, 0.30%, 1.00% | `QuoterV2` / Tick Math |
| **QuickSwap** | Polygon (SECONDARY) | Algebra Concentrated Liquidity + v2 ($x \cdot y = k$) | Dynamic (0.01%–1.0%) or Static (0.3%) | `AlgebraQuoter` / `getAmountsOut` |
| **PancakeSwap v3**| Base (SECONDARY) | Concentrated Liquidity (v3 fork) + v2 | 0.01%, 0.05%, 0.25%, 1.00% | `QuoterV2` |
| **SushiSwap (v2/v3)**| Multi-chain (Secondary) | Trident / Concentrated + v2 ($x \cdot y = k$) | 0.05%, 0.30% (standard) | `RouteProcessor` / `getAmountsOut` |
| **Curve Finance** | Multi-chain (Auxiliary) | Stableswap Invariant + CryptoSwap (v2) | 0.04% (stables), dynamic (crypto) | Direct pool `get_dy` |

---

## 2. Detailed Protocol Profiles

### 2.1 Uniswap v3
- **`[FACT]` AMM Mechanics**: Concentrated liquidity where liquidity providers allocate capital within discrete price intervals called "ticks" ($\Delta \text{tick} = 1.0001^{\text{tick}}$). Capital efficiency is $100\times$ to $4000\times$ higher than Uniswap v2, leading to much lower slippage for typical retail trade sizes.
- **`[FACT]` Fee Structure**: Four discrete fee tiers:
  - `100` ($0.01\%$, tick spacing 1): Ultra-stable pairs (USDC/USDT).
  - `500` ($0.05\%$, tick spacing 10): Correlated pairs and high-volume stables (WETH/USDC).
  - `3000` ($0.30\%$, tick spacing 60): Standard volatile pairs.
  - `10000` ($1.00\%$, tick spacing 200): Exotic or low-liquidity pairs.
- **`[FACT]` Quoting Architecture**:
  - Off-chain calculation requires loading initialized ticks via `tickBitmap` and simulating tick-crossing arithmetic.
  - On-chain quoting via `QuoterV2` requires executing an `eth_call` revert-pattern or static call. `QuoterV2` consumes ~$80,000–$150,000 gas during simulation.
- **`[FACT]` Execution Interface**: Swaps can be executed via `SwapRouter02`, `UniversalRouter`, or directly calling `IUniswapV3Pool.swap()`. Direct pool calls save 20–35% in gas overhead compared to the multi-token Universal Router.
- **`[FACT]` Security & Maturity**: Most battle-tested concentrated liquidity codebase in DeFi; formal verification and multi-million dollar bug bounties.
- **`[ASSUMPTION]` Implementation Difficulty**: High. Accurate off-chain simulation requires full reimplementation of tick traversal and $\sqrt{P}$ arithmetic.

---

### 2.2 QuickSwap (Polygon PoS)
- **`[FACT]` AMM Mechanics**: QuickSwap operates two parallel engines on Polygon:
  1. **QuickSwap v2**: Traditional constant product ($x \cdot y = k$) with static 0.30% fee.
  2. **QuickSwap v3 (Algebra Engine)**: Concentrated liquidity engine built on the Algebra Protocol featuring dynamic fee calculation based on volatility and pool volume.
- **`[FACT]` Fee Structure**: Dynamic fees range between $0.01\%$ and $1.00\%$ per pool, updated programmatically or configured per pair.
- **`[FACT]` Quoting Architecture**:
  - v2 uses standard deterministic formula:
    $$\Delta y = \frac{997 \cdot \Delta x \cdot y}{1000 \cdot x + 997 \cdot \Delta x}$$
  - v3 uses Algebra's `IQuoter` interface.
- **`[FACT]` Execution Interface**: Direct pool swaps or through `QuickswapRouter`.
- **`[ASSUMPTION]` Implementation Difficulty**: Medium for v2; High for v3 Algebra (custom tick math nuances distinct from Uniswap v3).

---

### 2.3 Aerodrome Finance (Base)
- **`[FACT]` AMM Mechanics**: A modified fork of Solidly / Velodrome utilizing ve(3,3) tokenomics and dual-curve liquidity:
  1. **Volatile Pools**: Constant product formula ($x \cdot y = k$).
  2. **Stable Pools**: Stableswap invariant ($x^3y + y^3x \ge k$) for pegged assets.
  3. **Slipstream Pools**: Concentrated liquidity based on Uniswap v3 mechanics.
- **`[FACT]` Fee Structure**: Variable fees determined by veAERO governance per pool, typically $0.05\%$ on volatile and $0.01\%$ on stable pairs.
- **`[FACT]` Quoting & Routing**: Clean `Router.getAmountOut()` for dual-curve pools; `SlipstreamQuoter` for concentrated pools.
- **`[FACT]` Market Position**: Commands over 50% of all DEX volume on Base, making it the non-negotiable counterpart to Uniswap v3 on Base.

---

### 2.4 SushiSwap (v2 / Trident / v3)
- **`[FACT]` AMM Mechanics**: Deployed across almost every EVM chain. Operates legacy v2 pools ($x \cdot y = k$) alongside v3 concentrated liquidity pools.
- **`[FACT]` Router Architecture**: Uses `RouteProcessor4` and `RouteProcessor5` to aggregate liquidity across multiple internal and external pools.
- **`[FACT]` Relevance for Arbitrage**: Often has delayed price updates relative to Uniswap v3 or QuickSwap due to lower natural retail trading flow, creating persistent arbitrage windows.

---

### 2.5 Curve Finance
- **`[FACT]` AMM Mechanics**: Optimized for low-slippage trades between identically priced assets (e.g. USDC vs USDT) using the Stableswap Invariant:
  $$A \cdot n^n \sum x_i + D = A \cdot D \cdot n^n + \frac{D^{n+1}}{n^n \prod x_i}$$
  Also operates "CryptoSwap" (Curve v2) for volatile pairs.
- **`[FACT]` Fee Structure**: Very low on stable pools ($0.04\%$), but smart contract gas consumption on EVM is relatively high due to iterative Newton-Raphson approximations.
- **`[ASSUMPTION]` Suitability for SAHIKARA Phase 1**: Lower priority for spatial cross-pair arbitrage due to high gas usage per swap and specialized invariant equations, unless focusing strictly on stablecoin peg dislocations.

---

## 3. Protocol Comparison Matrix

| Protocol | Code Maturity | Gas Efficiency (Direct Pool) | Off-Chain Math Complexity | SDK / Developer Tooling | Suitability for Phase 2–3 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Uniswap v3** | Exemplary | High (~110k gas) | High (Tick math) | Excellent (@uniswap/v3-sdk) | **Primary Target** |
| **QuickSwap (v2/v3)**| High | Very High (~95k v2 / ~120k v3) | Medium (v2) / High (v3) | Good | **Primary Target (Polygon)** |
| **Aerodrome** | High | High (~100k gas) | Low (v2) / High (Slipstream)| Good | **Primary Target (Base)** |
| **SushiSwap v2** | High | Very High (~90k gas) | Very Low ($x \cdot y = k$) | Very Good | Secondary Target |
| **Curve Finance** | High | Medium (~180k gas) | Very High (Iterative) | Moderate (Python/Vyper)| Deferred |

---

## 4. Key Protocol Invariants & Execution Rules

1. **Direct Pool Execution vs Router**:
   - SAHIKARA will **never route trades through generic frontend routers** (`UniversalRouter`, `SwapRouter`) in production execution contracts.
   - All multi-hop cycles will interact **directly with pool contracts** (`IUniswapV3Pool.swap()`, `IUniswapV2Pair.swap()`), saving 15,000–35,000 gas units per hop.
2. **Atomic Execution Contract Pattern**:
   - `ArbitrageExecutor.sol` (Phase 5) will act as the recipient in the first swap and immediately fund the second swap, enforcing balance delta verification before completing the transaction.
