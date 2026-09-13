# CHAIN_COMPARISON.md — Comprehensive EVM Blockchain Comparative Analysis

> **DOCUMENT STATUS**: ACTIVE RESEARCH (PHASE 1)  
> **PURPOSE**: Evaluate candidate EVM blockchains to determine the optimal deployment environment for SAHIKARA's initial arbitrage validation and eventual production scaling.  
> **RULE**: Do NOT finalize the target chain prematurely. Mark all evaluations with truth-tier labels (`[FACT]`, `[ASSUMPTION]`, `[HYPOTHESIS]`).

---

## 1. Candidate Chains Evaluated & Research Status

In light of verified external market data and independent architectural review:
1. **Base (PRIMARY PROVISIONAL)**: Demonstrates materially higher current DEX activity than Polygon, deep Uniswap and Aerodrome liquidity, an expansive native USDC ecosystem, and ~200ms Flashblocks pre-confirmation infrastructure. Status: **PROVISIONAL — NOT FINAL**.
2. **Polygon PoS (SECONDARY PROVISIONAL)**: Maintained as the secondary research environment for low gas ($0.005–$0.02), dual-DEX (Uniswap v3 + QuickSwap) dynamics, and public mempool comparative data.
3. **Arbitrum One (Secondary Candidate)**: Deepest TVL, 250ms sub-blocks, high latency competition.
4. **Optimism / OP Mainnet (Secondary Candidate)**: Stable OP Stack environment with Velodrome/Uniswap.
5. **BNB Smart Chain / BSC (Deprioritized Candidate)**: Higher gas floor (~$0.03–$0.15) and PancakeSwap monopoly make it unsuitable for ₹100 micro-capital testing.

---

## 2. Comparative Metrics Matrix

| Evaluation Metric | Base (Primary Provisional) | Polygon PoS (Secondary) | Arbitrum One | OP Mainnet | BNB Chain |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Research Tier** | **PRIMARY PROVISIONAL** | **SECONDARY PROVISIONAL** | Secondary Candidate | Secondary Candidate | Deprioritized |
| **Architecture Type** | Optimistic Rollup (OP Stack) | Proof-of-Stake Sidechain | Optimistic Rollup (Nitro) | Optimistic Rollup (OP Stack) | Proof-of-Staked-Authority |
| **Average Complex Tx Gas** | ~$0.001 – $0.008 (post-4844) | ~$0.005 – $0.02 | ~$0.005 – $0.03 (post-4844) | ~$0.003 – $0.02 (post-4844) | ~$0.03 – $0.15 |
| **Block Time** | ~2.0s (Block) / ~200ms (Flashblock)| ~2.0 seconds | ~0.25 seconds (sequencer) | ~2.0 seconds | ~3.0 seconds |
| **Time to Soft Finality** | ~200ms (Flashblocks pre-conf) | ~2.0 seconds | ~250 ms (Sequencer) | ~2.0 seconds (Sequencer) | ~3.0 seconds |
| **Time to Hard Finality** | ~7 days (L1 dispute window) | ~15–30 min (Milestones) | ~7 days (L1 dispute window) | ~7 days (L1 dispute window) | ~2.5 min (Fast finality) |
| **Reorg Frequency** | Near zero (Single sequencer) | Low–Medium (1–2 blocks) | Near zero (Single sequencer) | Extremely low (Single sequencer) | Very low |
| **Mempool Visibility** | Private Sequencer (FIFO) | Public P2P Mempool | Private Sequencer (FIFO) | Private Sequencer (FIFO) | Public P2P Mempool |
| **MEV Protection Options** | Flashblocks stream / Flashbots | Private RPCs (FastLane) | Time-Boost (planned) / BOLD | Sequencer Priority | 48-validator gas auctions |
| **DEX Ecosystem Depth** | Aerodrome, Uniswap v3, Sushi | Uniswap v3, QuickSwap, Sushi | Uniswap v3, Camelot, Sushi, Curve | Uniswap v3, Velodrome, Curve | PancakeSwap, Uniswap v3, BiSwap |
| **DEX 24h Volume (Avg)** | **$400M – $1.0B+** | $50M – $150M | $400M – $1.2B | $50M – $150M | $300M – $700M |
| **Tooling & Infrastructure**| Foundry, Hardhat, Ethers, Viem | Foundry, Hardhat, Ethers, Viem | Foundry, Hardhat, Ethers, Viem | Foundry, Hardhat, Ethers, Viem | Foundry, Hardhat, Ethers, Viem |

---

## 3. Detailed Chain Profiles

### 3.1 Base (PRIMARY PROVISIONAL)
- **`[FACT]` Architecture**: An Ethereum Layer-2 rollup built on the MIT-licensed OP Stack, incubated by Coinbase.
- **`[FACT]` Gas Behavior**: Dual fee model (L2 execution + L1 blob data fee). Following EIP-4844 blobs, fees on Base consistently hover in the fractions of a cent ($0.001 – $0.008 per swap).
- **`[FACT]` DEX Activity**: Materially higher trading volume and on-chain user activity than Polygon PoS. Aerodrome Finance and Uniswap v3 maintain massive liquidity and continuous order flow.
- **`[FACT]` Base Flashblocks (Major Architecture Candidate)**:
  - **Overview**: Base is rolling out **Flashblocks**, a pre-confirmation mechanism produced by the sequencer that streams block state deltas every **~200 milliseconds** over WebSocket.
  - **Pre-Confirmed Transaction Stream**: Rather than waiting for full 2-second block assembly, the scanner can listen to the Flashblocks WebSocket stream to observe pending transactions and state updates in near-real-time.
  - **Pending-State Queries & Simulation**: Allows executing `eth_call` simulations against the latest 200ms pre-confirmed state (`pending` block tag), dramatically reducing stale quote hazards.
  - **Nonce & Transaction Status Handling**: Flashblocks emit pre-confirmation receipts, allowing deterministic off-chain nonce tracking and immediate detection of whether an arbitrage transaction was included in the latest 200ms slice or superseded.
  - *Constraint*: Documented for architecture research only; **do NOT implement scanner integration yet**.
- **`[ASSUMPTION]` Viability for ₹100 Capital**: Low gas costs and deep Aerodrome ↔ Uniswap liquidity make Base the primary candidate for micro-capital testing, subject to latency competition.

---

### 3.2 Polygon PoS (SECONDARY PROVISIONAL)
- **`[FACT]` Architecture**: Decentralized commit-chain secured by ~100 validators using Bor and Heimdall.
- **`[FACT]` Gas Behavior**: EIP-1559 gas model in POL. Typical swap gas is $0.005–$0.02.
- **`[FACT]` Block & Finality**: 2.0-second block times with periodic 1–2 block reorgs before Heimdall checkpoint finality.
- **`[FACT]` Role in SAHIKARA**: Retained as the **secondary research environment**. Its public mempool provides critical comparative baseline data against Base's private sequencer model.
- **`[FACT]` DEX Landscape**: Dominated by QuickSwap (Algebra v3 + v2) and Uniswap v3.

---

### 3.3 Arbitrum One
- **`[FACT]` Architecture**: The leading optimistic rollup by Total Value Locked (TVL), running on the Nitro execution engine.
- **`[FACT]` Gas Behavior**: Two-part fee structure (L2 execution + L1 calldata via blobs). Typical multi-hop swap cost is $0.005 – $0.025 USD.
- **`[FACT]` Block & Finality**: Sequencer generates sub-blocks every ~250 milliseconds. Provides near-instantaneous soft confirmation.
- **`[FACT]` Arbitrage & MEV**: Centralized sequencer enforces FIFO ordering with zero public mempool. Arbitrageurs compete purely on network latency to the sequencer endpoint ("latency racing"). Arbitrum is developing a "Time-Boost" mechanism that allows bids for priority milliseconds.
- **`[FACT]` DEX Landscape**: Uniswap v3, Camelot, SushiSwap, and Balancer. Massive liquidity depth.
- **`[ASSUMPTION]` Viability for ₹100 Capital**: Sub-second block times mean spreads decay in milliseconds. An off-chain bot running from standard remote hosting without dedicated high-frequency infrastructure will struggle to beat co-located searchers.

---

### 3.4 Optimism (OP Mainnet)
- **`[FACT]` Architecture**: The flagship rollup of the Superchain ecosystem, running OP Stack.
- **`[FACT]` Gas Behavior**: Identical OP Stack gas mechanics to Base. Ultra-low L1 blob posting costs ($0.003 – $0.015 per swap).
- **`[FACT]` Block & Finality**: 2.0-second block time with single sequencer soft finality.
- **`[FACT]` DEX Landscape**: Dominated by Velodrome Finance and Uniswap v3. Liquidity and volume are somewhat lower than Arbitrum and Base, leading to fewer active price dislocations.
- **`[ASSUMPTION]` Viability for ₹100 Capital**: Favorable gas economics, but lower spread frequency due to lower overall retail volume compared to Base.

---

### 3.5 BNB Smart Chain (BSC)
- **`[FACT]` Architecture**: A Proof-of-Staked-Authority (PoSA) sidechain with 40+ active validators, hard-forked from Go-Ethereum.
- **`[FACT]` Gas Behavior**: Gas price has a protocol floor of 1–3 Gwei. A swap consumes ~$0.03 – $0.15 USD in BNB gas, which is higher than Polygon or post-4844 Layer 2s.
- **`[FACT]` Block & Finality**: 3.0-second block time. Fast finality reached within ~2.5 minutes.
- **`[FACT]` Arbitrage & MEV**: Public mempool with intense validator tip auctions and MEV competition dominated by specialized searchers.
- **`[FACT]` DEX Landscape**: PancakeSwap commands overwhelming monopoly on liquidity (>80%). Finding two independent, liquid DEXs with cross-spread divergence is harder than on Polygon or Base.
- **`[ASSUMPTION]` Viability for ₹100 Capital**: Higher gas floor ($0.05+) consumes 4–5% of a ₹100 capital base in a single revert, making BSC unviable for micro-capital testing without flash loans.

---

## 4. Multi-Factor Scoring Framework (Preliminary Evaluation)

| Category | Weight | Polygon PoS | Base | Arbitrum One | OP Mainnet | BNB Chain |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Transaction Cost (<₹1 per tx)** | 25% | 8.5 / 10 | **9.5 / 10** | 8.5 / 10 | 9.0 / 10 | 5.0 / 10 |
| **Execution Speed & Latency** | 15% | 7.0 / 10 | 8.0 / 10 | **9.5 / 10** | 8.0 / 10 | 6.5 / 10 |
| **DEX Duopoly / Discrepancy Potential**| 20% | **9.0 / 10** | 8.5 / 10 | 8.0 / 10 | 7.0 / 10 | 4.0 / 10 |
| **MEV Protection / Simplicity** | 15% | 6.5 / 10 | **8.5 / 10** | 8.0 / 10 | 8.0 / 10 | 5.0 / 10 |
| **RPC & Infrastructure Stability** | 15% | 8.0 / 10 | 8.5 / 10 | **9.0 / 10** | 8.5 / 10 | 7.5 / 10 |
| **Suitability for ₹100 Capital** | 10% | **8.5 / 10** | 8.5 / 10 | 6.0 / 10 | 7.5 / 10 | 3.0 / 10 |
| **Weighted Score (Preliminary)** | 100% | **8.00** | **8.65** | **8.20** | **7.95** | **5.25** |

*Note: Scores are preliminary research estimates and DO NOT represent a finalized selection. Detailed empirical benchmarking during Phase 1 will substantiate final scores.*

---

## 5. Working Hypotheses for Further Research

- **`[HYPOTHESIS-01]`**: Base and Polygon PoS offer the only viable economic environments where ₹100 ($1.20) capital can absorb the cost of a reverted transaction without losing $>10\%$ of its balance in a single execution.
- **`[HYPOTHESIS-02]`**: Polygon PoS has higher cross-DEX spatial spread persistence due to balanced liquidity competition between QuickSwap and Uniswap v3, whereas Base requires competing with sophisticated ve(3,3) Aerodrome routing algorithms.
