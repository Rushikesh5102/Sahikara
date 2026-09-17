# PHASE 4.12: DEX Adapter Validation & Boundary Enforcement

## 1. Overview & Adapter Inventory

The SAHIKARA market observation architecture relies on specialized adapters implementing the `IPoolAdapter` contract. Every adapter must execute **strictly read-only (`eth_call`)** calculations or contract simulations without wallet interaction, signing, or transaction broadcasting.

In Phase 4.12, adapter boundaries across 8 major DEX protocols were systematically verified:

| Adapter | Protocol Standard | Execution Mechanism | Fee Model | Chain Deployments |
| :--- | :--- | :--- | :--- | :--- |
| **UniswapV3Adapter** | Concentrated Liquidity | `QuoterV2.quoteExactInputSingle` | 1, 5, 30, 100 bps | Base, Arbitrum, OP, Polygon |
| **AerodromeAdapter** | Volatile & Stable | On-chain pool `getAmountOut` | 1 bps (stable), 5/30 bps (volatile) | Base |
| **AerodromeSlipstreamAdapter** | Concentrated Liquidity | `QuoterV2` simulation | 1, 5, 30, 100 bps | Base |
| **CamelotV2Adapter** | Dual-Fee Dynamic | Pair `getAmountOut(amountIn, tokenIn)` | Directional / Dynamic | Arbitrum One |
| **VelodromeAdapter** | Volatile & Stable | Pair `getAmountOut(amountIn, tokenIn)` | 5 bps (stable), 30 bps (volatile) | Optimism |
| **QuickSwapAdapter** | Constant Product V2 | Router formula / Pair reserves | 30 bps fixed | Polygon PoS |
| **SushiSwapAdapter** | Constant Product V2 | Router formula / Pair reserves | 30 bps fixed | Arbitrum, Polygon |
| **CurveAdapter** | StableSwap Invariant | Pool `get_dy(i, j, dx)` | Dynamic amplification | Arbitrum One |
| **BalancerV2Adapter** | Weighted 50/50 | Weighted invariant / Vault queries | 25-30 bps | Arbitrum One |

---

## 2. Forensic Boundary Enforcement

### 2.1 Balancer V2 Pool Typing & Forensic Boundary
- **Validation**: Balancer V2 pools are strictly classified by pool specialization (`WEIGHTED`, `STABLE`, `COMPOSABLE_STABLE`).
- **Safety Gate**: The adapter explicitly rejects non-weighted pools. Attempting to apply weighted logarithmic mathematics to composable stable or meta pools is strictly blocked with `UNSUPPORTED_POOL_TYPE`.
- **Status**: Weighted 50/50 pools are fully verified; generalized multi-asset Balancer pools remain categorized as unsupported until full on-chain Vault simulation is implemented.

### 2.2 Curve StableSwap Index Mapping
- **Validation**: Curve pools require exact token index resolution ($i, j$).
- **Safety Gate**: The adapter maintains explicit canonical coin-index maps per pool. Tokens not present in the coin array trigger immediate `QUOTE_FAILURE` rather than arbitrary fallback indices.
- **On-chain comparison**: Adapter queries `get_dy(i, j, dx)` directly against pool bytecode at the pinned block.

### 2.3 Camelot V2 Directional & Dynamic Fees
- **Validation**: Unlike standard Uniswap v2 forks with static 30 bps fees, Camelot v2 pairs can assess asymmetric directional swap fees.
- **Safety Gate**: Directional quotes invoke `pair.getAmountOut(amountIn, tokenIn)` directly to respect fee configurations configured in the pair state.

### 2.4 Concentrated-Liquidity BigInt Arithmetic
- **Validation**: In concentrated liquidity AMMs, $\sqrt{P_{\text{ratio}}}$ values exceed $2^{96}$ (values up to $\approx 1.58 \times 10^{33}$).
- **Safety Gate**: Native `bigint` bit-shifting (`>> 192n`) is enforced throughout the codebase. Conversion to `Number(sqrtPriceX96)` is prohibited to eliminate catastrophic precision truncation and synthetic price impact artifacts.

---

## 3. Fee Accounting & Non-Double-Counting Invariant

To avoid artificial profit compression or distortion:
1. Executable quotes returned by adapters (`amountOut`) **already reflect the deduction of pool swap fees** inside the AMM logic.
2. Gross PnL is computed strictly as:
   $$\text{Gross PnL} = \text{AmountOut}_{\text{final}} - \text{AmountIn}_{\text{initial}}$$
3. Pool fees ($\text{bps}$) are tracked purely as informational metadata and are **never subtracted a second time** from Gross PnL.
4. Net Expected Profit subtracts only:
   $$\text{Net PnL} = \text{Gross PnL} - \text{GasCost}_{\text{USD}} - \text{RiskBuffer}_{\text{USD}}$$
