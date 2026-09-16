# PHASE 4.9 — ORDERING-LAYER & ORDER-FLOW RESEARCH
## Epistemic Separation of Visibility Boundaries Across Base, Arbitrum, Optimism, and Polygon

> **STATUS**: COMPLETE — RESEARCH ONLY  
> **SCOPE**: Layer-2 Sequencer Architectures, Builder Infrastructure & Searcher Interfaces  
> **AUTHORITATIVE SOURCES**: Official Arbitrum Nitro Docs, OP Stack Specifications, Flashbots Documentation, Polygon Bor Architecture  
> **SAFETY INVARIANT**: Capital at risk remains strictly **₹0.00 / $0.00**. Zero execution. Phase 5 strictly blocked.

---

## 1. Epistemic Grounding: Fact vs. Inference vs. Hypothesis vs. Unproven

To eliminate epistemic contamination and respect Directive 1 and Directive 5 of [`AGENTS.md`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/AGENTS.md), all statements concerning order flow are partitioned into four strict epistemological categories:

```
┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Category        │ Definition & Specific Status in SAHIKARA                                                         │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. FACT         │ Direct empirical observation verified by reproducible code execution:                           │
│                 │ - eth_newPendingTransactionFilter is rejected on Base, Arbitrum One, and Optimism public RPCs.   │
│                 │ - eth_newPendingTransactionFilter is accepted on Polygon PoS Bor public RPC.                     │
│                 │ - Zero positive net opportunities exist in post-block public state across 1,493 evaluations.    │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. INFERENCE    │ Deductive conclusion following directly from empirical facts:                                    │
│                 │ - SAHIKARA cannot observe unconfirmed transactions on Base, Arbitrum, or Optimism via HTTP RPC.  │
│                 │ - Public RPC observers are structurally blind to in-flight transaction ordering on rollups.      │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. HYPOTHESIS   │ Mechanistic explanation consistent with observed facts but requiring external verification:      │
│                 │ - Fleeting cross-pool pricing dislocations occur inside rollup blocks.                           │
│                 │ - These dislocations are captured by collocated searchers prior to public block broadcast.       │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. UNPROVEN     │ Industry claim or external theory unverified by SAHIKARA's direct empirical data:                │
│                 │ - "Private order flow dominates profitable DEX arbitrage across all L2 rollups."                 │
│                 │ - "Searcher bundles inside private builder relays are net-profitable after priority fees."       │
│                 │ - UNPROVEN because SAHIKARA has no telemetry inside private builder or sequencer infrastructure. │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chain-by-Chain Ordering Layer Architecture

### 2.1 Base (Coinbase / OP Stack Rollup)

#### Transaction Sequencing Architecture
- Base runs standard OP Stack architecture (`op-node` + `op-geth`).
- Currently governed by a single centralized sequencer operated by Coinbase.
- Transactions submitted to the sequencer are ordered via a First-Come, First-Served (FCFS) queue within the active block window, modulated by EIP-1559 priority tips (`maxPriorityFeePerGas`).

#### Public Pending Visibility
- **Public RPC**: Does **NOT** operate a public P2P transaction pool. Calling `eth_newPendingTransactionFilter` returns an HTTP error or is disallowed.
- Transactions submitted to public RPCs are forwarded via private RPC endpoints directly to the sequencer's internal ingestion buffer.

#### Builder & MEV Infrastructure
- **Flashbots / BuilderNet**: Base builders (such as Flashbots and independent block builders) operate builder relays where searchers submit atomic bundles (`eth_sendBundle`).
- **Private Submissions**: Users and searchers can route transactions through private RPC endpoints (e.g., Flashbots Protect) that guarantee no public pre-execution visibility.

#### Documented Searcher Interfaces
- Flashbots Builder RPC (`https://base-relay.flashbots.net` / BuilderNet).
- Direct WebSocket transaction streaming from private node providers (Alchemy / QuickNode private endpoints).

#### Complexity & Infrastructure Cost
- **Complexity**: High. Requires builder bundle construction, simulation via `eth_callBundle`, and management of builder priority tips.
- **Cost Tier**: Medium ($200–$500/month for dedicated node or private RPC subscription).

---

### 2.2 Arbitrum One (Offchain Labs / Nitro Rollup)

#### Transaction Sequencing Architecture
- Arbitrum Nitro runs a centralized Sequencer that produces soft-confirmed blocks every **$\approx 200$ ms**.
- Transactions arrive at the sequencer via direct WebSocket connections and are processed sequentially in arrival order (FCFS).
- Arbitrum has proposed and tested **Timeboost**, a transaction-ordering mechanism where searchers bid for express-lane inclusion advantages (sub-second priority).

#### Public Pending Visibility
- **Public RPC**: `arb1.arbitrum.io/rpc` does **NOT** maintain a public mempool. Calling `eth_newPendingTransactionFilter` returns explicit error:
  `The method "eth_newPendingTransactionFilter" does not exist / is not available.`
- Public node observers receive state updates only after the sequencer commits the 200 ms batch and publishes the block.

#### Sequencing Visibility & Searcher Interfaces
- **Sequencer Feed**: Arbitrum Nitro nodes can subscribe directly to the Sequencer's public real-time WebSocket feed (`wss://arb1.arbitrum.io/feed`).
- The feed broadcasts newly sequenced transactions as they are signed by the sequencer, **before** they are batched and posted to Ethereum L1.
- **Latency Advantage**: Running a local follower node connected to the sequencer feed allows observing transactions within 10–50 ms of sequencer acceptance, compared to 300–800 ms on public HTTP RPCs.

#### Complexity & Infrastructure Cost
- **Complexity**: High. Requires running an Arbitrum Nitro follower node (`nitro-node`) with a high-bandwidth WebSocket connection.
- **Cost Tier**: High ($500–$1,200/month for dedicated server with NVMe storage and collocated bandwidth in AWS us-east-1).

---

### 2.3 Optimism (OP Mainnet / OP Stack Rollup)

#### Transaction Sequencing Architecture
- OP Mainnet operates identical sequencing primitives to Base (`op-node` + `op-geth`).
- Centralized sequencer operated by the Optimism Foundation.
- Blocks are produced at 2.0-second intervals (with sub-second micro-blocks in development via Superchain initiatives).

#### Public Pending Visibility
- **Public RPC**: `mainnet.optimism.io` does **NOT** expose pending transactions. Calling `eth_newPendingTransactionFilter` returns:
  `The method "eth_newPendingTransactionFilter" does not exist / is not available.`

#### Builder & Searcher Interfaces
- Searchers interact via private builder relays and MEV-Boost style rollup builders.
- Transactions are submitted either via standard private RPCs or bundled through builder auction infrastructure.

#### Complexity & Infrastructure Cost
- **Complexity**: Medium-High.
- **Cost Tier**: Medium ($250–$600/month).

---

### 2.4 Polygon PoS (Bor / Heimdall Dual Consensus)

#### Transaction Sequencing Architecture
- Unlike the L2 rollups, Polygon PoS is a standalone sidechain with two consensus layers:
  1. **Heimdall**: Tendermint-based proof-of-stake validator coordination.
  2. **Bor**: Geth-based execution engine producing blocks at 2.0-second intervals in 16-block validator sprints.
- Bor operates a **fully standard Geth peer-to-peer transaction pool (`txpool`)**.

#### Public Pending Visibility
- **Public RPC**: Supported! Calling `eth_newPendingTransactionFilter` on `https://polygon-bor-rpc.publicnode.com` successfully returned active filter IDs (`0x9fec8220608d9647332883bb359504e5`).
- **P2P Mempool Dynamics**: Pending transactions propagate across the Bor P2P gossip network. Searchers running a local Bor node can inspect unconfirmed transactions before block inclusion.

#### Limitations of Public Bor Observation
- While the method is supported, public RPC nodes are rate-limited and sit several hops downstream from the producing validator.
- Collocated searchers establish direct peer connections to the active validator of the current 16-block sprint, observing pending transactions 150–400 ms before public RPC relay nodes.

#### Complexity & Infrastructure Cost
- **Complexity**: Medium. Standard Geth `txpool` inspection scripts.
- **Cost Tier**: Medium ($300–$700/month for dedicated Bor node).

---

## 3. Comparative Architecture & Visibility Matrix

```
┌──────────┬───────────────────┬──────────────┬──────────────────┬──────────────────┬───────────────────────┬────────────────┐
│ Chain    │ Architecture      │ Block Time   │ Public Mempool?  │ Sequencer Feed?  │ Builder Relays?       │ Infra Cost     │
├──────────┼───────────────────┼──────────────┼──────────────────┼──────────────────┼───────────────────────┼────────────────┤
│ Base     │ OP Stack (L2)     │ 2.0 s        │ NO (Disabled)    │ NO (Private)     │ Flashbots / BuilderNet│ $250 - $600/mo │
│ Arbitrum │ Nitro (L2)        │ 0.2 s (200ms)│ NO (Disabled)    │ YES (Public WSS) │ Timeboost / Private   │ $500 - $1200/mo│
│ Optimism │ OP Stack (L2)     │ 2.0 s        │ NO (Disabled)    │ NO (Private)     │ Flashbots Builder     │ $250 - $600/mo │
│ Polygon  │ Bor / Geth (PoS)  │ 2.0 s        │ YES (P2P TxPool) │ N/A (Sprint P2P) │ Fastlane / Validator  │ $300 - $700/mo │
└──────────┴───────────────────┴──────────────┴──────────────────┴──────────────────┴───────────────────────┴────────────────┘
```

---

## 4. Operational Conclusions for SAHIKARA

1. **Public RPC Inadequacy for Pre-Trade Alpha**:
   On Base, Arbitrum, and Optimism, the absence of public pending transaction filters is an immutable architectural choice of the rollup operators. Public RPC observers **cannot** observe order flow prior to block finality.
2. **Arbitrum Sequencer Feed**:
   Arbitrum provides a publicly documented path to pre-block visibility via its Sequencer Feed (`wss://arb1.arbitrum.io/feed`), but consuming it requires a dedicated local Nitro node.
3. **Polygon PoS Mempool**:
   Polygon is the only target chain where pending transactions can be observed via standard RPC methods, but competitive capture requires low-latency P2P peering rather than public HTTP endpoints.
4. **Capital Invariant**:
   Under no circumstances will SAHIKARA provision paid infrastructure or connect credentials during research phases.
