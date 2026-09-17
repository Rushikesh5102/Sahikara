# PHASE 4.13B — Public CEX Market Data Sources & Venue Evaluation

> **POLICY**: Unauthenticated, read-only public market data endpoints only. Zero API credentials, zero trading permissions, zero account creation.

---

## 1. Venue Suitability Assessment

| Exchange | Endpoint Evaluated | Public Access Status | Observed RTT | Suitability Status | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Coinbase Exchange** | `https://api.exchange.coinbase.com/products/ETH-USD/book?level=2` | Full unauthenticated public access | $376.6\text{ ms}$ | **SUITABLE FOR THIS EXPERIMENT** | Stable L2 order book with thousands of bid/ask levels, sequence numbering, and server epoch timestamps. |
| **Binance** | `https://api.binance.com/api/v3/depth?symbol=ETHUSDC&limit=20` | Full unauthenticated public access | $219.0\text{ ms}$ | **SUITABLE FOR THIS EXPERIMENT** | Ultra-deep liquidity, explicit server timestamp via `/api/v3/time`, and robust rate-limit headers. |
| **Kraken** | `https://api.kraken.com/0/public/Depth?pair=ETHUSDC&count=20` | Full unauthenticated public access | $401.3\text{ ms}$ | **SUITABLE FOR THIS EXPERIMENT** | Authoritative spot quotes, high uptime, explicit public server time, zero authentication requirements. |
| **OKX** | `https://www.okx.com/api/v5/market/books` | Network connection failed | N/A | **NOT SUITABLE FOR THIS EXPERIMENT** | Network transport failure (TLS/DNS restriction or regional block on unauthenticated public endpoint). |
| **Bybit** | `https://api.bybit.com/v5/market/orderbook` | Public spot endpoint available | N/A | **DEFERRED** | Preserved as candidate for future expansion; initial baseline constrained to premier 3 venues. |

---

## 2. Public Rate Limiting & Safety Controls

To maintain non-disruptive, respectful public network access:
1. **Pacing & Request Throttling**: Observations are paced with minimum 1.0-second inter-round sleeps.
2. **Exponential Backoff**: Any HTTP 429 response triggers an automatic backoff multiplier ($1\text{ s} \to 2\text{ s} \to 4\text{ s}$).
3. **Hard Timeout Protection**: Every public request is protected by an `AbortController` with a strict 8,000 ms timeout.
4. **Header Compliance**: Public queries declare explicit user-agent identification (`SAHIKARA/0.1.0`) and standard JSON headers.
