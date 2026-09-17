# PHASE 4.14 — Research Plan: High-Resolution CEX–DEX Microstructure, Volatility-Regime & Fee-Sensitivity Research

> **PHASE STATUS**: RESEARCH-ONLY PHASE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION STATE**: STRICTLY LOCKED (PHASE 5 BLOCKED)  
> **CREDENTIALS**: ZERO API KEYS, ZERO WALLETS, ZERO SIGNERS, ZERO TRADING PERMISSIONS  
> **PRESERVED COMMITS**: `8b50852`, `a435726`, `1f4701a`, `1c8e185`, `a7aced1`, `5adfb1d`

---

## 1. Mission & Research Objectives

Phase 4.14 expands upon the foundational CEX–DEX cross-venue framework established in Phase 4.13B and audited in Phase 4.13B.1. The core objective is to determine:
> *"Does high-resolution market microstructure reveal CEX–DEX gross price dislocations materially larger than the +0.35 bps maximum observed in the bounded Phase 4.13B REST experiment?"*

### Secondary Research Questions:
1. **WebSocket Granularity**: Do sub-second, continuous WebSocket feeds reveal transient price discrepancies missed by periodic REST polling?
2. **Volatility Regimes**: Do price discrepancies expand during periods of elevated volatility or rapid order-book motion?
3. **Microstructure Dynamics**: How do top-of-book spread, depth imbalance, and book slope correlate with cross-venue pricing?
4. **Dissipation & Persistence**: What is the lifetime of any observed gross-positive candidate?
5. **Fee & Friction Sensitivity**: Can any observed gross spread survive progressive fee tiers (10 bps down to 0 bps), gas friction, and risk buffers?
6. **CEX vs DEX Lead/Lag**: Does rapid CEX order-book movement coincide with or anticipate DEX pool updates?
7. **Forensic Integrity**: Are observed price differences genuine executable signals or artifacts of stale data, clock differences, or sequence gaps?

---

## 2. Absolute Safety Gate

1. **Phase 5 Remains Locked**: No capital, no live routing, no automated execution.
2. **Zero Credentials**: Unauthenticated public WebSocket streams (`wss://stream.binance.com:9443`, `wss://ws-feed.exchange.coinbase.com`, `wss://ws.kraken.com/v2`) and public Base RPC (`https://mainnet.base.org`).
3. **No Financial Infrastructure**: Zero exchange trading accounts, zero wallet signers, zero smart contract deployments, ₹0.00 capital.

---

## 3. Architecture & Methodology

### 3.1 Data Ingestion Architecture
- **Centralized Exchanges (CEX)**:
  - **Binance**: Public WebSocket order-book depth stream (`ethusdc@depth20@100ms`).
  - **Coinbase**: Public WebSocket L2 batch and ticker stream (`ETH-USD`).
  - **Kraken**: Public WebSocket v2 book stream (`ETH/USDC`, depth 25).
- **Decentralized Exchange (DEX)**:
  - Base Uniswap V3 Quoter (`0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`) for `WETH/USDC` (0.05% pool fee tier).

### 3.2 Deterministic Order-Book Maintenance
- In-memory order books are maintained via `CexWebSocketFeed`.
- Sequence numbers and update IDs are tracked on every update.
- Any detected sequence gap immediately triggers `BOOK_INVALIDATED` and forces an in-memory reset/resynchronization before any cross-venue evaluation can occur.

### 3.3 Multi-Domain Timing Architecture
Clock domains remain rigorously segregated:
- `T1` (`EXCHANGE_TIME`): CEX message timestamp provided by exchange server.
- `T2` (`LOCAL_MONOTONIC_TIME`): Ingestion arrival time captured via `performance.now()`.
- `T3` (`PROTOCOL_TIME`): Block timestamp returned by DEX RPC.
- `T4` (`LOCAL_MONOTONIC_TIME`): Local DEX response reception monotonic time.
- `T5-T7`: Economic evaluation and forensic validation timing.
- Cross-domain subtractions (e.g. `T2 - T1`) are strictly forbidden from being labeled "network latency" unless clock synchronization has been mathematically established.

### 3.4 Economic Modeling & Sensitivity
- Executable order-book VWAP calculated across standard sizes: $10, $25, $50, $100, $250, $500, $1,000, and $5,000.
- Directions evaluated: `DEX_TO_CEX` (Buy on DEX, Sell on CEX) and `CEX_TO_DEX` (Buy on CEX, Sell on DEX).
- Friction hurdles:
  - CEX fee: 10 bps, 5 bps, 2 bps, 1 bps, 0.5 bps, 0 bps (all modeled as `[SIMULATION]`).
  - DEX pool fee: 5.0 bps (Uniswap V3 500 fee tier).
  - Gas friction: Base L2 modeled execution cost (0.1×, 0.5×, 1.0×, 2.0× sensitivity).
  - Risk buffer: 0 bps, 2 bps, 5 bps, 10 bps.

---

## 4. Work Breakdown Structure

1. **`CexWebSocketFeed.ts`**: High-performance WebSocket feeds with deterministic sequence validation, gap detection, and invalidation state handling.
2. **`MicrostructureMetrics.ts`**: Calculations for bid-ask spread ($ and bps), bid/ask depth, depth imbalance, book slope, and update frequencies.
3. **`VolatilityRegimeClassifier.ts`**: Rolling micro-window realized volatility and price-change rate classifier (`LOW`, `NORMAL`, `ELEVATED`, `HIGH`).
4. **`HighResolutionPersistence.ts`**: Sub-second and update-level opportunity lifecycle tracking.
5. **`phase414Microstructure.test.ts`**: Unit test suite verifying mathematical integrity, gap detection, and state machine transitions.
6. **`run-phase4-14-research.ts`**: Multi-round empirical research runner orchestrating live WebSocket feeds and DEX quoter evaluations.
7. **Forensics, Documentation & Memory Synchronization**: Creation of 11 strategy dossiers and updating `PROJECT_STATE.md`, `DECISIONS.md`, `EXPERIMENTS.md`, `LESSONS_LEARNED.md`, and `CHANGELOG.md`.
