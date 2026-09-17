# PHASE 4.13A — PUBLIC PENDING TRANSACTION & MEMPOOL STATE RESEARCH

> **STATUS**: EMPIRICAL PROBE COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **EVIDENCE STANDARD**: Public RPC Capability Probing & Protocol Architecture Review  

---

## 1. Research Scope

This dossier investigates whether pending pre-confirmation transactions are observable via standard public/free RPC endpoints across **Base, Arbitrum One, Optimism, and Polygon PoS**. 

The investigation evaluated two standard JSON-RPC query methods:
1. `eth_subscribe("newPendingTransactions")` via WebSocket.
2. `eth_newPendingTransactionFilter` via HTTP.

---

## 2. Empirical Probe Findings by Network

| Network | Architecture Type | Pending TX Visibility | Mechanism / RPC Response | Operational Reality |
| :--- | :--- | :---: | :--- | :--- |
| **Base** | Optimistic Rollup (OP Stack) | **`UNAVAILABLE`** | `eth_newPendingTransactionFilter` disabled / rejected | Centralized sequencer processes transactions directly without exposing a public P2P mempool. |
| **Arbitrum One** | Optimistic Rollup (Nitro) | **`UNKNOWN` / `UNAVAILABLE`** | Method unsupported on public nodes | Nitro sequencer operates an internal FIFO queue (sub-250ms batching); no public pre-execution feed. |
| **Optimism** | Optimistic Rollup (OP Stack) | **`UNKNOWN` / `UNAVAILABLE`** | Method unsupported on public nodes | Identical to Base; transactions are submitted directly to the sequencer endpoint. |
| **Polygon PoS** | Proof-of-Stake Sidechain | **`AVAILABLE`** | `eth_newPendingTransactionFilter` returned active filter ID | Traditional Bor/Heimdall gossip network maintains a public peer-to-peer transaction pool. |

---

## 3. L2 Sequencer Dynamics vs Private Order Flow

### Critical Epistemic Boundary:
Under SAHIKARA Directive 10 and Critical Language Rule 40:
> **"Do NOT infer private order flow explains the result from the absence of public pending transactions."**

The absence of a public mempool on Base, Arbitrum, and Optimism is an **inherent architectural feature of Rollup sequencer designs**, not evidence of clandestine private searcher extraction:
- In the standard OP Stack (Base, Optimism), transactions submitted to public endpoints are forwarded directly to the sequencer's private execution engine.
- In Arbitrum Nitro, the Sequencer handles transaction ordering on a first-come, first-served (FCFS) basis within a small time drift window.

### Classification:
$$\mathbf{PRIVATE\_ORDER\_FLOW\_VISIBILITY} = \mathbf{UNKNOWN\ /\ UNOBSERVABLE}$$
From the vantage point of public RPC endpoints, private builder order flow is physically invisible. Documenting sequencer specifications provides context, but cannot be substituted for empirical evidence.
