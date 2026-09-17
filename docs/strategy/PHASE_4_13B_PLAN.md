# PHASE 4.13B — Research & Feasibility Plan: CEX–DEX Arbitrage

> **PHASE STATUS**: RESEARCH & FEASIBILITY ONLY  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION STATE**: STRICTLY LOCKED (PHASE 5 BLOCKED)  
> **CREDENTIALS**: ZERO API KEYS, ZERO WALLETS, ZERO SIGNERS, ZERO TRADING PERMISSIONS  

---

## 1. Executive Summary

Phase 4.13B investigates whether incorporating centralized-exchange (CEX) public market data creates an observable and potentially executable arbitrage opportunity universe that differs materially from the pure on-chain DEX–DEX settled-state universe investigated in Phases 4.7 through 4.13A.1.

Across 1,493 full route evaluations in Phase 4.9, 624 evaluations in Phase 4.11, and 2,400 multi-size evaluations in Phase 4.12, settled public DEX states on Base, Arbitrum One, Optimism, and Polygon PoS demonstrated zero authentic net-positive arbitrage opportunities within pool fee hurdles (30–60 bps). Phase 4.13B expands the observation perimeter to off-chain Central Limit Order Books (CLOBs) on Binance, Coinbase, and Kraken.

---

## 2. Core Operational Constraints

1. **Research & Feasibility Only**: No live execution, no automated order submission, no capital allocation.
2. **Public Unauthenticated Market Data**: Only public REST/WebSocket order book snapshots and trade streams are queried. No exchange accounts, API keys, or trading secrets are used.
3. **Multi-Domain Clock Segregation**: Reusing the Phase 4.13A.1 findings, `EXCHANGE_TIME`, `PROTOCOL_TIME`, `LOCAL_WALL_TIME`, and `LOCAL_MONOTONIC_TIME` remain strictly isolated without cross-domain subtraction.
4. **Order-Book VWAP Traversal**: Prices are evaluated using full depth order-book walks across simulated notionals ($10 to $5,000); ticker prices alone are never used for execution feasibility.
5. **Inventory & Latency Modeling**: Models Model A (sequential transfer post-signal) and Model B (pre-positioned dual inventory) to quantify non-atomicity and capital drag.

---

## 3. Work Breakdown Structure

- **Module Development**:
  - `scanner/src/cex/`: CEX market data normalizer, symbol mapper, order book, VWAP calculator.
  - `scanner/src/crossvenue/`: Economics engine, inventory model, transfer cost model, opportunity persistence, candidate validator.
  - `scanner/src/timing/`: Cross-venue multi-clock domain model.
- **Empirical Campaign**:
  - Controlled live observation of Coinbase (`ETH-USD`), Binance (`ETHUSDC`), Kraken (`ETHUSDC`) against Base Uniswap V3 (`WETH/USDC` 0.05%).
  - Multi-notional evaluation ($10, $25, $50, $100, $250, $500, $1,000, $5,000) across `DEX_TO_CEX` and `CEX_TO_DEX`.
- **Forensics & Validation**:
  - Independent recalculation gate to catch inverted tokens, unit bugs, and decimal errors.
  - False-positive defense and evidence classification.
- **Reporting & Memory Integration**:
  - Authoring 11 strategy dossiers and updating canonical Project Brain records.
