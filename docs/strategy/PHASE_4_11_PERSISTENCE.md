# PHASE 4.11 — OPPORTUNITY PERSISTENCE & BLOCK LIFETIME ANALYSIS

> **STATUS**: COMPLETED / STRICT FORENSIC STANDARD  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (EXECUTION LOCKED)  
> **GATE STATE**: PHASE 5 BLOCKED

---

## 1. Objective & Persistence Methodology

In EVM DEX arbitrage research, measuring whether an opportunity persists across consecutive blocks ($N, N+1, N+2, \dots$) is fundamental to distinguishing:
1. **Persistent Structural Inefficiencies**: Long-standing price dislocations between fragmented DEX pools (usually caused by illiquid or orphaned pairs).
2. **Transient Searcher Flow**: Transitory mispricings created by retail swaps that are immediately backrun and cleared within 12 seconds (or within a single block on L2 sequencers).
3. **Ghost / Stale Inefficiencies**: Spurious signals resulting from non-atomic cross-block drift or simulation state skew.

### Multi-Block Revalidation Protocol:
When a positive gross spread candidate ($\text{grossSpreadBps} > 0$) is detected at block $N$:
1. **Immediate Requote ($N+0$)**: Query live pool quoters with identical parameters at the discovery block to confirm simulation reproducibility.
2. **Next-Block Follow-Up ($N+1$)**: Await next confirmed block and query all legs using identical size to determine if the opportunity survived block production.
3. **Extended Persistence ($N+2$)**: Query at block $N+2$ to assess multi-block decay.
4. **Classification Taxonomy**:
   - `PERSISTENT`: Spread remains $> 0$ across blocks $N, N+1, N+2$.
   - `TRANSIENT`: Spread $> 0$ at block $N$, but collapses to $\le 0$ at block $N+1$.
   - `EXPIRED`: Opportunity dissipated before requote could execute.
   - `INVALIDATED`: Requote revealed adapter math error, decimal bug, or quoter divergence (false positive).
   - `UNKNOWN`: Default when zero positive gross candidates were observed, or when subsequent block state cannot be retrieved.

---

## 2. Epistemic Rule: No Manufactured Lifetimes

A critical scientific pitfall in high-frequency trading research is assigning an arbitrary numerical lifetime (e.g. "average opportunity lifetime = 1.2 seconds" or "half-life = 500ms") when **zero valid opportunities were observed**.

Under SAHIKARA Project Rules (Rule 5: Radical Honesty, Rule 11: Non-Hallucination):
> If zero positive gross candidates are observed during the measurement campaign, the opportunity lifetime is formally and strictly classified as:
> $$\text{Opportunity Lifetime} = \text{UNKNOWN}$$
> It is strictly forbidden to extrapolate or simulate a synthetic lifetime without empirical data.

---

## 3. Same-Block Consistency vs Cross-Block Drift

A major vulnerability in multi-hop route evaluation is **cross-block drift**:
- Leg 1 evaluated against Block $N_1$
- Leg 2 evaluated against Block $N_2$ (where $N_2 > N_1$)
- Apparent spread: $\text{Price}_{\text{leg1}}(N_1) \neq \text{Price}_{\text{leg2}}(N_2)$

In Phase 4.11, every evaluation batch queries the exact block number from the chain client immediately prior to quoting, ensuring that:
$$\Delta \text{Block} = |\text{Block}_{\text{leg1}} - \text{Block}_{\text{leg2}}| = 0$$
Any cross-block skew is detected, logged, and invalidated.

---

## 4. Empirical Persistence Findings in Phase 4.11

During the exhaustive evaluation of all 78 valid generated routes across 8 trade sizes ($1 to $500), totaling 624 route-size evaluations:

- **Total Evaluations**: 624
- **Positive Gross Candidates Observed ($\text{grossSpreadBps} > 0$)**: 0
- **Candidates Requiring Multi-Block Tracking**: 0
- **Classified as PERSISTENT**: 0
- **Classified as TRANSIENT**: 0
- **Classified as INVALIDATED**: 0
- **Classified as UNKNOWN**: ALL (Lifetimes of unobserved opportunities are strictly UNKNOWN)

### Scientific Interpretation:
In the measured 78-route universe across Base, Arbitrum One, Optimism, and Polygon PoS, modern EVM liquidity is tightly coupled. Arbitrage opportunities between major DEXes (Uniswap V3, Aerodrome, Camelot, Velodrome, QuickSwap, SushiSwap, Curve) do not sit unexecuted across block boundaries. Highly competitive searcher infrastructure and programmatic arbitrage bots continuously clear dislocations within the same block or sub-second sequencer queues.
