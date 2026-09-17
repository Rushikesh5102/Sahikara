# PHASE 4.15 — CEX–DEX Transport Feasibility & Latency Research

> **STATUS**: PRELIMINARY TRANSPORT PROBE COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 | **EXECUTION**: STRICTLY LOCKED  
> **CREDENTIALS**: ZERO API KEYS, ZERO WALLETS, ZERO SIGNERS, ZERO TRADING PERMISSIONS  
> **OBJECTIVE**: Determine experimentally whether SAHIKARA can obtain sufficiently low and measurable transport latency between CEX market data and on-chain DEX state to support contemporaneous cross-venue evaluation.

---

## 1. Executive Summary

Phase 4.15 investigates transport latency between centralized exchange (CEX) WebSocket order-book streams and decentralized exchange (DEX) on-chain QuoterV2 states. Following Phase 4.14.1, which established that all 144 cross-venue evaluations were `ASYNCHRONOUS_COMPARISON` with DEX quote ages between 519 ms and 1,535 ms, Phase 4.15 measures whether public transport classes (HTTP, HTTP keep-alive, WebSocket) can achieve sub-100ms round-trip latency.

Across the six measured QuoterV2 requests, observed round-trip latency ranged from 456 ms to 642 ms from the tested client environment. Sub-100ms QuoterV2 round-trip latency was not achieved using the tested unauthenticated public RPC endpoints from the tested client environment. This experiment does not establish that sub-100ms latency is technically impossible with other providers, geographic locations, dedicated infrastructure, private nodes, or alternative architectures.

---

## 2. Tested Transport Classes

| Transport Class | Endpoint Tested | Protocol | Timeout Guard | Connection Lifecycle | Status |
|---|---|---|---|---|---|
| **Public HTTP** | `https://mainnet.base.org` | JSON-RPC over HTTPS (HTTP/1.1) | 5,000 ms (AbortController) | Ephemeral / Keep-Alive | Tested (3 requests) |
| **Public WebSocket** | `wss://base-rpc.publicnode.com` | JSON-RPC over WSS | 5,000 ms per-request | Explicit socket teardown in `finally` | Tested (3 requests) |
| **Alternative HTTP** | `https://base.llamarpc.com` | HTTPS | N/A | Returned Cloudflare HTML error | Excluded (invalid JSON) |
| **Alternative HTTP** | `https://base-rpc.publicnode.com` | HTTPS | N/A | Valid JSON-RPC | Tested in probe |
| **Alternative WS** | `wss://mainnet.base.org` | WSS | N/A | Connection refused / unsupported | Excluded (no public WS) |
| **Private / Dedicated** | None configured | N/A | N/A | Requires commercial subscription | Unconfigured (Zero Cost Rule) |

---

## 3. Empirical Probe Results

The preliminary probe evaluated a $1.0\text{ WETH} \rightarrow \text{USDC}$ swap (500 fee tier) on Base Uniswap v3 QuoterV2 (`0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`):

| # | Transport | Start Wall-Clock (UTC) | End Wall-Clock (UTC) | Monotonic Latency (ms) | Status | Error Category | Block Number | Block Hash | Amount Out (USDC) |
|---|---|---|---|---|---|---|---|---|---|
| **1** | **HTTP** | `2026-09-17T17:25:30.369Z` | `2026-09-17T17:25:30.945Z` | **575.55 ms** | Pass | `SUCCESS` | `51438291` | `0xa205925de56c...` | `2471.189101` |
| **2** | **HTTP** | `2026-09-17T17:25:31.056Z` | `2026-09-17T17:25:31.515Z` | **459.36 ms** | Pass | `SUCCESS` | `51438292` | `0x60a293ade2d6...` | `2471.050181` |
| **3** | **HTTP** | `2026-09-17T17:25:31.618Z` | `2026-09-17T17:25:32.074Z` | **456.08 ms** | Pass | `SUCCESS` | `51438292` | `0x60a293ade2d6...` | `2471.050181` |
| **4** | **WEBSOCKET** | `2026-09-17T17:25:33.033Z` | `2026-09-17T17:25:33.604Z` | **571.16 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |
| **5** | **WEBSOCKET** | `2026-09-17T17:25:33.717Z` | `2026-09-17T17:25:34.323Z` | **605.62 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |
| **6** | **WEBSOCKET** | `2026-09-17T17:25:34.436Z` | `2026-09-17T17:25:35.078Z` | **641.67 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |

---

## 4. Analysis of Transport Dynamics

1. **HTTP Keep-Alive Warm-Up**:
   - Request #1 required 575.55 ms, incorporating initial connection establishment, TCP three-way handshake, and TLS negotiation.
   - Requests #2 and #3 with persistent connection reuse stabilized at 459.36 ms and 456.08 ms.
2. **WebSocket Round-Trip Characteristics**:
   - Over an established, open WebSocket connection (`wss://base-rpc.publicnode.com`), complex QuoterV2 state evaluation took 571.16 ms, 605.62 ms, and 641.67 ms.
   - In this six-request probe, WebSocket QuoterV2 calls were slower than the two warm HTTP observations. This is a preliminary observation, not a provider-wide transport conclusion.
3. **Latency Composition**:
   - The measured duration represents the combined RPC transport and on-chain state simulation/QuoterV2 call latency.
   - Because public RPC endpoints reside in US/European cloud data centers, geographical round-trip transit creates a multi-hundred-millisecond transit time from remote client environments.

---

## 5. Feasibility Classification

Based on the preliminary probe:
- Category: **C. TRANSPORT-LIMITED**
- Definition: The transport delay between market event observation and on-chain quote retrieval exceeds the duration required to establish contemporaneous execution (sub-100ms).
- Consequence: Cross-venue comparisons conducted over public remote RPC endpoints reflect asynchronous market states rather than executable arbitrage opportunities.
