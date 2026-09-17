# PHASE 4.13B — Centralized Exchange Microstructure & Architecture Research

> **SCOPE**: Conceptual and empirical analysis of Central Limit Order Books (CLOBs) versus Automated Market Makers (AMMs).

---

## 1. CLOB vs. AMM Structural Divide

The cryptocurrency market is fundamentally bifurcated into two distinct market microstructure regimes:

| Feature | Centralized Exchanges (CEX) | Decentralized Exchanges (DEX) |
| :--- | :--- | :--- |
| **Market Engine** | Off-Chain Central Limit Order Book (CLOB) | On-Chain Smart Contract AMM (CPMM, Concentrated Liquidity) |
| **Matching Latency** | Sub-millisecond ($< 500\text{ \mu s}$) in centralized memory | Discrete block intervals ($0.25\text{ s}$ Arb, $2.0\text{ s}$ Base/OP) |
| **Execution State** | Continuous, deterministic priority (price-time) | Discrete, batch-sequenced with MEV bundle reordering |
| **Fee Structure** | Tiered volume taker (5–10 bps), maker rebates (-1 to +2 bps) | Fixed pool fee (5, 30, 100 bps) deducted per swap |
| **Price Discovery** | Dominant global liquidity & high-frequency price discovery | Reactive liquidity, passive price taker relying on arbitrageurs |
| **Settlement** | Instantaneous internal ledger update | On-chain state transition requiring consensus confirmation |

---

## 2. Theoretical Formation of CEX–DEX Spreads

Because CEX platforms process institutional order flow continuously with microsecond latency, macroeconomic news and external spot price movements reflect on CEX order books before decentralized AMM pools adjust.

An AMM pool price only updates when a market participant submits an on-chain transaction. Consequently:
1. **DEX Stale Price Vulnerability**: If CEX spot prices increase rapidly from \$2,460 to \$2,470, an on-chain AMM pool quoting \$2,460 offers an apparent discount.
2. **Arbitrage Incentive**: An arbitrageur can buy on the DEX at \$2,460 and sell on the CEX at \$2,470, capturing a theoretical gross spread of $\approx +40.6\text{ bps}$.
3. **Execution Reality**:
   - The trade on DEX incurs a 5 bps pool fee and L2 gas.
   - The trade on CEX incurs a 5–10 bps taker fee.
   - Most importantly, the trade is **NOT ATOMIC**: if the DEX trade succeeds but the CEX price drops before the sell order fills, or if the DEX transaction is front-run / reverted, the searcher suffers unhedged inventory loss.

---

## 3. The Role of Professional Market Makers (PMMs)

On modern EVM chains (especially Base and Arbitrum One), sophisticated PMMs and searchers run private RPC connections and low-latency builder co-locations. They continuously quote or backrun AMM pools, keeping the price difference between CEX and top-tier DEX pools compressed within the round-trip fee hurdle (typically $\pm 10\text{ to }20\text{ bps}$).
