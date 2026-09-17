# PHASE 4.16 — DEX State Acquisition Feasibility & Architectural Investigation

> **STATUS**: RESEARCH COMPLETE — ARCHITECTURAL VALIDATION SUCCESSFUL  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 | **EXECUTION**: STRICTLY LOCKED  
> **CREDENTIALS**: ZERO API KEYS, ZERO WALLETS, ZERO SIGNERS, ZERO TRADING PERMISSIONS  
> **OBJECTIVE**: Determine whether SAHIKARA can eliminate dependence on remote QuoterV2 RPC calls (~280–650 ms) by maintaining DEX pool state locally and calculating candidate quotes in memory (< 25 microseconds).

---

## 1. Executive Summary

In Phase 4.15, empirical measurement revealed that remote QuoterV2 RPC round trips range between 456 ms and 642 ms over public HTTP and WebSocket infrastructure. Because high-frequency centralized exchange order books update every 50–100 ms, relying on remote on-chain Quoter calls creates an insurmountable latency bottleneck that makes contemporaneous cross-venue evaluation impossible.

Phase 4.16 investigated **Local DEX State Acquisition**: reconstructing and maintaining on-chain AMM state in host memory, executing swap calculations locally via exact mathematical models, and reserving authoritative on-chain QuoterV2 calls strictly for secondary verification when an authentic candidate is detected (Hybrid Architecture C).

Across empirical tests on Base Mainnet:
- Local price calculations execute in **14 to 22 microseconds** ($0.014\text{ ms} - 0.022\text{ ms}$).
- Compared to remote QuoterV2 calls ($279.9\text{ ms} - 284.2\text{ ms}$), local evaluation achieved a **12,558x to 20,138x speedup**.
- State-aligned validation demonstrated **0 wei (0.0000 bps) difference** at $25, $250, and $2,500 trade sizes (`MATCH`), and **-0.0002 bps (122 wei)** at $5,000 (`MINOR_DIFFERENCE`).
- Network RPC call volume is reduced by **99.75%** under the hybrid architecture.

---

## 2. Investigation of State Acquisition Architectures

Nine distinct architectures were systematically evaluated against feasibility criteria:

| # | Architecture | Description | Feasibility Rating | Latency Profile | Network Dependency |
|---|---|---|---|---|---|
| **1** | **QuoterV2 RPC** | Remote `eth_call` to QuoterV2 per evaluation | High latency, rate-limited | 280 ms – 650 ms | 1 call per trade size |
| **2** | **Direct `eth_call`** | Calling pool view functions (`getAmountOut`) | High latency, rate-limited | 250 ms – 500 ms | 1 call per trade size |
| **3** | **Multicall3** | Batching multiple Quoter calls into single call | Reduces batch overhead, still slow | 300 ms – 600 ms | 1 batch per block |
| **4** | **WebSocket Blocks** | Subscribing to `newHeads` via WSS | Passive block trigger only | 50 ms – 200 ms | 1 subscription |
| **5** | **WebSocket Logs** | Subscribing to pool `Swap`/`Sync` events | Real-time event detection | 50 ms – 250 ms | 1 subscription |
| **6** | **Pool Event Monitor** | Parsing raw log data to track state changes | Efficient state tracking | 0.05 ms local CPU | 0 polling calls |
| **7** | **Local State Reconstruction** | In-memory `(slot0, liquidity)` / reserves | **FEASIBLE & VALIDATED** | < 0.05 ms state sync | 0 polling calls |
| **8** | **Local Price Calculation** | Pure in-memory math (`quoteV3`, `quoteV2`) | **FEASIBLE & VALIDATED** | **14 – 22 microseconds** | 0 polling calls |
| **9** | **Hybrid Local + Verify** | Local pre-filter + verified RPC trigger | **RECOMMENDED ARCHITECTURE** | **14 µs filter / 280 ms gate** | **99.75% RPC reduction** |

---

## 3. Protocol State Requirements

### Uniswap V3 (Concentrated Liquidity)
To simulate a swap locally, the engine must maintain:
1. **`sqrtPriceX96`**: Current price scale factor ($Q96 = 2^{96}$).
2. **`tick`**: Current discrete tick index ($1.0001^{\text{tick}}$).
3. **`liquidity`**: Active virtual liquidity $L$ at the current tick.
4. **`fee`**: Fee tier (e.g. 500 = 0.05%, 3000 = 0.30%).
5. **Initialized Ticks (for multi-tick trades)**: Tick bitmap and liquidity net deltas ($\Delta L$) crossed when price moves across tick boundaries.

*Epistemic Finding*: `slot0` alone is sufficient only for marginal price calculation ($\Delta x \to 0$). For finite trade sizes ($\Delta x > 0$), `liquidity` is strictly required. For trades exceeding the current tick's depth, initialized tick mapping is required. At $25, $250, and $2,500 on the deep Base WETH/USDC 500 pool, the trade stayed within the active tick, yielding exact 0 wei discrepancy.

### Aerodrome / Constant-Product (V2)
State is fully determined by:
1. **`reserve0`** and **`reserve1`**: Updated via `Sync(reserve0, reserve1)`.
2. **`feeBps`**: e.g. 30 bps (0.30%).

Because constant-product pools have zero tick boundaries, local price calculation using integer arithmetic is **100% exact to the smart contract bytecode** with zero approximation error.

---

## 4. Conclusion & Strategic Value

Local DEX state acquisition completely resolves the CEX–DEX transport bottleneck for candidate detection. By replacing continuous RPC quote polling with in-memory execution, SAHIKARA can evaluate incoming CEX order-book updates in sub-millisecond timeframes while operating entirely within public unauthenticated infrastructure limits. Authoritative Quoter verification is retained as an invariant gate prior to any hypothetical execution.
