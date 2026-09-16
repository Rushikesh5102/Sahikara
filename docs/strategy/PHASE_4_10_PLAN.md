# SAHIKARA Phase 4.10 Research & Implementation Plan
## DEX Ecosystem & Market-Universe Expansion

## 1. Executive Mandate
In Phase 4.9, SAHIKARA demonstrated that within a restricted universe of ~152 verified pools (concentrated on Uniswap v3 and Aerodrome), zero economically viable arbitrage opportunities could be validated under realistic gas, fee friction, and latency constraints.

However, Phase 4.9 explicitly recognized a critical structural limitation:
> *"Profitability has not yet been demonstrated within the monitored universe, while profitability outside the monitored universe remains insufficiently characterized."*

The mandate of **Phase 4.10** is to expand same-chain DEX ecosystem coverage across four major EVM chains (Base, Arbitrum One, Optimism, and Polygon PoS) by integrating the primary decentralized liquidity protocols:
1. **Curve Finance** (Stableswap bonding curve)
2. **Balancer V2** (Weighted multi-token vault)
3. **Camelot V2** (Arbitrum native dynamic-fee AMM)
4. **Velodrome V2** (Optimism native volatile & stable AMM)
5. **QuickSwap V2** (Polygon native constant product AMM)
6. **SushiSwap V2** (Universal constant product AMM)

## 2. Strategic Objectives
- **Verify Real Deployments**: On-chain verification of all factory, router, quoter, and pool contract bytecodes prior to routing graph admission.
- **Enforce Token Identity Disambiguation**: Canonical identity based strictly on `chainId + address.toLowerCase()`. Differentiate native canonical, bridged, and legacy variants.
- **Implement Pool Quality Tiers**: Classify pools into `TIER_0`, `TIER_1`, `TIER_2`, and `REJECTED`. Never silently discard rejected pools; record explicit rejection reasons.
- **Generate Multi-Hop Route Graphs**: Construct 2-hop cross-DEX and 3-hop triangular cycles while preventing combinatorial explosion via strict chain isolation and duplicate pruning.
- **Multi-Size Sensitivity Testing**: Evaluate routes across $1, $5, $10, $25, $50, $100, $250, and $500 trade sizes.
- **9-Stage Positive Signal Validation**: Rigorously validate any gross spread signal through independent re-quotes, gas and slippage accounting, and repeat persistence testing.

## 3. Strict Safety Invariants
- Research only. Capital at risk: **₹0.00 / $0.00**.
- Zero private keys, zero signers, zero wallet credentials.
- Execution engine remains strictly **LOCKED**.
- **Phase 5 remains strictly BLOCKED**.
