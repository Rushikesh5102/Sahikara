# PHASE 4.13A — TRANSACTION ORDERING, SEQUENCING & REPLAY CAPABILITY RESEARCH

> **STATUS**: RESEARCH COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **EVIDENCE STANDARD**: Documented Protocol Architecture & Empirical Sequence Analysis  

---

## 1. Network Sequencer & Ordering Architectures

To assess whether sub-block ordering effects conceal arbitrage opportunities, the transaction sequencing models of the four evaluated networks were audited against official specifications:

### 1. Base (Chain ID 8453)
- **Sequencer Architecture**: Single centralized sequencer operated by Coinbase utilizing the OP Stack (Bedrock specification).
- **Ordering Mechanism**: Priority gas fee auction (PGF) combined with FIFO arrival at the sequencer interface.
- **Block Production**: Regular 2-second block intervals.
- **Pending State**: No public p2p mempool. Transactions are posted directly to the sequencer.
- **MEV Landscape**: Flashbots / builder infrastructure is actively developing; private order flow cannot be seen via public nodes.

### 2. Arbitrum One (Chain ID 42161)
- **Sequencer Architecture**: Offchain Nitro Sequencer.
- **Ordering Mechanism**: First-Come, First-Served (FCFS) within a deterministic time-drift window ($\approx \pm 1\text{ second}$).
- **Block Production**: Fast sub-blocks produced every $\approx 250\text{ ms}$; aggregated into L1 batches.
- **Sequencer Feed**: Arbitrum operates a public WebSocket Sequencer Feed (`wss://arb1.arbitrum.io/feed`), but access on free nodes is rate-limited and requires dedicated streaming parsers.
- **MEV Landscape**: Time-boost auction mechanics have been proposed/researched; latency arbitrage dominates searcher competition.

### 3. Optimism (Chain ID 10)
- **Sequencer Architecture**: Single OP Stack sequencer operated by the Optimism Foundation.
- **Ordering Mechanism**: FIFO ordering with priority fee sorting.
- **Block Production**: 2-second block intervals.
- **Pending State**: Private sequencer ingress; public nodes do not expose a mempool.

### 4. Polygon PoS (Chain ID 137)
- **Sequencer Architecture**: Decentralized Bor validator set coordinated by Heimdall (Tendermint-based PoS).
- **Ordering Mechanism**: Public gossip mempool; validators sort transactions by effective gas price.
- **Block Production**: 2-second block intervals produced in 16-block validator sprints.
- **MEV Landscape**: Traditional Ethereum-style priority gas auctions and searcher bundling (e.g. MEV-Bor).

---

## 2. Ordering Evidence Levels Achieved

In accordance with SAHIKARA Directive 29, each chain is classified by the highest evidence level actually achieved in the repository:

| Chain | Highest Achieved Level | Justification & Verification Status |
| :--- | :---: | :--- |
| **Base** | **LEVEL 2** | Event-order sequence reconstructed from `transactionIndex` and `logIndex`. No public pending txs. |
| **Arbitrum One** | **LEVEL 2** | Event-order sequence reconstructed from logs. Nitro sequencer feed was not consumed via paid infrastructure. |
| **Optimism** | **LEVEL 2** | Event-order sequence reconstructed from logs. Private sequencer ingress. |
| **Polygon PoS** | **LEVEL 3** | Successfully probed `eth_newPendingTransactionFilter` on Bor (public mempool capability present), alongside LEVEL 2 event reconstruction. |

*Epistemic Rule: LEVEL 5 (Direct Private Order Flow Visibility) is strictly UNMET on all four networks.*

---

## 3. Critical Limitations: Replay Capabilities

### Classification of Engine Replay:
$$\mathbf{REPLAY\_CAPABILITY} = \mathbf{EVENT\_SEQUENCE\_RECONSTRUCTION}$$

1. **Terminal Block State vs Intermediate State**: Standard EVM JSON-RPC `eth_call(tx, blockNumber)` executes against the **terminal state** at the conclusion of `blockNumber`. It does NOT execute at an arbitrary midpoint after transaction $k$.
2. **Implication**: When two swap events $e_1$ and $e_2$ occur in the same block, SAHIKARA reconstructs that $e_1$ preceded $e_2$. However, querying reserves or quotes at block $N$ reflects the cumulative effect of both transactions.
3. **Exact Intermediate Replay**: True intermediate-state replay (`EXACT_INTERMEDIATE_STATE_REPLAY`) requires `debug_traceTransaction` or state overrides on dedicated archive nodes, which would require commercial infrastructure outside the zero-capital mandate.
