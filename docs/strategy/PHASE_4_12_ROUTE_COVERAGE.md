# PHASE 4.12: Route Coverage & Topological Inventory Dossier

## 1. Route Generation Framework

The SAHIKARA Graph Route Generator (`GraphRouteGenerator`) constructs closed cyclic arbitrage graphs from verified liquidity pools. Route generation is strictly deterministic and adheres to three non-negotiable structural constraints:

1. **Cyclic Closure**: The input token of Leg 1 must match the final output token of the route:
   $$\text{tokenIn}_{\text{leg1}} \equiv \text{tokenOut}_{\text{final}}$$
2. **Distinct Pool Invariant**: No single liquidity pool contract may appear more than once within any route cycle:
   $$\text{pool}_{\text{leg } i} \neq \text{pool}_{\text{leg } j} \quad \forall i \neq j$$
3. **No Hidden Profitability Pruning**: Routes are never filtered or discarded based on prior assumptions of profitability. Pruning occurs solely for structural reasons (invalid bytecode, zero liquidity, or unsupported AMM mathematics).

---

## 2. Expanded Route Inventory (Phase 4.12 vs Phase 4.11)

In Phase 4.12, the generated route universe expanded from **78 routes** to **300 high-quality stratified routes** across the 4 networks:

```
Baseline Routes (Phase 4.11):          78 routes (58 2-hop, 20 triangular)
Expanded Inventory (Phase 4.12):      300 routes (200 2-hop, 100 triangular)
Expansion Multiplier:                 3.85x
Trade Sizes Evaluated:                8 sizes ($1, $5, $10, $25, $50, $100, $250, $500)
Total Evaluation Space:               2,400 evaluations (300 routes × 8 sizes)
```

### Route Breakdown by Chain & Topology

| Network | 2-Hop Cross-DEX Cycles | 3-Hop Triangular Cycles | Total Generated Routes | Distinct DEX Pairs Active |
| :--- | :---: | :---: | :---: | :--- |
| **Base** | 50 | 25 | 75 | Uniswap v3, Aerodrome Vol/Stable, Slipstream |
| **Arbitrum One** | 50 | 25 | 75 | Uniswap v3, Camelot v2, SushiSwap v2, Curve, Balancer v2 |
| **Optimism** | 50 | 25 | 75 | Uniswap v3, Velodrome v2 Vol/Stable |
| **Polygon PoS** | 50 | 25 | 75 | Uniswap v3, QuickSwap v2, SushiSwap v2 |
| **Total** | **200** | **100** | **300** | **8 integrated DEX protocols** |

---

## 3. Venue & Asset Coverage Matrix

### DEX Combination Coverage
- **Base**: Uniswap v3 $\leftrightarrow$ Aerodrome Volatile, Uniswap v3 $\leftrightarrow$ Aerodrome Stable, Uniswap v3 $\leftrightarrow$ Aerodrome Slipstream, Aerodrome Volatile $\leftrightarrow$ Aerodrome Stable.
- **Arbitrum One**: Uniswap v3 $\leftrightarrow$ Camelot v2, Uniswap v3 $\leftrightarrow$ SushiSwap v2, Camelot v2 $\leftrightarrow$ SushiSwap v2, Uniswap v3 $\leftrightarrow$ Curve StableSwap, Uniswap v3 $\leftrightarrow$ Balancer v2.
- **Optimism**: Uniswap v3 $\leftrightarrow$ Velodrome v2 Volatile, Uniswap v3 $\leftrightarrow$ Velodrome v2 Stable, Velodrome v2 Volatile $\leftrightarrow$ Velodrome v2 Stable.
- **Polygon PoS**: Uniswap v3 $\leftrightarrow$ QuickSwap v2, Uniswap v3 $\leftrightarrow$ SushiSwap v2, QuickSwap v2 $\leftrightarrow$ SushiSwap v2.

### Token Coverage
- **Stablecoins**: USDC, USDT, DAI, USDbC (Base), USDC.e (Arbitrum/Optimism/Polygon).
- **Major Bluechips**: WETH, WBTC.
- **Chain-Native & Ecosystem**: MATIC/POL, ARB, OP.
