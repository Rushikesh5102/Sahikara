# PHASE 4.11 — ECONOMIC AUDIT & FEE ACCOUNTING FORENSICS

> **STATUS**: COMPLETED / STRICT FORENSIC STANDARD  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (EXECUTION LOCKED)  
> **GATE STATE**: PHASE 5 BLOCKED

---

## 1. Executive Summary & Objective

Phase 4.11 establishes an exhaustive forensic audit of the economic calculation engine, fee accounting model, and cost-drag attribution across all 78 valid generated routes and 8 discrete trade sizes ($1 to $500).

The primary objectives of this economic audit are:
1. **Fee Accounting Integrity**: Verify whether every DEX adapter includes swap fees natively inside quotes or requires external fee deduction, proving zero fee double-counting.
2. **Gross Spread Math**: Ensure `grossRoundTripPnL = finalAmountOut - initialAmountIn` uses exact BigInt token amounts and true on-chain decimals without floating-point precision loss.
3. **Net Expected PnL Decomposition**: Dissect net profitability into its constituent drag components: pool swap fees, L1/L2 gas costs, price impact / slippage, and parameter buffer.
4. **Economic Truth Gate**: Validate that no quote failure, RPC timeout, or contract revert is silently converted into an economic spread.

---

## 2. DEX Adapter Fee Inclusion Audit

Every adapter was audited to determine whether `getQuote(pool, tokenIn, tokenOut, amountIn)` returns an amount that **already includes** the protocol swap fee deduction.

| DEX Adapter | Protocol Quote Method | Fee Subtraction Mechanism | Fee Included in Quote Output? | Risk of Double-Counting |
| :--- | :--- | :--- | :---: | :---: |
| **Uniswap V3** | `QuoterV2.quoteExactInputSingle` | On-chain contract simulates swap against ticks; fee tier (500, 3000, 10000) is deducted inside tick math | **YES** | **ZERO** (No external fee deducted) |
| **Aerodrome Volatile** | `Pair.getAmountOut` / analytical | $0.9995 \times \text{amountIn}$ (5 bps fee) deducted prior to constant-product reserve equation | **YES** | **ZERO** |
| **Aerodrome Stable** | `Pair.getAmountOut` | 1 bps fee deducted prior to $x^3y + y^3x$ invariant math | **YES** | **ZERO** |
| **Aerodrome Slipstream** | `SlipstreamQuoter.quoteExactInputSingle` | On-chain CL pool quoter deducts tick fee tier | **YES** | **ZERO** |
| **PancakeSwap V3** | `QuoterV2.quoteExactInputSingle` | Concentrated liquidity quoter deducts fee tier | **YES** | **ZERO** |
| **Curve Stableswap** | `Pool.get_dy(i, j, dx)` | Internal stableswap amplification formula deducts pool fee (e.g. 4 bps) | **YES** | **ZERO** |
| **Balancer V2** | Analytical Weighted / Vault query | Swap fee percentage deducted: $\text{amountInAfterFee} = \text{amountIn} \times (1 - \text{swapFee})$ | **YES** | **ZERO** |
| **Camelot V2** | `Pair.getAmountOut` | Dynamic/directional fee deducted by pair contract before constant-product reserve swap | **YES** | **ZERO** |
| **Velodrome V2 Volatile** | `Pair.getAmountOut` / analytical | Volatile fee (typically 30 bps or pool-configured fee) deducted from input | **YES** | **ZERO** |
| **Velodrome V2 Stable** | `Pair.getAmountOut` / analytical | Stable fee (typically 2–5 bps) deducted from input | **YES** | **ZERO** |
| **QuickSwap V2** | `Pair.getReserves` + formula | Formula: `amountInWithFee = amountIn * 997n` (30 bps fee built directly into integer formula) | **YES** | **ZERO** |
| **SushiSwap V2** | `Pair.getReserves` + formula | Formula: `amountInWithFee = amountIn * 997n` (30 bps fee built directly into integer formula) | **YES** | **ZERO** |

### Audit Finding:
All 12 adapter variants return an output amount that **already reflects the swap fee**. In `roundTripEvaluator.ts`, the gross profit is calculated strictly as:
$$\text{grossSpreadBps} = \frac{\text{finalAmountOut} - \text{initialAmountIn}}{\text{initialAmountIn}} \times 10,000$$
The engine does **NOT** subtract pool fees a second time. Fee metadata is tracked purely as descriptive attribution and never subtracted from `grossRoundTripPnL`.

---

## 3. Cost-Drag Decomposition

For an arbitrage route to produce a positive net return, the gross price discrepancy between venue $A$ and venue $B$ must exceed the cumulative cost stack:

$$\text{Required Gross Spread} > \text{Fee}_{\text{DEX}_1} + \text{Fee}_{\text{DEX}_2} + [\text{Fee}_{\text{DEX}_3}] + \text{PriceImpact}(\text{size}) + \text{GasCostUsd}(\text{size}) + \text{RiskBuffer}$$

### 3.1 Minimum Fee Drag Floor
- **2-hop V3/V2 or V2/V2**: Minimum fee floor is $5\text{ bps} + 30\text{ bps} = 35\text{ bps}$ (e.g. Aerodrome volatile 5 bps + Uniswap V3 30 bps or SushiSwap 30 bps). For V2/V2 cycles, fee floor is $30\text{ bps} + 30\text{ bps} = 60\text{ bps}$.
- **3-hop Triangular**: Minimum fee floor across 3 legs is $3 \times 30\text{ bps} = 90\text{ bps}$ (or $5 + 5 + 30 = 40\text{ bps}$ on Base).

### 3.2 L2 Gas Drag Scaling
On Base, Arbitrum, and Optimism, 2-hop execution consumes approximately 280,000 to 350,000 gas units (including L1 data fee).
- At $\$1$ trade size: A $\$0.005$ gas cost represents $50\text{ bps}$ of the capital.
- At $\$5$ trade size: $\$0.005$ represents $10\text{ bps}$.
- At $\$100$ trade size: $\$0.005$ represents $0.5\text{ bps}$.
- At $\$500$ trade size: $\$0.005$ represents $0.1\text{ bps}$.

On Polygon PoS, gas cost is typically $\$0.002$ to $\$0.008$. While absolute dollar costs are tiny, at micro-sizes ($1–$5), gas still constitutes a measurable drag.

### 3.3 Price Impact Dynamics
As trade size increases from $\$1$ to $\$500$, constant-product and concentrated-liquidity reserves experience non-linear price impact:
$$\Delta P \approx \frac{\Delta x}{x + \Delta x}$$
In deep pools ($TVL > \$5\text{M}$), $\$500$ trades experience $< 0.1\text{ bps}$ price impact. In shallower pools ($TVL < \$200\text{k}$), price impact reaches $10–45\text{ bps}$, causing gross spread to degrade rapidly at larger sizes.

---

## 4. Provenance Tagging Standard

Every data point generated in Phase 4.11 is strictly tagged according to epistemic provenance:

- `[OBSERVED]`: Values directly observed from on-chain state queries (e.g. pool reserves, block numbers, gas prices).
- `[QUOTED]`: Exact amounts out returned by live protocol quoter or router simulation for a specific block and input amount.
- `[SIMULATED]`: Route round-trip evaluation through sequential quoter calls.
- `[ESTIMATED]`: Gas unit consumption estimates based on standard multi-hop execution models.
- `[ASSUMPTION]`: External token reference prices (e.g. ETH = $2,600, MATIC = $0.35) used only for sizing and USD conversions.
- `[POLICY]`: Minimum safety thresholds (e.g. 10 bps risk buffer, $0.05 min net profit threshold).

---

## 5. False-Positive and False-Negative Prevention

1. **No Failure-to-Zero Conversion**: Any RPC timeout, quoter revert, or missing reserve is logged as a structured error (`CONTRACT_REVERT`, `RPC_ERROR`, `UNSUPPORTED_POOL_TYPE`) and completely excluded from gross spread statistics. It is never coerced to $0\text{ bps}$ or $-10,000\text{ bps}$.
2. **Exact Decimal BigInt Arithmetic**: Token amounts are scaled using `10n ** BigInt(decimals)` with exact BigInt division. No floating-point rounding is permitted in reserve calculations.
3. **Symbol Collision Isolation**: All pools and routes reference tokens by `chainId + address`. Symbols are treated solely as non-functional labels.
