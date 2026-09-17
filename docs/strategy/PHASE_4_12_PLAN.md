# PHASE 4.12 — IMPLEMENTATION & RESEARCH PLAN
## Opportunity-Universe Expansion & Independent Validation

> **STATUS**: ACTIVE / EXECUTION LOCKED  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **GATE STATE**: PHASE 5 BLOCKED  
> **EVIDENCE STANDARD**: Deterministic On-Chain Discovery, Mainnet Bytecode Verification & Full-Matrix Evaluation

---

## 1. Executive Summary & Core Research Question

Phase 4.11 evaluated 100% of the 78 valid generated routes across 43 active pools on Base, Arbitrum One, Optimism, and Polygon PoS across 8 discrete trade sizes ($1 to $500). Out of 592 successful quotes, **0 positive gross spreads** were observed (upper bound: -0.67 bps).

Phase 4.12 is chartered to answer the central empirical question:
> **"Does the Phase 4.11 zero-opportunity result remain robust when the monitored market universe is systematically expanded beyond the baseline 43-pool high-volume universe?"**

---

## 2. Absolute Safety & Invariants

Under SAHIKARA Project Rules (Rules 1–18) and Risk Policy:
- **Capital at Risk**: STRICTLY ₹0.00 / $0.00.
- **Wallets & Keys**: Zero private keys, seed phrases, mnemonics, or signers.
- **Execution Engine**: Strictly **LOCKED**. No transaction dispatch, broadcast, or contract deployment.
- **Phase 5**: Strictly **BLOCKED**.

---

## 3. Systematic Prioritization & Discovery Architecture

Every discovered pool must traverse an explicit 5-stage provenance pipeline:
$$\text{DISCOVERED} \longrightarrow \text{VERIFIED} \longrightarrow \text{QUOTABLE} \longrightarrow \text{ROUTABLE} \longrightarrow \text{ECONOMICALLY EVALUATED}$$

### Research Tiers:
- `TIER_0`: Current verified baseline universe (43 pools).
- `TIER_1`: Major / high-liquidity pools ($TVL > \$5\text{M}$ / 24h vol $> \$1\text{M}$).
- `TIER_2`: Medium-liquidity pools with meaningful volume ($TVL \in [\$500\text{k}, \$5\text{M}]$).
- `TIER_3`: Controlled long-tail sample ($TVL \in [\$50\text{k}, \$500\text{k}]$).
- `TIER_4` / `REJECTED`: Dust / illiquid pairs ($TVL < \$50\text{k}$) or unsupported pool types.

---

## 4. Expansion Vectors

1. **Stablecoin-First Focus**:
   - USDC ↔ USDT, USDC ↔ DAI, USDC ↔ USDbC, USDC ↔ USDC.e, USDT ↔ DAI.
2. **Curve Expansion**:
   - Enumerate and verify Curve pools on Base, Arbitrum, Optimism, and Polygon.
   - Enforce `get_dy` support and exact coin index mapping. Unsupported pool types remain `UNSUPPORTED_POOL_TYPE`.
3. **Balancer V2 Expansion**:
   - Add verified Weighted pools where normalized weights and token scaling are confirmed on-chain. Gated strictly to `WEIGHTED` pools.
4. **V2 AMMs (Camelot, Velodrome, QuickSwap, SushiSwap)**:
   - Verify on-chain factory/pair bytecode, reserves, and dynamic/directional fees.
5. **Concentrated Liquidity (Uniswap V3, Aerodrome Slipstream)**:
   - Add active fee tiers ($100, 500, 3000, 10000$ bps) using native BigInt tick math.

---

## 5. Campaign Execution & Positive Signal Gate

### 8-Tier Trade Sizing:
$$\$1, \$5, \$10, \$25, \$50, \$100, \$250, \$500$$

### 10-Stage Positive Signal Gate:
$$\begin{aligned}
\text{Gross Spread} > 0 &\implies \text{Independent Quoter} \implies \text{Fee Verified} \implies \text{Gas Calculated} \\
&\implies \text{Slippage Checked} \implies \text{Risk Buffer Applied} \implies \text{Independent Requote} \\
&\implies \text{Repeated Observation } (N, N+1, N+2) \implies \text{Liquidity Verified} \\
&\implies \text{Adapter Mismatch Ruled Out} \implies \mathbf{REVALIDATED}
\end{aligned}$$

---

## 6. Deliverables & Documentation Matrix

11 strategy dossiers in `docs/strategy/`:
- `PHASE_4_12_PLAN.md`
- `PHASE_4_12_UNIVERSE_DISCOVERY.md`
- `PHASE_4_12_POOL_VERIFICATION.md`
- `PHASE_4_12_ROUTE_COVERAGE.md`
- `PHASE_4_12_ADAPTER_VALIDATION.md`
- `PHASE_4_12_QUOTE_CROSSCHECK.md`
- `PHASE_4_12_ECONOMIC_AUDIT.md`
- `PHASE_4_12_PERSISTENCE.md`
- `PHASE_4_12_FAILURE_TAXONOMY.md`
- `PHASE_4_12_RESULTS.md`
- `PHASE_4_12_FINAL_REPORT.md` (34 formal required sections)
