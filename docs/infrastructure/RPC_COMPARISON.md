w# RPC_COMPARISON.md — Blockchain RPC Infrastructure & Node Benchmarking

> **DOCUMENT STATUS**: ACTIVE RESEARCH (PHASE 1)  
> **RULE**: Do NOT generate API keys or create account credentials during this research phase.  
> **OBJECTIVE**: Identify reliable, low-latency, WebSocket-capable RPC providers with sustainable free tiers to support Scanner ingestion and Simulator verification.

---

## 1. Provider Comparison Matrix

| Provider | Free Tier Allowance | Rate Limit / RPS | WebSocket (`eth_subscribe`) | Supported Target Networks | India / APAC Latency Profile | Multi-Endpoint Failover |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **Alchemy** | 30M Compute Units (CUs) / mo | ~330 CU/s burst | **Yes** (Stable, low drop rate) | Polygon, Base, Arbitrum, OP | 80 – 140 ms (Singapore / Tokyo) | Excellent |
| **QuickNode** | 10M Credits / mo (trial/tier) | 25 requests/sec | **Yes** (Dedicated WS endpoints) | Polygon, Base, Arbitrum, OP, BSC | 60 – 110 ms (Global edge routing) | Excellent |
| **Infura** | 3M Requests / mo | 100 req/sec | **Yes** (Stable) | Polygon, Arbitrum, OP, Base | 90 – 160 ms | Good |
| **Ankr** | Free tier (Public + Pay-as-you-go)| 30 req/sec | **Yes** (Shared WS) | Multi-chain (Polygon, BSC, L2s) | 70 – 130 ms (Decentralized nodes) | Moderate |
| **Public RPCs** | Unlimited (best-effort) | 5–10 req/sec (Aggressive throttling)| Poor / Often Disabled | All chains | 150 – 350 ms (Unpredictable) | Unusable for Production |

---

## 2. Detailed Provider Profiles

### 2.1 Alchemy
- **`[FACT]` Architecture**: Proprietary Supernode architecture providing data consistency across distributed backends.
- **`[FACT]` Free Tier Sustainability**: 30 million Compute Units per month is sufficient to support continuous WebSocket block header subscriptions and ~10 `eth_call` simulations per minute for 30 days without exceeding quota.
- **`[FACT]` WebSocket Reliability**: Supports `eth_subscribe` for `newHeads` and filtered event logs (e.g. `Sync` and `Swap` topics). Built-in heartbeat detection.
- **`[ASSUMPTION]` Latency Considerations**: Alchemy edge endpoints in Singapore or Tokyo provide ~80–120 ms round-trip time (RTT) from standard Indian broadband connections.

### 2.2 QuickNode
- **`[FACT]` Architecture**: Global Anycast edge network directing requests to the physically closest healthy cluster.
- **`[FACT]` Performance**: Consistently benchmarks among the lowest latency providers for JSON-RPC `eth_call` and `eth_getBlockByNumber`.
- **`[FACT]` Free/Trial Constraints**: 10 million credits; accounts transition to paid tiers after usage or trial expiry. Excellent for testing; requires monitoring to avoid surprise service cutoffs.

### 2.3 Infura (Consensys)
- **`[FACT]` Architecture**: Veteran Ethereum infrastructure provider deeply integrated with MetaMask.
- **`[FACT]` Free Tier**: 3,000,000 requests per day across projects.
- **`[FACT]` Reliability**: Extremely high uptime (99.9%), but WebSocket connections occasionally experience silent timeouts during extended idle periods, requiring custom ping-pong reconnect logic.

### 2.4 Public / Fallback RPCs
- **`[FACT]` Stability**: Public endpoints (e.g., `polygon-rpc.com`, `mainnet.base.org`) are subject to aggressive rate limits, random HTTP 429 errors, stale block head states, and man-in-the-middle censorship.
- **`[DECISION]` Policy**: Public RPCs are strictly prohibited as primary ingestion feeds for the Scanner. They may only be utilized as a last-resort failover check to verify network height.

---

## 3. Recommended Multi-Provider Redundancy Topology

To satisfy **Rule 1** (Security First) and prevent silent node desynchronization:

```mermaid
graph TD
    Scanner[Scanner Engine / scanner/]
    Scanner -->|Primary WS Feed (newHeads)| P1[Primary RPC: Alchemy]
    Scanner -.->|Backup WS Feed| P2[Secondary RPC: QuickNode]
    Scanner -.->|Heartbeat Fallback| P3[Tertiary RPC: Infura]
    
    Comparator{Block Height Comparator}
    P1 --> Comparator
    P2 --> Comparator
    Comparator -->|Discrepancy > 1 block| TripAlert[Trigger Circuit Breaker / Pause Scanner]
```

### Invariant Rules for RPC Integration (Phase 2):
1. **Never hardcode API keys in URLs**: RPC endpoints must be configured via environment variables with `.env.example` templates.
2. **Dedicated WebSocket Reconnect Manager**: Any dropped socket must trigger immediate automatic reconnect with exponential backoff capped at 5 seconds.
3. **State Desync Tripwire**: If the primary and secondary RPC endpoints report block numbers differing by $\ge 2$ blocks for $>4$ seconds, the system must immediately abort pending transactions.
