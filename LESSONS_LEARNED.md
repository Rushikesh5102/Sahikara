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

