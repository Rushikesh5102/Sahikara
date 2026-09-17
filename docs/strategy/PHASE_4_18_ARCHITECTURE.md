# PHASE 4.18 — CONTINUOUS SHADOW DETECTION ARCHITECTURE

> **SYSTEM CLASSIFICATION**: Unified Continuous Read-Only Telemetry & Shadow Decision Engine  
> **TARGET NETWORK**: Base Mainnet (Chain ID 8453)  
> **EXECUTION PERMISSION**: NONE (100% Read-Only, Capital = ₹0.00 / $0.00)

---

## 1. Architectural Principles

1. **Screening vs. Settlement Segregation**: Local state math evaluates permutations in microseconds ($\approx 51\,\mu\text{s}$) to screen out unviable paths. Only candidates demonstrating positive net expected value after gas, pool fees, and risk buffers trigger on-chain RPC verification.
2. **Epistemic Provenance Integrity**: Every market scalar is tagged with its origin:
   - `[OBSERVED]`: Real-time orderbook snapshots and confirmed block headers.
   - `[QUOTED]`: Authoritative on-chain calls (QuoterV2, `getAmountOut`).
   - `[SIMULATED]`: Local multi-tick crossing calculations (`LocalPriceEngine`).
   - `[ESTIMATED]`: L1/L2 data fee and execution gas unit projections.
   - `[ASSUMPTION]`: Policy thresholds (risk buffer BPS, slippage limit, hurdle rate).
3. **Fail-Closed State Health Matrix**: If any pool enters an unverified state (`INCOMPLETE`, `RESYNC_REQUIRED`, `INVALID`, `UNKNOWN`, or `STALE`), candidate detection for routes traversing that pool is instantly blocked.
4. **Authoritative Discrepancy Gate**: QuoterV2 output is compared against local simulated output:
   $$\Delta_{\text{bps}} = \frac{|\text{out}_{\text{local}} - \text{out}_{\text{rpc}}|}{\text{out}_{\text{rpc}}} \times 10{,}000$$
   - `EXACT`: $\Delta = 0$
   - `SUB_BPS_DRIFT`: $\Delta_{\text{bps}} \le 1.0$
   - `LOW_DRIFT`: $1.0 < \Delta_{\text{bps}} \le 5.0$
   - `MATERIAL_DRIFT`: $\Delta_{\text{bps}} > 5.0$ (Triggers immediate forensic anomaly log).
5. **Sample Independence Enforcement**: Raw loop cycles are not statistical samples. State hashes ($\text{block} \oplus \text{sqrtPrice} \oplus \text{reserve}$) track unique underlying market conditions, reporting effective sample sizes and redundancy ratios.

---

## 2. Component Taxonomy & Responsibilities

### 2.1 CEX Ingestion Subsystem (`CexOrderBook`, `CexVwapCalculator`)
- Tracks Level-2 bid/ask depth across supported venues (Coinbase, Binance, Kraken).
- Preserves local monotonic timestamps, wall-clock ISO timestamps, and exchange sequence identifiers.
- Calculates VWAP for configurable trade notionals ($100 to $100,000) factoring in book depth.

### 2.2 Local DEX State Subsystem (`LocalPoolStateManager`, `LocalPriceEngine`)
- Reuses the hardened Phase 4.17 state engine without duplicating mathematical logic.
- Maintained Pool Models:
  - **Uniswap V3** (`0xd0b53D...`): `slot0`, `liquidity`, tick bitmap, initialized ticks, multi-tick crossing traversal via `quoteV3MultiTick`.
  - **Aerodrome V2** (`0xcDAC0d...`): `reserve0`, `reserve1`, token ordering, constant product math via `quoteV2`.
- Supported Pool Envelope: Validated pools only. Unvalidated architectures (Aerodrome Slipstream CL) remain disabled pursuant to DEC-015.

### 2.3 Candidate Detection & Economic Gate (`ContinuousShadowPipeline`)
- Generates candidate pairs across 8 standard notionals ($100, $500, $1k, $5k, $10k, $25k, $50k, $100k).
- Evaluates:
  $$\text{grossPnL} = \text{amountOut}_{\text{final}} - \text{amountIn}_{\text{initial}}$$
  $$\text{netExpectedPnL} = \text{grossPnL} - \text{gasCost}_{\text{usd}} - \text{cexFee}_{\text{usd}} - \text{riskBuffer}_{\text{usd}}$$
- If $\text{netExpectedPnL} < \text{minExpectedProfit}$, candidate lifecycle transitions to `REJECTED_ECONOMICS`. An RPC call is avoided, incrementing `rpcCallsAvoided`.

### 2.4 Authoritative On-Chain Verifier
- For surviving candidates, queries Base Mainnet contracts at candidate block height:
  - Uniswap V3: `QuoterV2.quoteExactInputSingle`
  - Aerodrome V2: `Pool.getAmountOut`
- Compares on-chain authoritative quote against local prediction.
- Updates candidate record with exact discrepancy, quote freshness (`FRESH_ONCHAIN_QUOTE`), and latency metrics.

### 2.5 Shadow Execution & Forensic Store
- Generates deterministic shadow outcome records marked strictly `SHADOW_ONLY`.
- Tracks opportunity lifetime status (`MEASURED` vs `UNKNOWN`).
- Answers the 12 canonical forensic questions in structured JSON persistence (`scanner/data/phase418_shadow_campaign_results.json`).

---

## 3. Strict Safety Boundary

```typescript
// Enforced in types, code, ESLint rules, and automated test suites:
wallets = 0;
signers = 0;
orders = 0;
transactions_broadcast = 0;
capital_deployed = 0; // ₹0.00
```
Every execution pathway is physically absent from the scanner engine.
