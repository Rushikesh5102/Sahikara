# PHASE 4.13A — PHASE 4.12 FORENSIC PATCH & RECONCILIATION AUDIT

> **STATUS**: FORENSIC AUDIT COMPLETE & RECONCILED  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY MAINTAINED)  
> **EXECUTION ENGINE**: LOCKED  
> **PHASE 5 GATE**: STRICTLY BLOCKED  
> **EVIDENCE STANDARD**: Deterministic On-Chain State Verification & Regression Proof

---

## 1. Executive Summary & Purpose

Prior to executing Phase 4.13A temporal and event-driven research, this forensic patch audit formally closes four evidentiary and epistemic gaps in the Phase 4.12 record:

1. **Reconciliation of All 39 Raw Signals**: Itemizes, categorizes, and accounts for all 39 raw positive candidates that emerged during the Phase 4.12 campaign.
2. **On-Chain Proof of Polygon V2 Decimal/Token-Order Incident**: Directly queries Polygon mainnet contract state (`token0`, `token1`, `decimals`, `getReserves`) to mathematically and empirically prove that astronomical spreads ($>10^{16}\text{ bps}$) were artifacts of numerical token sorting inversion, not real market dislocation.
3. **Formal Adapter Evidence Classification**: Closes the evidence wording gap by distinguishing DEX adapters with direct Phase 4.12 on-chain router cross-checks (`MATCH`) from those verified via analytical bytecode and forensic review (`IMPLEMENTATION_FORENSICS_PASS` / `INDEPENDENT_QUOTE_VALIDATION_OPEN`).
4. **Epistemic Wording Correction**: Replaces overbroad assertions with strictly bounded empirical phrasing, preserving the canonical integrity of the Project Brain.

---

## 2. Comprehensive Reconciliation of All 39 Raw Positive Signals

Across the 2,400 matrix evaluations in Phase 4.12, exactly 39 raw candidate records exhibited $\text{grossSpreadBps} > 0$. All 39 records were halted at the Positive Signal Gate and rejected prior to any simulation or execution consideration.

### Candidate Forensic Breakdown:

| Candidate Group | Count | Chain | Routes Involved | Trade Sizes | Raw Gross Spread | Net PnL | Rejection Gate | Rejection Reason |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **Arbitrum Micro-Spreads** | 2 | Arbitrum One | `univ3-arb-weth-usdc-500` $\to$ `camelot-v2-arb-weth-usdc`<br>`univ3-arb-weth-usdt-500` $\to$ `camelot-v2-arb-weth-usdt` | $\$1$ | $+1.65\text{ bps}$<br>$+8.68\text{ bps}$ | $-\$0.0145$<br>$-\$0.0138$ | **Stage 5 (Gas Calculation)** | **`GAS_DRAG` / `SPREAD_TOO_SMALL`**: Gross profit ($\Delta A \approx +\$0.00016$) is overwhelmed by Arbitrum execution gas ($\$0.0136$), resulting in negative net return. |
| **Polygon Inverted Reserves** | 37 | Polygon PoS | 10 cycles combining `univ3-polygon-weth-usdc` with `quick-v2-polygon-weth-usdc` and `sushi-v2-polygon-weth-usdc` | $\$1$ to $\$500$ | $+3.04 \times 10^{11}\text{ bps}$ to $+5.26 \times 10^{16}\text{ bps}$ | Spurious ($>\$10^6$) | **Stage 10 (Adapter Forensics & Identity Audit)** | **`TOKEN_IDENTITY_ERROR` / `DECIMAL_ERROR`**: Discovery script inverted token0/token1 assignments against on-chain pair order. |
| **Total Candidates** | **39** | — | — | — | — | — | — | **0 Revalidated / 0 Net-Positive** |

---

## 3. On-Chain Proof of the Polygon Token-Order / Decimal Incident

### 3.1 Empirical On-Chain State Retrieval
Direct RPC calls to Polygon PoS mainnet contracts (`https://polygon-bor-rpc.publicnode.com`) retrieved the following state:

#### Token Metadata:
- **USDC**: Address `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Decimals: `6` [FACT]
- **WETH**: Address `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | Decimals: `18` [FACT]

#### Numerical Address Ordering:
$$\text{USDC } (\texttt{0x3c49...}) < \text{WETH } (\texttt{0x7ceB...})$$

#### QuickSwap V2 Pair (`0x7bAF833f82BB1971f99A5a5d84bED1d5D0dEDD70`):
- Factory: `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` [FACT]
- `pair.token0()`: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (USDC, 6 decimals) [FACT]
- `pair.token1()`: `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` (WETH, 18 decimals) [FACT]
- `pair.getReserves()`:
  - $\text{reserve0} = 12,912,568,495$ ($12,912.57\text{ USDC}$)
  - $\text{reserve1} = 5,236,465,666,860,584,087$ ($5.236\text{ WETH}$)

#### SushiSwap V2 Pair (`0x27e2929315Ced73060bB7eCcb1D160B30c1Bc041`):
- Factory: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` [FACT]
- `pair.token0()`: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (USDC, 6 decimals) [FACT]
- `pair.token1()`: `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` (WETH, 18 decimals) [FACT]
- `pair.getReserves()`:
  - $\text{reserve0} = 76,304$ ($0.0763\text{ USDC}$)
  - $\text{reserve1} = 30,407,860,187,394$ ($0.0000304\text{ WETH}$)

### 3.2 Mechanism of the Spurious Spread
In the candidate pool generator, the iteration loop named the pair "WETH/USDC" and assigned `token0 = WETH` and `token1 = USDC` without querying `pair.token0()`.
1. The adapter mapped $\text{reserve0} = 12,912,568,495$ to WETH ($1.29 \times 10^{-8}\text{ WETH}$) and $\text{reserve1} = 5.236 \times 10^{18}$ to USDC ($5.236 \times 10^{12}\text{ USDC}$).
2. When swapping $0.00038\text{ WETH}$ for USDC, the input dramatically exceeded the inverted $\text{reserve0}$, forcing the constant-product curve to drain nearly the entire inverted $\text{reserve1}$.
3. The adapter returned $\approx 5.23 \times 10^{18}$ units as the output token balance.
4. The economic evaluator compared this 18-decimal output against a 6-decimal input reference ($1,000,000\text{ units}$ for $\$1$ USDC), yielding an artificial spread of $+5.26 \times 10^{16}\text{ bps}$.

### 3.3 Permanent Regression Protection
A dedicated unit and integration regression test has been permanently added in `scanner/tests/phase413aForensicPatch.test.ts`. This test:
- Directly models the inverted reserves to verify identical reproduction of the spurious spread.
- Proves that correct address-sorted binding yields nominal market output ($\approx \$0.95–\$0.99$ USDC).
- Enforces an automated quarantine rule (`ANOMALY_QUARANTINED`) for any candidate with $\text{grossSpreadBps} > 1,000\text{ bps}$.

---

## 4. Adapter Evidence Classification Standard

Phase 4.12 executed authoritative on-chain cross-checks against 4 representative protocol implementations. For the remaining 4 protocols, implementations were validated against canonical bytecode and unit tests, but live router cross-checks were not re-executed in the Phase 4.12 script.

To maintain radical honesty and strict epistemic integrity (Rule 5), the Project Brain classifies adapter evidence as follows:

| Protocol Adapter | Primary Mathematical Invariant | Direct On-Chain Router Cross-Check in Phase 4.12? | Empirical Diff | Formal Evidence Classification |
| :--- | :--- | :---: | :---: | :--- |
| **Uniswap v3** | Concentrated liquidity tick math | **YES** (`QuoterV2.quoteExactInputSingle`) | 0 wei (0.0000 bps) | **`MATCH`** |
| **QuickSwap v2** | Constant product ($x \cdot y = k$) | **YES** (`QuickSwapRouter.getAmountsOut`) | 0 wei (0.0000 bps) | **`MATCH`** |
| **Camelot v2** | Directional dynamic fees | **YES** (`CamelotPair.getAmountOut`) | 0 wei (0.0000 bps) | **`MATCH`** |
| **Velodrome v2** | Solidly v2 Stable ($x^3y + y^3x = k$) | **YES** (`VelodromePair.getAmountOut`) | 0 wei (0.0000 bps) | **`MATCH`** |
| **Aerodrome** | Solidly v2 Volatile & Stable | **NO** (Phase 4.11 verified on Velodrome twin) | N/A | **`IMPLEMENTATION_FORENSICS_PASS`** / **`INDEPENDENT_QUOTE_VALIDATION_OPEN`** |
| **Curve** | Stableswap bonding curve ($A \cdot n^n$) | **NO** (Phase 4.11 verified on Arbitrum 2pool) | N/A | **`IMPLEMENTATION_FORENSICS_PASS`** / **`INDEPENDENT_QUOTE_VALIDATION_OPEN`** |
| **Balancer v2** | Weighted geometric invariant | **NO** (Validated via Vault query specification) | N/A | **`IMPLEMENTATION_FORENSICS_PASS`** / **`INDEPENDENT_QUOTE_VALIDATION_OPEN`** |
| **SushiSwap v2** | Constant product ($x \cdot y = k$) | **NO** (Phase 4.11 verified on Polygon router) | N/A | **`IMPLEMENTATION_FORENSICS_PASS`** / **`INDEPENDENT_QUOTE_VALIDATION_OPEN`** |

Adapters marked **`INDEPENDENT_QUOTE_VALIDATION_OPEN`** remain valid for research modeling but are not asserted to possess bit-level verified proof in the Phase 4.12 dataset.

---

## 5. Epistemic Wording Corrections

All overbroad statements in Phase 4.12 documentation have been amended to reflect strict epistemic boundaries:

| Historical / Overbroad Draft Phrase | Corrected Epistemic Phrase | Rationale |
| :--- | :--- | :--- |
| *"Proves that the zero-opportunity observation established in Phase 4.11 is not an artifact of a restricted 43-pool sample."* | *"The expansion substantially reduces the possibility that the Phase 4.11 result was caused solely by the original 43-pool selection, but does not eliminate universe-selection uncertainty."* | Expansion from 43 to 137 pools increases confidence but cannot make global claims about the infinite combinatorial universe of all existing liquidity pools. |
| *"All 8 DEX adapters reproduce exact canonical router outputs with 0.0000 bps divergence."* | *"4 representative DEX protocols achieved exact 0.0000 bps matching; 4 protocols passed implementation forensics with expanded live quote validation open."* | Reflects the exact empirical scope of the executed cross-check scripts. |

---

## 6. Audit Verdict

- **Phase 4.12 Empirical Findings**: Reconfirmed as valid and robust. Zero net-positive arbitrage was observed within the evaluated universe.
- **Phase 5 Readiness**: **STRICTLY BLOCKED**.
- **Phase 4.13A Readiness**: **UNLOCKED FOR TEMPORAL AND ORDERING RESEARCH ONLY**.
