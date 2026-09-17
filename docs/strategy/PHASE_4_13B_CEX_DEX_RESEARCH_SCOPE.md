# PHASE 4.13B — CEX-DEX BASIS RESEARCH SCOPE & BOUNDARY SPECIFICATION

> **STATUS**: RESEARCH SCOPE SPECIFICATION ONLY  
> **EXECUTION STATUS**: STRICTLY FORBIDDEN / ZERO ACCOUNTS / ZERO KEYS  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **PHASE 5 GATE**: STRICTLY BLOCKED  

---

## 1. Context & Purpose

In Phases 4.7 through 4.13A, extensive empirical campaigns across Base, Arbitrum One, Optimism, and Polygon PoS confirmed that pure on-chain spatial DEX arbitrage produces zero net-positive returns on settled state due to AMM fee friction (10–60 bps) and L2 gas drag.

However, centralized exchanges (e.g. Binance, OKX, Coinbase, Bybit) operate off-chain central limit order books (CLOBs) with sub-millisecond matching and substantially lower fee schedules (typically 1–5 bps for VIP/market makers). This creates theoretical price discrepancies between CEX spot prices and on-chain AMM pools.

**Phase 4.13B is chartered strictly to define the research questions and operational parameters for evaluating CEX-DEX basis opportunities without connecting accounts, placing orders, or allocating capital.**

---

## 2. Core Research Questions for Future Study

1. **Gross Basis Magnitude**: Does the price difference between CEX mid-market spot and DEX executable quotes exceed the combined round-trip friction?
2. **Fee Structure & Hurdles**:
   - CEX Taker Fees ($2–10\text{ bps}$) vs Maker Rebates ($-1\text{ to }+2\text{ bps}$).
   - DEX Pool Swap Fees ($5–30\text{ bps}$).
   - L1/L2 Gas Costs ($\$0.005–\$0.02$ on L2, $\$0.50–\$5.00$ on Ethereum).
   - Minimum Gross Spread required for net profitability: $\approx 15–40\text{ bps}$.
3. **Latency Differentials**:
   - CEX WebSocket market data latency: $\approx 5–25\text{ ms}$.
   - On-chain DEX quote latency: $\approx 100–250\text{ ms}$.
   - Can an off-chain observer reliably predict DEX pool adjustments before on-chain searchers arbitrage them?
4. **Basis Persistence**: How many milliseconds or blocks does a CEX-DEX basis discrepancy persist before being closed?
5. **Inventory & Rebalancing Friction**:
   - Inventory Requirements: Capital must be split between CEX spot balances and on-chain DEX wallets.
   - Withdrawal Fees: Fixed network withdrawal fees charged by centralized exchanges.
   - Deposit Confirmation Delays: Centralized venues require 10 to 64 block confirmations before crediting deposits, introducing severe directional delta exposure.
   - Counterparty & Custodial Risk: Capital held on centralized exchanges is exposed to exchange insolvency, freeze, or withdrawal halts.
6. **API Limits & Exchange Throttling**:
   - Rate limits on CEX REST and WebSocket order entry gateways.
   - Co-location requirements (AWS Tokyo / Dublin / Virginia) for competitive execution.

---

## 3. Strict Prohibitions for Phase 4.13B

- **NO Exchange Account Integration**: Do NOT connect Binance, Coinbase, OKX, or any exchange account.
- **NO API Keys or Secrets**: Do NOT request, handle, store, or commit CEX API keys, secret keys, or passphrases.
- **NO Order Dispatch**: Zero orders may be placed.
- **NO Capital Allocation**: Capital at risk remains ₹0.00 / $0.00.
- **NO Phase 5 Activation**: Phase 5 remains strictly BLOCKED.
