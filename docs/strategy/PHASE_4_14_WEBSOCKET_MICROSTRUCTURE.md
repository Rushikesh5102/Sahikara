# PHASE 4.14 — WebSocket Microstructure & Feed Dynamics

> **PHASE STATUS**: RESEARCH-ONLY  
> **CAPITAL**: ₹0.00 | **EXECUTION**: LOCKED | **AUTHENTICATION**: NONE

---

## 1. Overview & Public Streaming Architecture

Phase 4.14 transitions from the REST-polling methodology of Phase 4.13B to continuous, event-driven public WebSocket feeds. This transition is essential to investigate whether millisecond-level order-book dynamics reveal transient CEX–DEX price dislocations that dissipate before periodic REST polling intervals can observe them.

Three primary centralized exchanges were monitored using strictly public, unauthenticated WebSocket streams:

| Exchange | Symbol | WebSocket URL | Channel / Stream | Update Frequency |
|---|---|---|---|---|
| **Binance** | `ETHUSDC` | `wss://stream.binance.com:9443/ws` | `ethusdc@depth20@100ms` | 100 ms fixed window |
| **Coinbase** | `ETH-USD` | `wss://ws-feed.exchange.coinbase.com` | `level2_batch`, `ticker` | Batch / event-driven |
| **Kraken** | `ETH/USDC` | `wss://ws.kraken.com/v2` | `book` (depth 25) | Event-driven book updates |

---

## 2. Ingestion Performance & Feed Metrics

Across the active observation campaign, a total of **1,688 WebSocket messages** and **1,474 order-book updates** were received and processed with deterministic sequence tracking:

| Venue | Subscribed Symbol | Total Messages Received | Order-Book Updates | Sequence Gaps Detected | Invalidations Triggered | Reconnections |
|---|---|---|---|---|---|---|
| **Binance** | `ETHUSDC` | 118 | 118 | 0 | 0 | 0 |
| **Coinbase** | `ETH-USD` | 234 | 34 | 0 | 0 | 0 |
| **Kraken** | `ETH/USDC` | 1,336 | 1,322 | 0 | 0 | 0 |
| **Total** | — | **1,688** | **1,474** | **0** | **0** | **0** |

### Key Ingestion Observations:
1. **Kraken High Frequency**: Kraken produced the highest event density, delivering 1,322 book updates across the observation window (~10-20 updates/second during active trading).
2. **Binance Paced Depth**: Binance streamed periodic 100ms L2 snapshots (`depth20`), ensuring consistent microsecond freshness without socket saturation.
3. **Coinbase Event Batching**: Coinbase delivered heartbeat tickers and periodic L2 batch updates with sequence continuity.
4. **Deterministic Integrity**: Zero sequence gaps were detected (`sequenceGaps = 0`) across all three connections; no books were corrupted or placed into `BOOK_INVALIDATED` state.

---

## 3. Microstructure Metrics & Mathematical Formulations

To quantify order-book microstructure, the following metrics were continuously computed on every received update:

### 3.1 Bid-Ask Spread
The absolute spread and relative spread in basis points (bps):
$$\text{Spread}_{\text{abs}} = P_{\text{ask}} - P_{\text{bid}}$$
$$\text{Spread}_{\text{bps}} = \left( \frac{P_{\text{ask}} - P_{\text{bid}}}{P_{\text{mid}}} \right) \times 10{,}000$$
Where $P_{\text{mid}} = \frac{P_{\text{bid}} + P_{\text{ask}}}{2}$.

### 3.2 Depth Imbalance Metric
The order-book depth imbalance quantifies the relative distribution of queued liquidity at the top $K$ levels:
$$\text{Imbalance} = \frac{\sum_{i=1}^K Q_{\text{bid}, i} - \sum_{i=1}^K Q_{\text{ask}, i}}{\sum_{i=1}^K Q_{\text{bid}, i} + \sum_{i=1}^K Q_{\text{ask}, i}} \in [-1.0, +1.0]$$
- $\text{Imbalance} = +1.0$: Pure bid pressure (zero asks within window).
- $\text{Imbalance} = 0.0$: Symmetrical depth.
- $\text{Imbalance} = -1.0$: Pure ask pressure (zero bids within window).

### 3.3 Book Slope
Measures the rate of price change per unit of liquidity available:
$$\text{Slope}_{\text{bid}} = \frac{P_{\text{bid, top}} - P_{\text{bid, deep}}}{\sum Q_{\text{bid}}}, \quad \text{Slope}_{\text{ask}} = \frac{P_{\text{ask, deep}} - P_{\text{ask, top}}}{\sum Q_{\text{ask}}}$$

---

## 4. Empirical Microstructure Distributions

Across all recorded order-book states in Phase 4.14, the empirical microstructure distributions were observed as follows:

| Metric | Min | P25 | Median | P75 | P90 | P95 | P99 | Max | Mean |
|---|---|---|---|---|---|---|---|---|---|
| **Spread (bps)** | 0.0405 | 0.0405 | 1.2544 | 1.9013 | 4.4929 | 4.4929 | 4.4929 | 6.6761 | 1.7535 |
| **Depth Imbalance** | -0.3939 | -0.1564 | -0.0001 | 0.0000 | +0.1603 | +0.1603 | +0.1603 | +0.9774 | +0.0176 |

### Findings:
- **Tight Central Spreads**: Median top-of-book spread was **1.25 bps** across all venues, reaching a minimum of **0.04 bps** on high-liquidity Binance updates.
- **Symmetric Balanced Depth**: Median depth imbalance was **-0.0001**, indicating balanced two-sided liquidity under normal market regimes, with occasional spikes up to $+0.9774$ during localized bursts.
