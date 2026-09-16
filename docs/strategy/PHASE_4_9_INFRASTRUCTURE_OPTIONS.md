# PHASE 4.9 — INFRASTRUCTURE OPTIONS & SEARCH-SPACE AUDIT
## Comprehensive Trade-Off Matrix for Future Research & Quantification of Blind Spots

> **STATUS**: COMPLETE — RESEARCH ONLY  
> **PURPOSE**: Evaluate Technical Feasibility and Cost of Next-Generation Discovery Infrastructure  
> **OPERATIONAL INVARIANT**: SAHIKARA will NOT purchase, subscribe to, or provision paid infrastructure without human authorization. Capital at risk remains strictly **₹0.00 / $0.00**.

---

## 1. Infrastructure Options Comparative Analysis

To determine whether upgraded infrastructure could resolve observation latency and visibility limitations, six architectural tiers were evaluated across seven technical dimensions.

```
┌──────┬──────────────────────┬──────────────┬──────────────────┬──────────────┬──────────────────┬─────────────────┬──────────────────┬─────────────────┐
│ Tier │ Architecture         │ Network Lat. │ Data Visibility  │ Reliability  │ Hist. State Acc. │ Operational Cpx │ Cost Category    │ Security Risk   │
├──────┼──────────────────────┼──────────────┼──────────────────┼──────────────┼──────────────────┼─────────────────┼──────────────────┼─────────────────┤
│ A    │ Public HTTP RPC      │ 270–500 ms   │ Post-Block Only  │ Poor (429s)  │ Recent (128 blk) │ Zero (Current)  │ Free ($0/mo)     │ Zero (No creds) │
│ B    │ Premium HTTP RPC     │ 80–180 ms    │ Post-Block Only  │ 99.9% SLA    │ Deep (Add-on)    │ Very Low        │ Low ($50–200/mo) │ Very Low (API k)│
│ C    │ WebSocket RPC        │ 40–120 ms    │ Streamed Blocks  │ High         │ Streamed Heads   │ Low             │ Low ($100–300/mo)│ Low (API key)   │
│ D    │ Dedicated Full Node  │ 5–25 ms      │ P2P / WSS Feed   │ Self-Managed │ Pruned (128 blk) │ High (DevOps)   │ Med ($400–800/mo)│ Low (Isolated)  │
│ E    │ Dedicated Archive    │ 5–25 ms      │ Full Historical  │ Self-Managed │ Unrestricted EVM │ Very High (TB+) │ High ($1–2.5k/mo)│ Low (Isolated)  │
│ F    │ Specialized Searcher │ < 5 ms       │ Pre-Block Bundles│ High (MEV)   │ Simulation Engine│ Extremely High  │ V. High ($2k+/mo)│ High (Key auth) │
└──────┴──────────────────────┴──────────────┴──────────────────┴──────────────┴──────────────────┴─────────────────┴──────────────────┴─────────────────┘
```

### 1.1 Detailed Evaluation of Infrastructure Tiers

#### Tier A: Public HTTP RPC (SAHIKARA's Current Baseline)
- **Vendors**: `mainnet.base.org`, `arb1.arbitrum.io/rpc`, `mainnet.optimism.io`, `polygon-bor-rpc.publicnode.com`.
- **Strengths**: Zero financial cost, zero credential risk, completely open-source reproducible.
- **Fatal Limitations**: Rate-limited (HTTP 429), average round-trip latency of 270–500 ms, zero pre-block mempool visibility, no historical state overrides (`eth_call` at ancient blocks rejected).

#### Tier B: Premium RPC Services
- **Vendors**: Alchemy, QuickNode, Infura, Chainstack.
- **Advantages**: Eliminates rate-limiting, guaranteed compute units (CUs), reduced network latency via geographically distributed edge caching (80–180 ms).
- **Limitations**: Still restricted to post-block broadcast; does not provide private sequencer feeds on rollups.

#### Tier C: Managed WebSocket RPC
- **Advantages**: Persistent TCP connection eliminates HTTP handshake overhead. Push-based block header subscriptions (`newHeads`) reduce observation latency by 150–300 ms compared to HTTP polling.
- **Limitations**: Connection drops require reconnection logic; still blind to unsequenced rollup transactions.

#### Tier D: Dedicated Full Node (Local Reth / Nitro / Geth)
- **Deployment**: AWS EC2 `c6i.2xlarge` or dedicated bare-metal in `us-east-1` (collocated with Base/Arbitrum sequencer infrastructure).
- **Advantages**: Local IPC socket communication (<1 ms local RPC latency). Direct consumption of Arbitrum Sequencer Feed (`wss://arb1.arbitrum.io/feed`). Local state inspection with zero rate limits.
- **Limitations**: High operational overhead (chain re-org handling, state pruning, disk space management).

#### Tier E: Dedicated Archive Node
- **Advantages**: Retains all historical state diffs since genesis. Enables **Exact Historical Replay** (`EXACT_REPLAY`) with state overrides, allowing retro-testing of historical blocks with zero price leakage.
- **Limitations**: Extreme storage requirements (8 TB+ NVMe for Arbitrum/Base, 15 TB+ for Polygon Bor). Substantial hardware cost ($1,200–$2,500/month).

#### Tier F: Specialized Searcher Infrastructure (bloxRoute / Builder Relays)
- **Vendors**: bloxRoute BDN, Flashbots MEV-Share / BuilderNet, Eden Network.
- **Advantages**: Direct access to private builder bundles, proprietary low-latency transaction propagation networks, sub-millisecond arrival notifications.
- **Limitations**: High monthly subscription fees + builder profit cuts (often 80–95% of gross arbitrage spread). Requires live trading keys and smart contract executor deployment (strictly prohibited in Phase 4).

---

## 2. Search-Space Limitation Audit (Quantifying Blind Spots)

The critical audit in [`PHASE_4_9_PHASE_4_8_CRITICAL_AUDIT.md`](file:///c:/Users/Rushi/Desktop/Projects/Websites/SAHIKARA%20%E2%80%94%20Autonomous%20DEX%20Arbitrage%20&%20Market%20Intelligence%20Engine/docs/strategy/PHASE_4_9_PHASE_4_8_CRITICAL_AUDIT.md) established that claiming pool coverage deficiency was "refuted" was an overstatement.
Below is the exact quantification of what SAHIKARA monitors versus what remains unmonitored.

```
┌──────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────┐
│ Dimension                            │ Inside SAHIKARA Monitored    │ Excluded / Outside Monitored Universe        │
├──────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────┤
│ 1. Active Pools                      │ 152 Pools across 4 chains    │ > 60,000 Pools across target chains          │
│ 2. DEX Protocols Monitored           │ Uniswap v3, Aerodrome,       │ Curve, Balancer v2, Maverick, Camelot,       │
│                                      │ Slipstream, PancakeSwap v3   │ QuickSwap v3, Velodrome, SushiSwap, Uni v2   │
│ 3. Token Universe                    │ 24 Canonical Assets (WETH,   │ Thousands of long-tail tokens, new launches, │
│                                      │ USDC, USDT, cbBTC, OP, etc.) │ yield tokens (wstETH), bridge synthetic pegs │
│ 4. Fee Tiers Monitored               │ 1 bps, 5 bps, 30 bps, 100 bps│ Dynamic fee pools, 25 bps, 200 bps tiers     │
│ 5. Target Chains                     │ Base, Arbitrum, OP, Polygon  │ Ethereum L1, Solana, Avalanche, BSC, ZKsync  │
│ 6. Cycle Topologies Evaluated        │ 2-hop cycles, 3-hop triangular│ 4-hop+ cycles, multi-token baskets,          │
│                                      │ (Single-chain atomic)        │ cross-chain spatial arbitrage (bridge-based) │
│ 7. Order-Flow Layer                  │ Post-Block Public RPC State  │ Pre-Block Sequencer Queues, Builder Bundles  │
└──────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────┘
```

### 2.1 Critical Blind Spots

1. **Curve & Balancer Invariant Pools**:
   - SAHIKARA's adapters currently support concentrated liquidity (Uniswap v3 / Slipstream) and constant-product ($xy=k$).
   - High-volume correlated pairs (such as `cbBTC/WBTC`, `wstETH/WETH`, `USDC/USDT`) trade primarily on Curve Finance stableswap and Balancer composable stable pools. 
   - Discrepancies between Uniswap v3 ticks and Curve amplification coefficients were **completely unmonitored**.

2. **Cross-DEX Arbitrage with Native Ecosystem AMMs**:
   - On Arbitrum, **Camelot DEX** holds significant liquidity in ecosystem tokens (ARB, GRAIL, PENDLE).
   - On Optimism, **Velodrome v2** is the dominant liquidity venue.
   - On Polygon, **QuickSwap** holds substantial MATIC/POL liquidity.
   - Restricting Arbitrum to Uniswap v3 and Optimism to Uniswap v3 eliminated cross-DEX arb between the primary native AMM and Uniswap!

3. **Long-Tail Asynchronous Rebalancing**:
   - The 24 canonical assets monitored represent the most heavily arbitrated assets in crypto, continuously scanned by multi-million-dollar HFT firms.
   - The long-tail universe (where pricing is asynchronous and human retail trades shift pool prices) was excluded for safety and liquidity preservation.

---

## 3. Strategic Recommendations for Future Phases

1. **Do NOT Purchase Infrastructure Prematurely**:
   Upgrading to Tier D or Tier F infrastructure without first confirming that cross-DEX pricing divergence exists would result in substantial ongoing cloud expenditure ($500–$2,000/month) with zero guaranteed economic return.
2. **Expand Adapter Coverage First (Software Layer)**:
   Prior to provisioning dedicated nodes, SAHIKARA should implement adapters for Curve Finance and ecosystem-native DEXes (Camelot, Velodrome, QuickSwap) to test whether cross-DEX spreads exist on public RPCs before spending on latency reduction.
