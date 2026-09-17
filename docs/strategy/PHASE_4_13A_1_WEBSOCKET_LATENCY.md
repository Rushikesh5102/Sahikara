# PHASE 4.13A.1: WebSocket Capabilities & Same-Block Arrival Research

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL SUBJECT**: Empirical evaluation of public WebSocket endpoints  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED  

---

## 1. Scope & Constraints

Under strict project directives:
- **Zero Paid Infrastructure**: No premium Alchemy, Infura, QuickNode, or specialized RPC plans were purchased.
- **Pure Public Endpoint Probing**: Tested standard public endpoints exposed by network foundations and community nodes.

---

## 2. Chain-by-Chain Empirical Findings

| Chain | Public WebSocket URL | Subscription Probed | Empirical Result | Status Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Base** | `wss://mainnet.base.org` | `watchBlockNumber` / `newHeads` | Handshake accepted; threw socket `ErrorEvent` / timed out after 8.0s under live subscription. | `UNRELIABLE` (Free Tier) |
| **Arbitrum One** | `wss://arb1.arbitrum.io/feed` | `newHeads` / Feed Server | Endpoint does not serve standard JSON-RPC WebSocket protocol on public root; connection reset. | `UNSUPPORTED` / `UNRELIABLE` |
| **OP Mainnet** | `wss://mainnet.optimism.io` | `newHeads` | Connection refused / timed out without commercial API key. | `UNRELIABLE` |
| **Polygon PoS** | `wss://polygon-bor-rpc.publicnode.com` | `eth_subscribe("logs")` | Socket connected; throttled and closed connection upon receiving log filters. | `RATE_LIMITED` |

---

## 3. Same-Block Comparison Analysis

### A. Theoretical Ideal
In an ideal dual-transport configuration:
$$\text{WS\_vs\_HTTP\_DIFFERENCE} = T_{\text{HTTP\_receive\_monotonic}} - T_{\text{WS\_receive\_monotonic}}$$
Because WebSocket connections push block headers proactively as soon as the sequencer/validator broadcasts them, while HTTP polling queries periodically (e.g. every $1,000\text{ ms}$), WebSocket notifications are expected to arrive:
$$\Delta \approx \frac{\text{PollInterval}}{2} + T_{\text{HTTP\_RTT}} \approx 500\text{ ms} + 200\text{ ms} = 700\text{ ms earlier}$$

### B. Empirical Public Endpoint Reality
On public free infrastructure:
1. **Public WebSocket endpoints drop connections aggressively**: Open nodes cannot sustain persistent, stateful WebSocket multiplexing for millions of global developers without rate-limiting or terminating idle sockets.
2. **Push Notifications are Batched**: Public nodes frequently batch WebSocket pushes to conserve bandwidth, diminishing the sub-millisecond advantage of persistent sockets.
3. **HTTP Polling Remains More Resilient on Free Tier**: Stateless HTTP requests with exponential backoff and fallback endpoints succeed where stateful public WebSockets fail.

---

## 4. Architectural Epistemic Conclusion

- **Finding**: Public WebSocket endpoints cannot be relied upon for mission-critical sub-second block streaming without dedicated, paid, authenticated RPC connections.
- **Rule**: Per project rules, no paid services may be acquired during research phases. Therefore, WebSocket latency advantages remain an architectural capability of authenticated nodes rather than an empirically demonstrated property of public endpoints.
