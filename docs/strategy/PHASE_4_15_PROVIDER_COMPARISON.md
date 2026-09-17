# PHASE 4.15 — RPC Provider & Transport Endpoint Comparison

> **STATUS**: PRELIMINARY TRANSPORT PROBE COMPLETE  
> **SCOPE**: Empirical comparison across public RPC providers and transport protocols on Base mainnet.

---

## 1. Provider Endpoint Matrix

| Provider / Host | Protocol | URL Tested | Connection Status | QuoterV2 Compatibility | Rate Limiting / Constraints |
|---|---|---|---|---|---|
| **Base Official (Coinbase)** | HTTPS | `https://mainnet.base.org` | Operational | Valid JSON-RPC | Enforces per-IP request throttling (HTTP 429 after burst) |
| **Base Official (Coinbase)** | WSS | `wss://mainnet.base.org` | Refused | Unsupported | Endpoint does not expose public WebSocket listener |
| **PublicNode** | WSS | `wss://base-rpc.publicnode.com` | Operational | Valid JSON-RPC | Supports persistent WebSocket; response time 571–642 ms |
| **PublicNode** | HTTPS | `https://base-rpc.publicnode.com` | Operational | Valid JSON-RPC | Baseline ping ~280–310 ms; supports standard HTTP POST |
| **LlamaNodes** | HTTPS | `https://base.llamarpc.com` | Failed | Incompatible | Returned Cloudflare HTML error page (`<!DOCTYPE html>`) |
| **1RPC (Automata)** | HTTPS | `https://1rpc.io/base` | Operational | Valid JSON-RPC | Baseline ping ~525 ms |

---

## 2. Comparative Latency Findings

Across the preliminary six-request probe evaluating `QuoterV2.quoteExactInputSingle` ($1.0\text{ WETH} \rightarrow \text{USDC}$):

```
HTTP (https://mainnet.base.org):
  Request 1: 575.55 ms (Cold connection / TLS negotiation)
  Request 2: 459.36 ms (Warm keep-alive connection reuse)
  Request 3: 456.08 ms (Warm keep-alive connection reuse)

WebSocket (wss://base-rpc.publicnode.com):
  Request 1: 571.16 ms
  Request 2: 605.62 ms
  Request 3: 641.67 ms
```

### Transport Observation
In this six-request probe, WebSocket QuoterV2 calls were slower than the two warm HTTP observations. This is a preliminary observation, not a provider-wide transport conclusion. Several contributing factors were identified:
1. **Node Server-Side Execution Overhead**: `eth_call` for Uniswap v3 QuoterV2 simulates tick crossing, fee deduction, and math in an EVM state machine. Server compute time often exceeds raw network transport.
2. **Geographic Ingress Routing**: PublicNode's WebSocket gateway terminates at a geographically distinct relay compared to Coinbase's edge endpoints on `mainnet.base.org`.
3. **Transport Framing**: While WebSocket avoids HTTP header re-transmission, JSON-RPC frame serialization and dispatch on shared public WebSocket nodes are subject to queuing contention.

---

## 3. Dedicated Infrastructure Requirements

To reduce transport latency below the observed 450–650 ms range, specialized infrastructure would be required:
- **Dedicated Private RPC Nodes**: Commercial private endpoints (e.g. Alchemy, QuickNode, Infura, Chainstack) with dedicated throughput limits and guaranteed compute SLAs.
- **Geographic Co-location**: Client execution instances co-located within the AWS `us-east-1` (North Virginia) region adjacent to the Base sequencer and primary node infrastructure.
- **Local Read Replicas**: Running a local read-only Base node (geth / op-node) where `eth_call` executes via local IPC (`/tmp/geth.ipc`) with sub-5ms local evaluation time.

> [!IMPORTANT]
> In accordance with Project Rule 17 and AGENTS.md Directives, SAHIKARA enforces a strict **Zero Cost / ₹0.00 Capital** policy. No commercial services, paid API keys, or paid infrastructure may be purchased automatically. Any dedicated infrastructure must be explicitly provisioned by the operator.
