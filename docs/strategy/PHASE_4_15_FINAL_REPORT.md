# PHASE 4.15 FINAL REPORT — CEX–DEX Transport Feasibility & Latency Floor Benchmark

> **STATUS**: PRELIMINARY TRANSPORT PROBE COMPLETE  
> **CAPITAL AT RISK**: STRICTLY ₹0.00 / $0.00 | **EXECUTION**: STRICTLY LOCKED  
> **CREDENTIALS**: ZERO API KEYS, ZERO WALLETS, ZERO SIGNERS, ZERO TRADING PERMISSIONS  
> **AUTHORIZATION**: Phase 4.15 Research Only. Phase 5 remains LOCKED.

---

## 1. Executive Summary & Core Finding

Phase 4.15 investigated whether SAHIKARA can obtain sufficiently low and measurable transport latency between centralized exchange (CEX) WebSocket order-book updates and decentralized exchange (DEX) on-chain QuoterV2 state to support genuinely contemporaneous cross-venue arbitrage evaluation.

Across the six measured QuoterV2 requests, observed round-trip latency ranged from 456 ms to 642 ms from the tested client environment.

Sub-100ms QuoterV2 round-trip latency was not achieved using the tested unauthenticated public RPC endpoints from the tested client environment. This experiment does not establish that sub-100ms latency is technically impossible with other providers, geographic locations, dedicated infrastructure, private nodes, or alternative architectures.

---

## 2. Experimental Setup & Diagnostics

### Diagnosis of Initial Probe Behavior
During initial probe development, testing indicated that viem WebSocket clients maintain persistent socket handles on the Node.js event loop, preventing process termination after benchmark completion unless explicitly closed. Furthermore, unhandled socket timeouts could stall execution. To establish deterministic execution:
1. Every network call is bounded by an explicit `5,000 ms` timeout with `AbortController`.
2. WebSocket sockets are explicitly closed in a `finally` block upon completion.
3. Every call is classified into a failure taxonomy: `SUCCESS`, `TIMEOUT`, `RATE_LIMITED`, `CONNECTION_ERROR`, or `RPC_ERROR`.

---

## 3. Empirical Results (Exact Measured Observations)

A controlled benchmark evaluated a $1.0\text{ WETH} \rightarrow \text{USDC}$ swap (500 fee tier) on Base Uniswap v3 QuoterV2 (`0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`):

| # | Transport | Endpoint | Monotonic Latency (ms) | Status | Error Category | Block Number | Block Hash | Output (USDC) |
|---|---|---|---|---|---|---|---|---|
| **1** | **HTTP** | `https://mainnet.base.org` | **575.55 ms** | Pass | `SUCCESS` | `51438291` | `0xa205925de56c...` | `2471.189101` |
| **2** | **HTTP** | `https://mainnet.base.org` | **459.36 ms** | Pass | `SUCCESS` | `51438292` | `0x60a293ade2d6...` | `2471.050181` |
| **3** | **HTTP** | `https://mainnet.base.org` | **456.08 ms** | Pass | `SUCCESS` | `51438292` | `0x60a293ade2d6...` | `2471.050181` |
| **4** | **WebSocket** | `wss://base-rpc.publicnode.com` | **571.16 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |
| **5** | **WebSocket** | `wss://base-rpc.publicnode.com` | **605.62 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |
| **6** | **WebSocket** | `wss://base-rpc.publicnode.com` | **641.67 ms** | Pass | `SUCCESS` | `51438293` | `0x90e14fa862a7...` | `2471.051832` |

### Key Observations:
- **HTTP**: Ranged from **456.08 ms** to **575.55 ms**. Warm keep-alive connection reuse achieved ~456–459 ms.
- **WebSocket**: Ranged from **571.16 ms** to **641.67 ms**.
- **Comparative Transport**: In this six-request probe, WebSocket QuoterV2 calls were slower than the two warm HTTP observations. This is a preliminary observation, not a provider-wide transport conclusion.
- **Measured Metric**: The measured values reflect combined RPC transport and on-chain state simulation/QuoterV2 call latency, rather than block confirmation.

---

## 4. Methodological Alignment & Synchronization Status

1. **No Cache Fallback**: All 6 observations were authentic `FRESH_ONCHAIN_QUOTE` executions. Zero cached or simulated quotes were included.
2. **Clock Domain Discipline**: Latency was measured exclusively using high-resolution monotonic timestamps (`performance.now()`). Wall-clock time was recorded strictly for ISO provenance.
3. **Synchronization Feasibility Classification**:
   - The tested public RPC configuration is classified as **Category C: TRANSPORT-LIMITED**.
   - With round-trip times between 456 ms and 642 ms, public RPC calls cannot establish sub-100ms contemporaneous cross-venue state.
4. **Economic Decision**:
   - Because the transport latency exceeds the threshold required for contemporaneous cross-venue comparison, **SAHIKARA will NOT initiate another broad market campaign** on public unauthenticated RPC endpoints.
   - Any market campaign conducted over these endpoints would produce asynchronous comparisons rather than executable arbitrage measurements.

---

## 5. Security & Invariant Audit

- **Capital at Risk**: Strictly **₹0.00 / $0.00**
- **Wallets / Signers**: ZERO
- **Private Keys**: ZERO
- **Trading API Keys**: ZERO
- **Live Orders / Broadcasts**: ZERO
- **Phase 5 Status**: Strictly **BLOCKED**

---

## 6. Next Steps & Recommendations

1. **Await Operator Review**: Keep Phase 4.15 at `PRELIMINARY TRANSPORT PROBE COMPLETE`.
2. **Infrastructure Feasibility**: If sub-100ms contemporaneous cross-venue research is required in future phases, it will necessitate operator-provisioned dedicated infrastructure (e.g. co-located node, private RPC provider, or local read replica).
3. **Phase 5 Remains Locked**: No live execution or wallet creation may proceed.
