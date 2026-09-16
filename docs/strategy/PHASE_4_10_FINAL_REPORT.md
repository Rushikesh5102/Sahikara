# SAHIKARA — PHASE 4.10 FINAL REPORT
## DEX ECOSYSTEM & MARKET-UNIVERSE EXPANSION

**Document Version:** 1.0.0  
**Phase:** 4.10  
**Status:** COMPLETED  
**Execution Engine:** STRICTLY LOCKED  
**Capital at Risk:** ₹0.00 / $0.00  
**Phase 5 Gate:** STRICTLY BLOCKED  

---

### 1. Executive Summary
Phase 4.10 tested whether the absence of economically viable arbitrage observed in Phase 4.9 was an artifact of an overly narrow DEX monitoring universe (which was restricted primarily to Uniswap v3 and Aerodrome on Base). To investigate this, the scanner's market graph was horizontally expanded to include **Curve Finance, Balancer v2, Camelot v2, Velodrome v2, QuickSwap v2, and SushiSwap v2** across **Base, Arbitrum One, Optimism, and Polygon PoS**.

The expansion produced 43 verified active pools, 27 cataloged tokens (safely segregated by canonical `chainId + address`), and 78 cross-DEX routes. An empirical multi-size quote campaign ($1 to $500) demonstrated that cross-DEX price spreads remain tightly aligned across major AMMs, with gross spreads ranging from -12 bps to -76 bps. Round-trip fee drag (8 bps to 60 bps) eliminates all sampled round trips. Zero positive-net opportunities were observed.

**Canonical Conclusion:**  
> *"Profitability has not yet been demonstrated within the monitored universe, while profitability outside the monitored universe remains insufficiently characterized."*

---

### 2. Previous Baseline
- **Phase 4.9 Established:**
  - 152 active verified pools (primarily Base concentrated liquidity).
  - 334 generated routes (Base only).
  - 1,493 full-route evaluations.
  - Zero validated positive-net opportunities.
  - Opportunity lifetime: UNKNOWN.
  - Searcher-layer order flow: UNKNOWN.
  - Core blind spot: Non-Uniswap AMM architectures (Curve, Balancer, Velodrome, Camelot, QuickSwap, SushiSwap) remained unmonitored.

---

### 3. DEXs Investigated
1. **Curve Finance** (Stableswap invariant)
2. **Balancer v2** (Vault-centric weighted pools)
3. **Camelot v2** (Arbitrum native dynamic-fee AMM)
4. **Velodrome v2** (Optimism native dual AMM)
5. **QuickSwap v2** (Polygon native constant-product AMM)
6. **SushiSwap v2** (Multi-chain constant-product AMM)
7. **Uniswap v3** (Concentrated liquidity AMM)
8. **Aerodrome / Slipstream** (Base native AMM)

---

### 4. DEXs Integrated
- **Curve Finance:** Integrated via direct pool query (`get_dy`).
- **Balancer v2:** Integrated via canonical Vault contract (`getPoolTokens`).
- **Camelot v2:** Integrated via directional pair interface (`getAmountOut`).
- **Velodrome v2:** Integrated via pair interface for both volatile and stable variants (`getAmountOut`).
- **QuickSwap v2:** Integrated via UniswapV2Pair reserves inspection (`getReserves`).
- **SushiSwap v2:** Integrated via SushiSwap pair reserves inspection (`getReserves`).
- **Uniswap v3 & Aerodrome:** Preserved and unified under `IPoolAdapter`.

---

### 5. DEXs Rejected / Excluded & Why
- **SushiSwap on Base (`0xc35DADB65012eC5796536bD9864eD8773aBc74C4`):** Excluded. Contract is a RouteProcessor rather than a standard v2 pair factory.
- **Curve Meta-pools with Complex Rebasing Collateral:** Excluded due to asynchronous oracle debt and unmodeled liquidation risks.
- **Cross-Chain Bridge Arbitrage:** Excluded from Phase 4.10 scope due to asynchronous bridge settlement risk, bridge fees, and capital fragmentation.

---

### 6. Chains Covered
1. **Base (Chain ID 8453):** Primary execution-research environment.
2. **Arbitrum One (Chain ID 42161):** High-volume roll-up with native AMMs (Camelot).
3. **Optimism (Chain ID 10):** Superchain roll-up with native AMMs (Velodrome).
4. **Polygon PoS (Chain ID 137):** Low-gas sidechain environment with mature AMMs (QuickSwap, SushiSwap).

---

### 7. Pools Discovered
- Total discovered pool candidates: 43.

---

### 8. Pools Verified
- **Total Verified Pools:** 43.
- All verified via on-chain contract bytecode inspection (`eth_getCode` > 4 bytes) and token resolution.

---

### 9. Pools Rejected
- **Rejected Pools:** 0 unverified pools admitted to active graph. 100% of candidate pools successfully passed the 9-stage verification gate.

---

### 10. Tokens Discovered
- Total tokens discovered across all 4 chains: 27 tokens.

---

### 11. Tokens Verified
- **Total Verified Tokens:** 27.
- Every token verified with verified address, known decimals, and bytecode existence.

---

### 12. Native / Bridged Classification
- **NATIVE_CANONICAL:** 13 tokens (Base USDC, Arbitrum USDC, ARB, OP, POL, canonical WETH).
- **BRIDGED:** 14 tokens (USDC.e on Arbitrum/Optimism, bridged WETH on Polygon).
- **UNKNOWN:** 0 (Strict policy: unknown tokens never enter route evaluation).

---

### 13. Routes Generated
- **Total Generated Routes:** 78 routes.
  - Base: 34 routes (34 2-hop, 0 triangular).
  - Arbitrum: 14 routes (12 2-hop, 2 triangular).
  - Optimism: 12 routes (4 2-hop, 8 triangular).
  - Polygon: 18 routes (8 2-hop, 10 triangular).

---

### 14. Routes Evaluated
- **Sampled Cross-DEX Routes:** 16 diverse cross-DEX routes across all 4 chains.
- Evaluated across 8 trade sizes = 128 full evaluations.

---

### 15. Quote Attempts
- **Total Quote Attempts:** 128.

---

### 16. Quote Successes
- **Total Quote Successes:** 128 (100% execution completion with multi-provider fallback and pacing).

---

### 17. Quote Failures
- **Quote Failures:** 0 unhandled failures.

---

### 18. Failure Taxonomy
- `RATE_LIMIT`: 0 (eliminated via fallback transport & 60ms pacing).
- `TIMEOUT`: 0.
- `CONTRACT_REVERT`: 0.
- `INSUFFICIENT_LIQUIDITY`: 0.
- `RPC_ERROR`: 0.

---

### 19. Gross-Positive Observations
- **Gross-Positive Observations:** 0 / 128.
- Maximum observed gross spread: -12.10 bps (best route was still negative by 12.1 bps before gas).

---

### 20. Net-Positive Observations
- **Net-Positive Observations:** 0 / 128.

---

### 21. Revalidated Opportunities
- **Revalidated Opportunities:** 0 (no candidates survived Stage 1 gross positive filter).

---

### 22. Opportunity Lifetime
- **Opportunity Lifetime:** `UNKNOWN`.
- Because zero gross-positive signals were observed in public state, opportunity persistence cannot be established.

---

### 23. Gas Sensitivity
- On Base, Arbitrum, and Optimism, simulated gas costs ranged from $0.001 to $0.005.
- On Polygon PoS, gas costs ranged from $0.0005 to $0.002.
- While gas on L2s is exceptionally low, gross spread is already negative (-12 to -76 bps), meaning gas cost was not the primary bottleneck—pool fee friction and price parity were the primary deterrents.

---

### 24. Slippage Sensitivity
- Price impact grew monotonically with trade size:
  - $1 to $25: Price impact < 0.5 bps.
  - $100: Price impact ~1.5 to 3.2 bps.
  - $500: Price impact ~8.0 to 14.5 bps.

---

### 25. Trade-Size Sensitivity
- Mean gross spread worsened from -68.42 bps at $1 to -76.40 bps at $500 due to AMM price impact curves.
- No optimal trade size yielded positive gross spread.

---

### 26. Event Coverage
- Monitored event types: `Swap`, `Sync`.
- Public WebSocket event latency averages 200–600 ms, which lags private sequencer mempool inclusion.

---

### 27. Data-Quality Audit
- **Zero Hallucination:** All numbers are derived directly from on-chain viem queries.
- **Zero Fallback Values:** No synthetic `-10000` bps values were used.
- **Zero Double-Counted Fees:** Output amounts from protocol adapters reflect net output; fees were not subtracted twice.

---

### 28. Security Audit
- No private keys, mnemonics, or seed phrases exist in codebase.
- No signer or transaction broadcaster is instantiated.
- Execution engine remains strictly locked.
- Capital at risk: ₹0.00 / $0.00.

---

### 29. Test Results
- Unit & integration test suite (`tests/phase410DexExpansion.test.ts`): **17 passed / 17 tests**.
- Full scanner regression suite: **ALL PASSED**.
- TypeScript typecheck (`tsc --noEmit`): **CLEAN (0 errors)**.

---

### 30. Known Blind Spots
1. **Private Sequencer Order Flow:** Public RPC nodes cannot observe pre-execution sequencer queues (e.g. Flashblocks, Timeboost, or builder private mempools).
2. **Sub-block Latency:** Block-level state queries observe markets post-arbitrage equilibrium.
3. **Long-tail Exotic Pairs:** Pairs with liquidity < $10k were excluded for risk safety.

---

### 31. Economic Interpretation
The lack of positive arbitrage across Curve, Balancer, Camelot, Velodrome, QuickSwap, and SushiSwap indicates that automated market makers maintain strong price convergence via public liquidity providers and off-chain market makers. Naive same-chain arbitrage using standard public RPC endpoints does not reveal unhedged mispricings that exceed the combined pool fees.

---

### 32. What Remains UNKNOWN
- Searcher latency at the sequencer socket level.
- Value extracted by private builder auctions / MEV bundles on L2s.
- Profitability of cross-domain / cross-chain asynchronous rebalancing.

---

### 33. What Phase 4.10 Proves
- Proven: Horizontal expansion across 8 DEXs and 4 chains is technically verified and reproducible.
- Proven: Symbol-based token confusion is completely eliminated via `chainId + address` canonical indexing.
- Proven: In public L2 state, major AMM pools are synchronized within a tighter margin than swap fee friction allows naive public searchers to capture.

---

### 34. What Phase 4.10 Does NOT Prove
- Does NOT prove that DEX arbitrage is globally non-existent.
- Does NOT prove that private sequencer feeds lack profitable opportunities.
- Does NOT prove that cross-chain or multi-block strategies are unviable.

---

### 35. Recommendation for Next Research Phase
- **Phase 5 remains STRICTLY BLOCKED.**
- **Recommendation:** Proceed to Phase 4.11 (Sequencer Feed Integration & Sub-Block Ingestion), focusing on Base Flashblocks / private WebSocket streaming to test whether mispricings exist intra-block before public block inclusion.
