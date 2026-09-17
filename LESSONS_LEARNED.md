# LESSONS_LEARNED.md — Failure Analysis & Institutional Memory

> **PURPOSE**: In quantitative trading and autonomous systems, failures, bugs, reverted transactions, and flawed models are the most valuable learning signals.  
> **RULE**: Never conceal or minimize an error. Every mistake, failed transaction, or security finding must be analyzed through a rigorous root-cause post-mortem and translated into a permanent preventive safeguard in the Project Brain.

---

## 1. Post-Mortem Incident Template

When documenting a failure, bug, reverted transaction, or mistaken assumption, use this format:

```markdown
### INC-XXX: [Descriptive Title of Incident / Discovery]
- **Date**: YYYY-MM-DD
- **Phase**: [e.g., Phase 2 / Phase 4 / Phase 6 / Phase 8]
- **Severity**: [CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL]
- **Impact**: [Capital lost (₹/USD), downtime duration, false positive count, test delay]

#### 1. Summary of What Happened
[Concise narrative describing the sequence of events, symptoms observed, and how the issue was discovered.]

#### 2. Root Cause Analysis (The 5 Whys)
1. *Why did X fail?* -> [Direct cause]
2. *Why did [Direct cause] happen?* -> [Secondary factor]
3. *Why did [Secondary factor] occur?* -> [Tertiary factor]
4. *Why did our tests / simulator miss this?* -> [Testing blindspot]
5. *Why did our operational policies allow this?* -> [Root systemic cause]

#### 3. Immediate Remediation Taken
- [Step 1 taken to halt damage or freeze system]
- [Step 2 taken to patch code or recover state]

#### 4. Permanent Corrective Actions & Brain Updates
- **Code Change**: [Link to commit or PR fixing the underlying logic]
- **Test Addition**: [Specific regression test added to tests/ to prevent recurrence]
- **Rule / Risk Policy Update**: [Reference to updated invariant in PROJECT_RULES.md or RISK_POLICY.md]

#### 5. Verification of Fix
- [Details of test run, fuzzing run, or simulation proving the fix is effective]
```

---

## 2. Institutional Lessons & Historical Entries

### INC-000: Project Inception Baseline — The Danger of Unstructured Development
- **Date**: 2026-09-12
- **Phase**: Phase 0 — Foundation
- **Severity**: INFORMATIONAL
- **Impact**: Zero capital loss; foundational engineering insight.

#### 1. Summary of What Happened
Prior to formally initializing SAHIKARA's Project Brain, review of common decentralized trading bot failures revealed that $>90\%$ of amateur MEV and arbitrage bots suffer capital loss due to:
- Mixing personal and bot wallets.
- Neglecting exact pool fee tier math.
- Forgetting that reverted transactions still burn full gas fees.
- Underestimating public mempool front-running (sandwich attacks).
- Relying on LLM agents to execute live trades probabilistically.

#### 2. Root Cause Analysis
The root cause of these systemic failures is jumping directly into code implementation without rigorous architectural constraints, deterministic execution boundaries, and air-gapped security protocols.

#### 3. Immediate Remediation Taken
Established the SAHIKARA Project Brain with 18 non-negotiable rules, strict phased gating, and a hard lock preventing live trading until Phase 8.

#### 4. Permanent Corrective Actions
Created `PROJECT_RULES.md`, `SECURITY.md`, and `RISK_POLICY.md` as mandatory, enforceable invariants.

---

### INC-001: Multi-Chain Quoter Address Resolution & Block-Scoped State Redundancy
- **Date**: 2026-09-16
- **Phase**: Phase 4.6.1 — Multi-Chain Empirical Observation
- **Severity**: LOW (Pre-execution observation issue; identified and corrected during adapter test execution)
- **Impact**: Zero capital loss (₹0.00 capital at risk, execution engine locked). Transient quote reverts on non-Base chains during initial multi-chain adapter test; redundant RPC calls slowed 9-size sweep latency.

#### 1. Summary of What Happened
During initial multi-chain quote sweeps, `UniswapV3Adapter.ts` routed non-Base QuoterV2 calls to the Base QuoterV2 address (`0x3d4e44Eb...`) because the adapter hardcoded the Base Quoter address constant from Phase 1. Concurrently, evaluating 9 trade sizes per event triggered 18 redundant RPC calls per route evaluation because `slot0` and `liquidity` were re-queried for each size.

#### 2. Root Cause Analysis (The 5 Whys)
1. *Why did non-Base quotes fail?* The Quoter contract reverted with empty error data on Polygon, Arbitrum, and Optimism.
2. *Why did it revert?* The Quoter contract invoked was the Base QuoterV2 address, which does not exist or has different bytecode on those networks.
3. *Why was Base quoter used?* `UniswapV3Adapter.ts` had a static address constant inherited from Phase 1 single-chain Base implementation.
4. *Why were sweeps slow?* Evaluating 9 trade sizes per route re-read `slot0` and `liquidity` 18 times on every event.
5. *Why was state re-read within the same block?* Stateless adapter design lacked a block-scoped state cache.

#### 3. Immediate Remediation Taken
- Implemented `_getQuoterAddress(pool)` in `UniswapV3Adapter.ts` dynamically returning `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` for Polygon, Arbitrum, and Optimism, and `0x3d4e44Eb...` for Base.
- Implemented `poolStateCache` in `UniswapV3Adapter.ts` keyed by `${poolAddress}:${blockNumber}`. Because blockchain state at an integer block height is strictly immutable, reusing state within the same block eliminated ~67% of redundant RPC calls without data fabrication.

#### 4. Permanent Corrective Actions & Brain Updates
- **Code Change**: Updated `UniswapV3Adapter.ts` with dynamic quoter mapping and block-level cache.
- **Test Addition**: Verified in `tests/phase46MultiChain.test.ts` across all 4 chain configurations.
- **Rule / Risk Policy Update**: Any multi-chain adapter must resolve contract dependencies dynamically based on chain ID and pool provenance.

#### 5. Verification of Fix
- Successfully executed 1,548 quote attempts across Base, Polygon, Arbitrum One, and Optimism with 100% valid quotes on non-Base chains (Polygon 270/270, Arbitrum 252/252, Optimism 270/270). 226/226 tests passing.

---

### INC-003: Dual-Use `ethPriceUsd` Field — WETH Price Conflated with Gas Token Price (D-001)
- **Date**: 2026-09-16 (discovered by forensic audit; introduced during Phase 4.6.1 implementation)
- **Phase**: Phase 4.6.1
- **Severity**: CRITICAL
- **Impact**: All 270 Polygon observations economically invalid. Campaign-level false-negative on Polygon market efficiency.

#### 1. Summary
`policyConfig.ethPriceUsd = 0.80` was set for Polygon to represent the MATIC gas token price.
However, `RealTimeShadowEngine.getTokenPriceUsd('WETH')` returns `this.policyConfig.ethPriceUsd`
for WETH tokens. This caused the shadow engine to compute trade sizes as if WETH = $0.80,
inflating all `initialAmount` values by 3,125× ($2500 / $0.80). Trades ranging from $1–$1000
nominal were sent to the QuoterV2 as 1.25–1,250 WETH ($3,125–$3,125,000 real value), exhausting
pool liquidity and producing grossSpreadBps values of -9000 to -9928 (artifacts, not market data).

#### 2. Root Cause Analysis (The 5 Whys)
1. *Why were Polygon spreads -9000 bps?* Trades were 3,125× larger than intended.
2. *Why were trades oversized?* `getTokenPriceUsd('WETH')` returned 0.80 instead of 2500.
3. *Why did it return 0.80?* `ethPriceUsd = 0.80` was set in `policyConfig`.
4. *Why was 0.80 set for Polygon?* Developer conflated the MATIC gas price with the WETH token price. The same field name `ethPriceUsd` is used for both the gas model (where MATIC = $0.80 is correct) and the token pricer (where WETH = $2500 is required).
5. *Why wasn't this caught before campaign execution?* No unit test verified that `initialAmount` was within a plausible range for each chain × token combination. Spread values were not sanity-checked against the theoretical fee floor (-35 bps) before writing the results JSON.

#### 3. Immediate Remediation Taken
- Fixed `ethPriceUsd: 2500.0` (constant) in `run-phase4-6-campaign.ts` (lines 391, 572).
- Polygon results from Phase 4.6.1 rejected. Re-run required.

#### 4. Permanent Corrective Actions
- **Naming Rule**: Rename `policyConfig.ethPriceUsd` to `policyConfig.wethPriceUsd` in the next refactor to eliminate the WETH/gas-token conflation trap.
- **Range Check**: Add a pre-campaign sanity gate: for each chain, compute `expectedInitialAmount` for the smallest trade size and assert it is within ±10× of the expected token quantity.
- **Spread Floor Gate**: After each chain campaign, assert `grossSpreadDist.max ≥ -(combinedFeeBps × 3)`. If the best observed spread is worse than 3× the fee floor, abort and alert.

#### 5. Verification of Fix
- D-001 correction applied 2026-09-16. Polygon re-run must confirm grossSpreadDist.max in range [-35, -45] bps.

---

### INC-004: BigInt→Number Conversion Overflow in sqrtPriceX96 (D-002)
- **Date**: 2026-09-16 (discovered by forensic audit)
- **Phase**: Phase 4.6.1 (present since Phase 4.5)
- **Severity**: HIGH
- **Impact**: `priceImpactBps` corrupted for all WETH/stablecoin pools. SLIPPAGE_TOO_HIGH gate unreliable.

#### 1. Summary
`Number(sqrtPriceX96)` was used to convert a `uint160` BigInt to a floating-point number for
price impact ratio computation. For WETH/stablecoin pools, sqrtPriceX96 ≈ 1.58×10^33. Since
`Number.MAX_SAFE_INTEGER = 9×10^15`, this conversion loses all precision, producing near-random
`sqrtRatio` values. The resulting `priceImpactBps` reached 2×10^12 bps (physically impossible;
bound is 10,000 bps). The `SLIPPAGE_TOO_HIGH` gate (threshold: 20 bps) was useless.

#### 2. Root Cause Analysis
1. *Why was priceImpactBps in the trillions?* Number(bigint) loses precision above 9×10^15.
2. *Why was Number() used?* Original code was written for Base wstETH/WETH pools (sqrtPriceX96 ≈ 10^27), where the overflow is less catastrophic. WETH/stablecoin pools have much larger values.
3. *Why wasn't this caught?* No assertion checked that priceImpactBps was in the valid range [0, 10000] before persisting it to the statistical report.

#### 3. Remediation Taken
- Replaced Number() arithmetic with BigInt-safe first-order approximation (D-002 fix, 2026-09-16).

#### 4. Permanent Corrective Actions
- **Code Rule**: Never use `Number(bigint)` for sqrtPriceX96 arithmetic. Always use BigInt-safe methods or convert via a known-precision intermediate (e.g., normalized to Q64 space before Number conversion).
- **Validation**: Add assertion `priceImpactBps >= 0 && priceImpactBps <= 10000` before storing. Log and discard out-of-range values as data corruption markers.

---

### INC-005: Tautological Reproducibility Self-Comparison (D-003)
- **Date**: 2026-09-16 (discovered by forensic audit)
- **Phase**: Phase 4.6.1
- **Severity**: MEDIUM
- **Impact**: False `reproducibilityPassed: true` attestation in Phase 4.6.1 results JSON.

#### 1. Summary
The reproducibility check in `run-phase4-6-campaign.ts` compared `rep1` and `rep2` where both
were assigned the same object property (`s.statisticalReport.grossSpreadDist.median`). This is a
tautology — `rep1 === rep2` is always true. The check provided zero data integrity assurance.

#### 2. Root Cause
Copy-paste error: the developer wrote `const rep2 = ...median` intending to re-compute the
value independently, but duplicated the same assignment as `rep1`. No second computation was
actually performed.

#### 3. Remediation Taken
Replaced with DB-driven recomputation (D-003 fix, 2026-09-16).

#### 4. Permanent Corrective Actions
- **Pattern**: All reproducibility / idempotency checks must use truly independent input sources (e.g., in-memory vs DB, run 1 vs run 2). Never re-read the same object property twice and call it "reproducibility."
- **Review Rule**: Any PR containing `rep1 = X; rep2 = X` patterns must be flagged in code review.

---

### INC-006: Sub-Fee Spread Misinterpreted as Positive Arbitrage Dislocation
- **Date**: 2026-09-16 (discovered during Phase 4.6.1.1 signal forensics)
- **Phase**: Phase 4.6.1 / Phase 4.6.1.1
- **Severity**: HIGH (Interpretive / Analytical Defect)
- **Impact**: Apparent favorable round trips on Arbitrum (-19.96 bps) and Optimism (-8.46 bps) were mistakenly described as "+15 bps" and "+26.5 bps" dislocations, creating the illusion of near-profitable arbitrage.

#### 1. Summary
The previous report subtracted the combined pool fee drag (-34.985 bps for a 5 bps + 30 bps round trip) from the observed negative spread:
`-19.956 bps - (-34.985 bps) = +15.029 bps` (Arbitrum)
`-8.462 bps - (-34.985 bps) = +26.523 bps` (Optimism)
and interpreted this positive delta as an "inter-fee-tier dislocation." In reality, both trades produced strictly negative gross returns (-19.96 bps and -8.46 bps) and severe net losses (-40 bps to -370 bps).

#### 2. Root Cause
1. Conflating pool-to-pool spot price drift with executable arbitrage return.
2. Labeling an arithmetic subtraction from a nominal fee floor as a "positive dislocation signal."
3. Failing to verify that pool spot price differences must EXCEED combined pool fees plus price impact plus gas before any positive economic signal exists.

#### 3. Permanent Corrective Actions
- **Terminology Rule**: Never label a trade with negative gross return (`grossSpreadBps <= 0`) as a "positive signal" or "dislocation." Use strictly: "observed sub-fee cross-pool round-trip spread with negative net return."
- **Signal Invariant**: An opportunity is a candidate ONLY IF `grossSpreadBps > 0` AND `netExpectedProfitUsd > 0`. Sub-fee spreads are non-executable economic noise.

---

### INC-007: Clustered Trade-Size Sampling Mistaken for Independent Market Events
- **Date**: 2026-09-16 (discovered during Phase 4.6.1.1 sampling audit)
- **Phase**: Phase 4.6.1 / Phase 4.6.1.1
- **Severity**: MEDIUM
- **Impact**: 84 "candidate observations" on Arbitrum were reported as if they were 84 independent market events, inflating perceived signal frequency.

#### 1. Summary
When an on-chain event occurred, the engine evaluated 9 trade sizes ($1 to $1,000) for every affected route against the exact same block state. The 84 candidate observations were actually the same 2 routes evaluated across repeated block states (only 26 unique block-route pairs across 13 unique blocks).

#### 2. Root Cause
Reporting raw record count $N$ as sample size without accounting for same-block correlation and multi-size clustering.

#### 3. Permanent Corrective Actions
- **Reporting Requirement**: Always report both raw $N$ and effective independent sample size: unique (block, route) pairs and unique blocks.
- **Deduplication**: Clustered multi-size evaluations within the same block must be grouped as a single market observation event when assessing opportunity frequency.

---

### INC-008: Triangular Route Compounding Fee Drag & Depth Fragility
- **Date**: 2026-09-17
- **Phase**: Phase 4.7
- **Severity**: MEDIUM (Microstructural & Economic Insight)
- **Impact**: All 150 triangular cycles evaluated across Arbitrum, Optimism, and Polygon produced strictly negative gross and net returns.

#### 1. Summary
Triangular cycle discovery ($A \to B \to C \to A$) was implemented expecting cross-rate dislocations. In live execution, 3 consecutive hops accumulated fees: $\sum_{i=1}^3 f_i \ge 3$ bps (for ultra-low 1 bps pools) up to $90$ bps (for 30 bps pools). Moreover, intermediate tokens (e.g. ARB, OP, USDT) had shallow depth, causing price impact that immediately wiped out any micro-spread on trades $\ge \$5$.

#### 2. Root Cause
Cross-venue and cross-token triangular arbitrage requires price mispricings greater than $3\times$ single-hop fee floors plus triple-hop price impact. In modern high-liquidity EVM rollups, MEV searchers and CEX-DEX market makers maintain cross-rate equilibrium within $< 2$ bps.

#### 3. Permanent Corrective Actions
- **Feasibility Filter**: Triangular routes must apply a strict pre-quote fee floor check: $\text{ExpectedDislocation} > \sum f_i + \text{GasCost}_{\text{Bps}}$. If false, do not quote shallow pools.

---

### INC-009: Public RPC Rate Limiting and Event Log Filter Restrictions
- **Date**: 2026-09-17
- **Phase**: Phase 4.7
- **Severity**: LOW (Operational / Infrastructure)
- **Impact**: Base public RPC throttled sequential factory calls with HTTP 429; Polygon Bor RPC rejected `getLogs` without an `address` parameter.

#### 1. Summary
Public free-tier RPCs impose strict rate limits and filter restrictions:
1. `mainnet.base.org` throttled batch factory queries during dynamic pool discovery.
2. `polygon-bor-rpc.publicnode.com` rejected `eth_getLogs` when called without an `address` parameter.

#### 2. Root Cause
Public RPC nodes protect against Denial-of-Service attacks by disallowing unindexed wildcard log queries and rate-limiting high-frequency sequential JSON-RPC calls.

#### 3. Permanent Corrective Actions
- **Address Filtering**: Always pass explicit pool address arrays in `eth_getLogs` parameters.
- **Graceful Fallbacks**: Wrap RPC discovery calls in retry/fallback handlers so that temporary throttling does not crash long-running multi-chain campaigns.
- **Infrastructure Requirement**: Future continuous monitoring requires dedicated private RPC nodes with higher burst allowances.

---

### INC-010: Rollup Mempool Invisibility & Sub-Block Latency Decay
- **Date**: 2026-09-17
- **Phase**: Phase 4.8
- **Severity**: HIGH (Architectural & Market Physics Finding)
- **Impact**: Confirmed that public-RPC discovery architecture is structurally blind to pre-inclusion transaction flow on Base, Arbitrum, and Optimism.

#### 1. Summary
Live testing during Phase 4.8 empirically verified that public RPC endpoints for modern rollups (Base, Arbitrum Nitro, Optimism OP Stack) reject `eth_newPendingTransactionFilter` with errors ("method does not exist / is not available" or RPC failure). User transactions do not circulate in a public p2p mempool. Furthermore, public RPC quote round trips take 550ms to 1,975ms, whereas L2 block times and searcher reaction times are $\le 250$ms.

#### 2. Root Cause
1. **Rollup Architecture**: Rollups employ centralized sequencers with direct private ingestion queues. Unsequenced transactions are never broadcast publicly before block commitment.
2. **Searcher Colocation**: Professional searchers utilize direct sequencer websocket feeds, local state simulation, and private builder relays (MEV-Share/Flashbots) operating at sub-10ms latencies. By the time a public RPC client observes a block event, any actionable mispricing has already been captured and balanced.

#### 3. Permanent Corrective Actions
- **Mempool Invariant**: Never assume pending transactions are observable on rollups via public RPC. Do not attempt mempool front-running or sandwiching.
- **Latency Labeling**: Public RPC quotes must always be labeled as post-inclusion settlement observations. Modeled decay profiles must never be described as empirical without timestamped re-quotes.
- **Phase 5 Guardrail**: Atomic arbitrage smart contracts cannot be deployed to mainnet based on public RPC discovery models.

---

### INC-011: Conflation of EVM Contract Quote Duration with Network RPC Latency
- **Date**: 2026-09-17
- **Phase**: Phase 4.9
- **Severity**: MEDIUM (Methodological & Measurement Correction)
- **Impact**: In Phase 4.8, compound multi-hop Quoter contract simulation durations (550–1,975ms) were erroneously labeled "Public RPC Latency", obscuring the true performance bottlenecks.

#### 1. Summary
During Phase 4.8, the duration recorded for multi-hop quote evaluations was described as "Public RPC latency". An independent benchmark in Phase 4.9 demonstrated that raw network round-trip latency is actually 270ms to 496ms, while EVM state machine tick simulation inside the node accounts for 540ms to 810ms per multi-hop route.

#### 2. Root Cause
In `evaluateRoundTrip()`, the timer measured the end-to-end HTTP request/response cycle for complex `quoteExactInputSingle()` calls. Because QuoterV2 must simulate binary searches across tick bitmaps and accumulate pool fees, the node's local CPU execution dominates the response time. Calling this "RPC latency" improperly attributed EVM execution time to network packet transit.

#### 3. Permanent Corrective Actions
- **Disaggregated Latency Reporting**: Strictly separate raw network RPC latency (`eth_blockNumber`, `eth_call`) from contract simulation latency and local CPU evaluation math.
- **ABI Parsing Strictness**: Ensure that all ABI signatures passed to viem's `parseAbiItem` use canonical Solidity types (e.g. `bool` instead of `boolean`) to prevent silent client-side validation errors.

---

### INC-012: Cross-Chain Token Identity, CREATE2 Verification & RPC Multi-Provider Fallback
- **Date**: 2026-09-17
- **Phase**: Phase 4.10
- **Severity**: HIGH (Architectural Safety & Reliability)
- **Impact**: Prevented token symbol collisions across native and bridged assets and eliminated public RPC rate-limiting during multi-DEX campaigns.

#### 1. Summary
During Phase 4.10 horizontal expansion across 4 chains and 8 DEX protocols:
1. Tokens sharing identical symbols (`USDC`, `WETH`, `USDT`) exhibited fundamentally different contract addresses, liquidity properties, and bridge risk across chains (e.g., native Circle USDC vs bridged USDC.e on Arbitrum One).
2. High-throughput sequential quoting across multi-size batches triggered HTTP 429 rate limits on public L2 endpoints.
3. Certain protocol deployments (such as Balancer v2 Vault) shared identical CREATE2 addresses (`0xBA12222222228d8Ba445958a75a0704d566BF2C8`) across all chains, whereas other protocols (Camelot, Velodrome, QuickSwap) were strictly chain-native. Furthermore, SushiSwap on Base was discovered to be a RouteProcessor rather than a standard v2 pair factory.

#### 2. Root Cause
1. **Token Symbol Conflation**: Treating token symbol as an identity key allows bridged tokens and native tokens to be accidentally paired in theoretical cycles, producing fictitious arbitrage opportunities.
2. **Public Endpoint Bursts**: Public JSON-RPC nodes enforce aggressive per-second request limits. Sequential multi-size sweeps without pacing rapidly exhaust burst budgets.
3. **Architectural Heterogeneity**: Assuming uniform factory ABIs across different DEX forks without inspecting bytecode or method signatures leads to runtime reverts.

#### 3. Permanent Corrective Actions
- **Token Identity Invariant**: All tokens must be uniquely keyed by `chainId + address`. Classification into `NATIVE_CANONICAL`, `BRIDGED`, `LEGACY`, or `UNKNOWN` is mandatory. Unknown tokens are strictly prohibited from route evaluation.
- **Valuation Isolation**: Maintain separate valuation fields (`nativeGasTokenPriceUsd`, `baseTradeTokenPriceUsd`, `tokenPriceUsd`) to prevent gas token valuation leaking into trade token economics.
- **Transport Pacing & Fallback**: Wrap all network clients in Viem `fallback()` transports with redundant public endpoints and enforce a minimum 60ms delay between consecutive route evaluations.
- **Pre-Flight Interface Verification**: Run automated on-chain verification (`eth_getCode` > 4 bytes and method call validation) before admitting any pool or DEX into the active route graph.

---

### INC-013: DEX Adapter Boundary Enforcement, Balancer Pool Typing & Route Universe Completeness
- **Date**: 2026-09-17
- **Phase**: Phase 4.11
- **Severity**: MEDIUM (Mathematical Precision & Route Completeness)
- **Impact**: Prevented invalid mathematical approximation of metastable/composable pools and verified that absence of positive arbitrage is invariant under 100% route coverage.

#### 1. Summary
During Phase 4.11 exhaustive route coverage and adapter forensics:
1. **Balancer Pool Typing**: Balancer V2 utilizes fundamentally distinct swap mathematics across Weighted pools ($x^{w_x} y^{w_y} = k$), Stable pools (stableswap invariant), and Composable/Boosted pools (internal BPT minting and linear rate scaling). Generic weighted pool math applied to metastable or composable pools produces invalid quotes.
2. **Exhaustive Route Execution**: Phase 4.10 evaluated only a 16-route sample. Full evaluation of all 78 routes required deterministic inventorying to guarantee zero route omissions.
3. **Protocol Quoter Cross-Checks**: Adapter quote calculations required direct empirical verification against live mainnet protocol contracts (routers and quoters) to ensure 0-wei mathematical fidelity.

#### 2. Root Cause
1. **Implicit Pool Type Generalization**: Assuming that all pools managed by an omnibus vault (such as Balancer V2 Vault) share identical pricing formulas risks silent calculation divergence.
2. **Representative Sampling Pitfalls**: In financial research, extrapolating from a subset of routes leaves open the question of whether unexamined routes harbor profitable anomalies.

#### 3. Permanent Corrective Actions
- **Explicit Adapter Pool Typing**: Adapters must strictly type pools (`WEIGHTED`, `STABLE`, `OTHER_SUPPORTED`, `UNSUPPORTED`) and revert or reject queries for unsupported variants rather than mathematically approximating them.
- **Exhaustive Matrix Execution**: Route discovery engines must construct explicit, deterministic inventories with unique identifiers (`routeId`, `venues`, `hops`, `status`), evaluating 100% of generated valid routes across discrete sizing curves.
- **Bit-Level Mainnet Cross-Checks**: Before conducting large-scale economic campaigns, each adapter must be cross-checked against canonical on-chain router/quoter functions under identical inputs and blocks with an explicit tolerance ($\le 0.5\text{ bps}$).

---

### INC-014: Discovered Pool Schema Integrity, IDataSource Return Contract & Batch Concurrency Optimization
- **Date**: 2026-09-17
- **Phase**: Phase 4.12
- **Severity**: MEDIUM (Execution Robustness & Pipeline Performance)
- **Impact**: Resolved interface contract alignment between custom public client wrappers and DEX adapters, verified canonical token decimal mapping, and accelerated 2,400-evaluation matrix runtime from ~25 minutes to ~4 minutes.

#### 1. Summary
During initial campaign orchestration for Phase 4.12 universe expansion:
1. **IDataSource Return Contract**: A custom lightweight client wrapper instantiated in the campaign runner returned raw contract call results instead of the required `{ data: T, latencyMs: number }` contract wrapper defined in `IDataSource.ts`. This caused adapters destructuring `quoteResult.data` to encounter `undefined` and throw quote errors.
2. **Discovered Pool Decimal Resolution**: Dynamically discovered pools from factory enumeration required canonical address-based decimal resolution (`getCanonicalToken`) rather than heuristic ticker-symbol regex matching.
3. **Sequential Execution Latency**: Evaluating 300 routes across 8 trade sizes (2,400 round-trips × ~2.3 RPC calls = ~5,500 contract reads) sequentially would require >20 minutes and risk public RPC transient timeouts.

#### 2. Root Cause
1. **Ad-Hoc Wrapper Drift**: Creating standalone inline wrappers for `IDataSource` without strict TypeScript generic type checking allowed structural contract divergence from canonical `RpcDataSource`.
2. **Symbol Heuristic Vulnerability**: Inferring token decimals from symbols (e.g. searching for `USD` or `BTC`) risks misclassifying unconventional stablecoin symbols or long-tail assets.
3. **Unbatched Public RPC Sweeps**: Evaluating large route combinatorics sequentially fails to leverage the independent rate-limit budgets of distinct network endpoints.

#### 3. Permanent Corrective Actions
- **Strict IDataSource Typing**: All contract read wrappers must strictly return `ContractCallResult<T>` with measured `latencyMs`.
- **Address-First Canonical Resolution**: Discovered pools must resolve token decimals and metadata via `getCanonicalToken(chainId, address)` before falling back to heuristics.
- **Batched Network Concurrency**: Execute multi-size route evaluations in bounded batches (e.g. 10 concurrent routes) with inter-batch pacing to optimize throughput while fully respecting public RPC rate limits.
- **On-Chain Token Address Sorting Verification**: Candidate pool generators must always verify `token0 < token1` against on-chain pair contracts rather than assuming token order matches iteration sequence. Unsorted token assignments invert reserve mappings, causing multi-order-of-magnitude false positives that must be filtered at Stage 10 of the Signal Gate.

---

### INC-015: Polygon V2 Token-Order Reserve Inversion, Adapter Evidence Categorization & Temporal Latency Decoupling
- **Date**: 2026-09-17
- **Phase**: Phase 4.13A
- **Severity**: HIGH (Methodological Precision & Signal Filtering)
- **Impact**: Independently reproduced and eliminated spurious $+10^{16}\text{ bps}$ spreads caused by numerical token sorting inversion, instituted regression tests, decoupled latency components, and established epistemic boundary between public and private mempools.

#### 1. Summary
During Phase 4.13A forensic audit and temporal research:
1. **Polygon Reserve Inversion Reproduction**: In QuickSwap V2 pool `0x6e7a5FAF...`, token0 (WMATIC, 18 decimals) and token1 (USDT, 6 decimals) were mapped in reverse order in an offline initialization script. Because string comparison sorted `'0xc213...'` before `'0x0d50...'` in a local loop, reserves were inverted. Quoting 1 WMATIC (nominal \$0.40) returned $2.9\times 10^{11}$ units interpreted as USDT, generating an economically absurd spread.
2. **Adapter Evidence Wording Gap**: Adapters lacking deployed independent quoter contracts on target chains (e.g. Aerodrome on Base, Curve, Balancer V2, SushiSwap V2) cannot claim bit-level mainnet quote matching until independent quoter cross-checks are executed.
3. **Latency Conflation**: Calling compound quote duration "RPC latency" obscures where time is actually spent between internet round-trip, local processing, and blockchain observation delay.

#### 2. Root Cause
1. **Local Address Sorting Inversion**: Uniswap V2 contracts sort token addresses as 160-bit hexadecimal integers (`uint160(token0) < uint160(token1)`). Lexicographical string sorting in TypeScript can diverge if addresses are not properly lowercased or padded. Moreover, querying `token0()` directly from the contract is the only deterministic truth.
2. **Overbroad Verification Claims**: Labeling code review and unit tests as "bit-level mainnet verified" conflates implementation forensics with empirical on-chain quote cross-checks.
3. **Monolithic Latency Metrics**: Single wall-clock timers fail to distinguish network transport from blockchain propagation and local compute.

#### 3. Permanent Corrective Actions
- **Direct On-Chain Pool Binding**: Never infer `token0` or `token1` from local iteration. Always query `token0()` and `token1()` directly from the pool contract and bind reserves strictly to those addresses.
- **Permanent Regression Test**: Added `tests/phase413aForensicPatch.test.ts` testing direct contract binding and ensuring $>1,000\text{ bps}$ signals are automatically quarantined (`ANOMALY_QUARANTINED`).
- **Adapter Evidence Classification**: Mark protocols with live on-chain cross-checks as `MATCH`; mark others as `IMPLEMENTATION_FORENSICS_PASS` / `INDEPENDENT_QUOTE_VALIDATION_OPEN`.
- **Latency Decoupling**: Isolate Network RPC Latency, Observation Latency, Quote Duration, and Local Evaluation Latency using monotonic `process.hrtime.bigint()` nanosecond timestamps.
- **Ordering Evidence Levels**: Strictly enforce evidence levels (LEVEL 0–5); never claim private order flow visibility from public settled state observations.

---

### INC-016: Cross-Domain Clock Conflation, In-Runner Simulation Offsets & Protocol Timestamp Quantization
- **Date**: 2026-09-17
- **Phase**: Phase 4.13A.1
- **Severity**: HIGH (Methodological Precision & Telemetry Integrity)
- **Impact**: Deconstructed the reported ~1.98s event observation latency claim, eliminated invalid cross-domain subtraction of `block.timestamp` from local time, established mathematical clock domain boundaries, and reclassified unmeasurable metrics.

#### 1. Summary
During Phase 4.13A forensic validation:
1. **In-Runner Simulation Offset**: In `run-phase4-13a-campaign.ts`, the block event simulator initialized `blockTimestampMs = Date.now() - 2000` to model 2-second block intervals. The timeline recorder then calculated `Date.now() - blockTimestampMs`, which mathematically guaranteed a result of $\approx 1,980\text{ ms}$ after subtracting the ~16–20ms execution overhead of local quote and route queries.
2. **Invalid Cross-Domain Subtraction**: Calculating `localWallClock - block.timestamp * 1000` conflated machine wall-clock time with consensus protocol timestamps. On Polygon PoS, this calculation yielded negative deltas (down to $-1,223\text{ ms}$), proving that machine NTP time and protocol block time are unaligned reference frames.
3. **Consensus Timestamp Quantization**: On OP Stack rollups (Base, Optimism), block timestamps are quantized to exact 2.0-second steps ($t_n = t_{n-1} + 2$), meaning `block.timestamp` represents a slot boundary, not the physical millisecond when the block was assembled or broadcast.
4. **Local NTP Dispersion**: An audit of the local host machine using Windows Time Diagnostic (`w32tm /query /status`) revealed an NTP Root Dispersion of $8.07\text{ seconds}$, making millisecond-level wall-clock comparisons scientifically invalid.

#### 2. Root Cause
1. **Conflation of Mock Offsets with Empirical Latency**: Using `Date.now() - 2000` as a synthetic placeholder in an empirical campaign runner without isolating the simulated value from measured telemetry caused the simulation constant to be reported as an empirical observation.
2. **Failure of Clock Domain Separation**: Treating protocol timestamps, local wall clocks, and monotonic timers as interchangeable scalar values on the same real-number time axis.
3. **Unverifiable Provider Emission Time**: Assuming public JSON-RPC nodes expose an authoritative event publication timestamp when they only return header `timestamp` and receive-time socket callbacks.

#### 3. Permanent Corrective Actions
- **Strict Clock Domain Governance (`ClockDomainManager.ts`)**: Tag every timestamp with its domain (`PROTOCOL_TIME`, `LOCAL_WALL_TIME`, `LOCAL_MONOTONIC_TIME`). Strictly prohibit cross-domain subtraction without an explicit, calibrated clock synchronization model.
- **Classification of Observation Latency**: Formally classify `EVENT_OBSERVATION_LATENCY` as `UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN`. Do not substitute `block.timestamp`.
- **Relabeling Clock Discrepancies**: Rename any calculation of `localWallClock - protocolTimestamp` to `TIMESTAMP_REFERENCE_DELTA` or `PROTOCOL_TO_LOCAL_CLOCK_OFFSET`; never label it network or provider latency.
- **Monotonic-Only Durations**: Require all elapsed duration measurements ($T_1 \to T_2$) to use monotonic timers (`performance.now()` or `process.hrtime.bigint()`). Never use `Date.now()` for latency calculations.
- **Deterministic Test Coverage**: Added `tests/phase413a1Forensics.test.ts` to assert that cross-domain subtractions throw exceptions and null values are preserved rather than replaced with zeroes or synthetic estimates.

---

### INC-017: Cross-Venue Market Discrepancies, Order Book Depth & Inventory Drag
- **Date**: 2026-09-17
- **Phase**: Phase 4.13B
- **Severity**: MEDIUM (Microstructure Reality & Strategy Modeling)
- **Impact**: Quantified the structural difference between atomic on-chain DEX arbitrage and non-atomic cross-venue CEX-DEX arbitrage, proved that gross dislocations (+0.35 bps) are overwhelmed by standard round-trip friction (~20 to 30 bps), and demonstrated that sequential transfer arbitrage is physically unexecutable due to confirmation delay.

#### 1. Summary
During Phase 4.13B empirical research and feasibility analysis:
1. **Gross Dislocation vs Net Friction Gap**: Real-world spot prices between centralized exchange order books (Binance, Coinbase, Kraken) and on-chain DEX quoter outputs (Base Uniswap V3) exhibited authentic gross price dislocations (up to $+0.35\text{ bps}$). However, because standard CEX taker fees are $10\text{ bps}$ and operational execution risk buffers require $10\text{ bps}$, the total friction hurdle ($\approx 20.04\text{ to }38.45\text{ bps}$) completely consumed the edge, yielding $0\text{ net-positive}$ opportunities (median net spread $-29.66\text{ bps}$).
2. **Model A Sequential Transfer Impossibility**: Attempting to move capital between venues post-signal is subject to exchange deposit confirmation rules (12 blocks on Base / $24\text{ s}$, 64 blocks on Arbitrum / $16\text{ s}$, 128 blocks on Polygon / $256\text{ s}$). During this latency window, market prices drift by hundreds of basis points, transforming theoretical arbitrage into unhedged speculative risk.
3. **Model B Capital Drag**: Maintaining pre-positioned dual inventory across USD and Crypto on both CEX and DEX requires committing $10\times$ the target trade size ($2.5\times$ safety buffer per bucket across 4 buckets). Capital utilization is capped at 10.0%, diluting per-trade return tenfold and incurring fixed rebalancing transfer costs.

#### 2. Root Cause
1. **Continuous Institutional Arbitrage**: Professional market makers and low-latency builder co-located searchers compress CEX-DEX spot price dislocations to within the marginal taker/pool fee band ($\approx 10–20\text{ bps}$).
2. **Lack of Cross-Venue Atomicity**: Smart contract atomic reverts cannot span off-chain central exchange matching engines. Each leg must be executed independently, introducing execution failure risk and withdrawal hold risk.
3. **Retail Fee Disadvantage**: Public unauthenticated accounts operate at standard 10 bps taker fee schedules, whereas institutional market makers receive maker fee rebates ($-1\text{ to }0\text{ bps}$), making public execution economically uncompetitive.

#### 3. Permanent Corrective Actions
- **Deterministic VWAP Requirement**: Never evaluate CEX pricing via top-of-book ticker alone; always calculate volume-weighted average price across actual order-book depth levels (`CexVwapCalculator.ts`).
- **Strict Non-Atomicity Tagging**: Label all cross-venue models as `NOT_ATOMIC`. Sequential transfers must be tagged as `LATENCY_IMPAIRED`.
- **Double Inventory Accounting**: Explicitly model capital commitment drag in `InventoryModel.ts`, calculating net yield on total committed balance rather than nominal per-trade return.
- **Decision Gate Governance**: Formally classify Phase 4.13B as `AUTHENTIC GROSS OPPORTUNITIES OBSERVED` and maintain Phase 5 strictly blocked.

---

### INC-018: Epistemological Boundaries Between Model Assumptions and Empirical Facts
- **Date**: 2026-09-17
- **Phase**: Phase 4.13B.1
- **Severity**: MEDIUM (Scientific Precision & Claim Governance)
- **Impact**: Audited mathematical recalculation of Phase 4.13B candidates, eliminated overbroad claims regarding zero false positives and universal unprofitability, segregated simulation parameters (10× inventory, 10 bps fee, 12 block confirmation) from empirical facts, and established strict labeling for hypothetical sensitivity results.

#### 1. Summary
During the Phase 4.13B.1 forensic audit:
1. **Conflating Assumptions with Empirical Facts**: The 10× inventory buffer in Model B was referred to in summary text as a requirement, when it was derived purely as an engineering simulation heuristic ($4 \times 2.5\times$ safety buffer).
2. **Conflating Block Confirmation with Settlement**: 12 Base blocks (~24s) was described as "transfer time," when real-world exchange crediting requires ingestion, reorg buffering, and compliance crediting, which cannot be observed without live accounts (`UNKNOWN / VARIABLE`).
3. **Overbroad False-Positive Claims**: Claiming "zero false positives" universally rather than bounding the statement to the evaluated candidate population.
4. **Causality Assertion Without Atomic Clocks**: Inferring "lead/lag price discovery" between CEX and DEX without sub-millisecond atomic clock synchronization.

#### 2. Root Cause
1. Semantic compression in summarizing complex multi-venue models into executive bullet points without preserving provenance tags.
2. Failure to explicitly classify simulation inputs (`[MODEL ASSUMPTION]`) versus on-chain outputs (`[OBSERVED]`).

#### 3. Permanent Corrective Actions
- **Explicit Provenance Tags**: Every parameter must carry an unambiguous tag (`[MODEL ASSUMPTION]`, `[OBSERVED]`, `[QUOTED]`, `[ESTIMATED]`, `[POLICY ASSUMPTION]`).
- **Bounded Validation Phrasing**: Use: *"No false positives were identified among the candidates that passed the implemented validation gates."* Never claim universal zero false positives.
- **Hypothetical Sensitivity Classification**: When evaluating hypothetical fee/risk reductions, candidates that become positive must be labeled strictly as **`HYPOTHETICAL_NET_POSITIVE`**, never `AUTHENTIC_NET_POSITIVE`.
- **Decouple Confirmation from Settlement**: Treat blockchain confirmation times separately from centralized exchange deposit crediting delays (`UNKNOWN / VARIABLE`).
- **Regression Test Coverage**: Added `tests/phase413b1Forensics.test.ts` (11 tests) to enforce these boundaries in CI.





