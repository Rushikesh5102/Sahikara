# PHASE 4.9 — ECONOMIC SENSITIVITY RESEARCH
## Parameterized Evaluation of Risk Buffers & Economic Constraints

> **STATUS**: COMPLETE — RESEARCH ONLY  
> **SCOPE**: Multi-Tier Sensitivity Analysis across Risk Buffers ($0.00 to $0.25)  
> **GOVERNANCE STATUS**: POLICY LOCKED. Sensitivity results DO NOT represent empirical profitability.  
> **SAFETY INVARIANT**: Capital at risk: ₹0.00 / $0.00. Zero execution. Phase 5 strictly blocked.

---

## 1. Executive Summary

A central inquiry of Phase 4.9 is to determine whether SAHIKARA's policy risk buffer ($0.25 on standard sizes, or 10 bps) artificially concealed genuine economic profitability in the 4 historical gross-positive candidates identified in Phase 4.7.

To address this question with mathematical rigor, the [`EconomicSensitivityMatrix`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/scanner/src/economics/EconomicSensitivityMatrix.ts) evaluated all 4 historical candidates across eight discrete risk-buffer tiers:
$$\text{Buffer} \in \{\$0.00, \$0.001, \$0.005, \$0.010, \$0.025, \$0.050, \$0.100, \$0.250\}$$

### Definitive Finding
**Zero historical candidates achieve positive net profit even under a zero risk buffer ($\text{Buffer} = \$0.00$).**

The primary economic friction preventing profitability is **GAS COST DRAG** on L2 rollups and **PRICE IMPACT INVERSION** on Polygon, not the risk buffer. Eliminating the risk buffer entirely does not convert a single observed historical micro-spread into a viable arbitrage trade.

---

## 2. Granular Sensitivity Matrix Across Historical Candidates

### 2.1 Candidate HIST-CAND-001: Arbitrum Triangular ($1 Size)
- **Route**: `tri:arbitrum:weth-usdc-usdt-weth-1bps`
- **Block**: 505839106 | **Gross Spread**: +5.46 bps | **Gross Profit**: $0.000546
- **DEX Fee Drag**: $0.000300 (3 bps cumulative across 3 legs)
- **Gas Cost**: $0.080000 (Arbitrum Nitro execution + L1 calldata fee)
- **Other Costs (Slippage/Impact)**: $0.000100

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐
│ Risk Buffer │ Gross PnL    │ DEX Fee Drag │ Gas Cost     │ Other Costs  │ Risk Buffer  │ Net PnL      │ Profitable?      │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────────┤
│ $0.0000     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.000000    │ -$0.079554   │ NO (Loss -7955b) │
│ $0.0010     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.001000    │ -$0.080554   │ NO (Loss -8055b) │
│ $0.0050     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.005000    │ -$0.084554   │ NO (Loss -8455b) │
│ $0.0100     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.010000    │ -$0.089554   │ NO (Loss -8955b) │
│ $0.0250     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.025000    │ -$0.104554   │ NO (Loss -10455b)│
│ $0.0500     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.050000    │ -$0.129554   │ NO (Loss -12955b)│
│ $0.1000     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.100000    │ -$0.179554   │ NO (Loss -17955b)│
│ $0.2500     │ $0.000546    │ $0.000300    │ $0.080000    │ $0.000100    │ $0.250000    │ -$0.329554   │ NO (Loss -32955b)│
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```
**Limiting Constraint**: `GAS_DRAG`. Gas cost ($0.08) exceeds gross profit ($0.000546) by **146.5x**.

---

### 2.2 Candidate HIST-CAND-002: Arbitrum Triangular ($5 Size)
- **Route**: `tri:arbitrum:weth-usdc-usdt-weth-1bps`
- **Block**: 505839106 | **Gross Spread**: +4.17 bps | **Gross Profit**: $0.002085
- **DEX Fee Drag**: $0.001500 (3 bps cumulative)
- **Gas Cost**: $0.080000
- **Other Costs**: $0.000200

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐
│ Risk Buffer │ Gross PnL    │ DEX Fee Drag │ Gas Cost     │ Other Costs  │ Risk Buffer  │ Net PnL      │ Profitable?      │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────────┤
│ $0.0000     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.000000    │ -$0.078115   │ NO (Loss -1562b) │
│ $0.0010     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.001000    │ -$0.079115   │ NO (Loss -1582b) │
│ $0.0050     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.005000    │ -$0.083115   │ NO (Loss -1662b) │
│ $0.0100     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.010000    │ -$0.088115   │ NO (Loss -1762b) │
│ $0.0250     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.025000    │ -$0.103115   │ NO (Loss -2062b) │
│ $0.0500     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.050000    │ -$0.128115   │ NO (Loss -2562b) │
│ $0.1000     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.100000    │ -$0.178115   │ NO (Loss -3562b) │
│ $0.2500     │ $0.002085    │ $0.001500    │ $0.080000    │ $0.000200    │ $0.250000    │ -$0.328115   │ NO (Loss -6562b) │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```
**Limiting Constraint**: `GAS_DRAG`. Gas cost ($0.08) exceeds gross profit ($0.002085) by **38.4x**.

---

### 2.3 Candidate HIST-CAND-003: Polygon 2-Hop WMATIC/USDC ($1 Size)
- **Route**: `2hop:polygon:wmatic-usdc-1bps->wmatic-usdc-5bps`
- **Block**: 93919709 | **Gross Spread**: +8.51 bps | **Gross Profit**: $0.000851
- **DEX Fee Drag**: $0.000600 (6 bps cumulative)
- **Gas Cost**: $0.001000 (Polygon PoS execution)
- **Other Costs**: $0.000050

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐
│ Risk Buffer │ Gross PnL    │ DEX Fee Drag │ Gas Cost     │ Other Costs  │ Risk Buffer  │ Net PnL      │ Profitable?      │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────────┤
│ $0.0000     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.000000    │ -$0.000199   │ NO (Loss -1.99b) │
│ $0.0010     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.001000    │ -$0.001199   │ NO (Loss -11.99b)│
│ $0.0050     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.005000    │ -$0.005199   │ NO (Loss -51.99b)│
│ $0.0100     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.010000    │ -$0.010199   │ NO (Loss -102b)  │
│ $0.0250     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.025000    │ -$0.025199   │ NO (Loss -252b)  │
│ $0.0500     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.050000    │ -$0.050199   │ NO (Loss -502b)  │
│ $0.1000     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.100000    │ -$0.100199   │ NO (Loss -1002b) │
│ $0.2500     │ $0.000851    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.250000    │ -$0.250199   │ NO (Loss -2502b) │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```
**Limiting Constraint**: `GAS_DRAG`. Even on Polygon where gas is only $0.0010, the gross profit ($0.000851) does not cover execution gas! At $0 buffer, net loss is -$0.000199 (-1.99 bps).

---

### 2.4 Candidate HIST-CAND-004: Polygon 2-Hop WMATIC/USDC.e ($1 Size)
- **Route**: `2hop:polygon:wmatic-usdc.e-1bps->wmatic-usdc.e-5bps`
- **Block**: 93919709 | **Gross Spread**: +8.76 bps | **Gross Profit**: $0.000876
- **DEX Fee Drag**: $0.000600 (6 bps cumulative)
- **Gas Cost**: $0.001000
- **Other Costs**: $0.000050

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐
│ Risk Buffer │ Gross PnL    │ DEX Fee Drag │ Gas Cost     │ Other Costs  │ Risk Buffer  │ Net PnL      │ Profitable?      │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────────┤
│ $0.0000     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.000000    │ -$0.000174   │ NO (Loss -1.74b) │
│ $0.0010     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.001000    │ -$0.001174   │ NO (Loss -11.74b)│
│ $0.0050     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.005000    │ -$0.005174   │ NO (Loss -51.74b)│
│ $0.0100     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.010000    │ -$0.010174   │ NO (Loss -101b)  │
│ $0.0250     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.025000    │ -$0.025174   │ NO (Loss -252b)  │
│ $0.0500     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.050000    │ -$0.050174   │ NO (Loss -502b)  │
│ $0.1000     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.100000    │ -$0.100174   │ NO (Loss -1002b) │
│ $0.2500     │ $0.000876    │ $0.000600    │ $0.001000    │ $0.000050    │ $0.250000    │ -$0.250174   │ NO (Loss -2502b) │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```
**Limiting Constraint**: `GAS_DRAG`. At $0 buffer, net loss is -$0.000174 (-1.74 bps).

---

## 3. The Trade-Off Paradox: Gas Drag vs Price Impact

Could increasing trade size overcome the gas cost floor?
The multi-size data collected in Phase 4.7 and Phase 4.8 reveals an inescapable economic paradox:

1. **At Micro Sizes ($1 to $5)**:
   - Price impact is negligible ($\approx 0.001\%$).
   - Gross spread is positive (+4.17 bps to +8.76 bps).
   - **GAS DRAG DESTROYS THE PROFIT**: On Arbitrum, gas ($0.08) is 146x gross profit. On Polygon, gas ($0.001) is 1.17x gross profit.

2. **At Macro Sizes ($25 to $1,000)**:
   - Gas cost becomes a negligible fraction of trade size (<0.3 bps at $1,000).
   - **PRICE IMPACT DESTROYS THE SPREAD**: In the 1 bps and 5 bps pools, trading $50 to $1,000 immediately shifts the pool's tick by 10 to 50 bps, inverting the gross spread from +8 bps to -4,979 bps.

**CONCLUSION**:
There is **no intermediate trade size** where gross spread remains positive while simultaneously overcoming fixed L2/L1 gas costs. The historical candidates were mathematical artifacts of zero-volume tick proximity, not tradeable economic arbitrage.
