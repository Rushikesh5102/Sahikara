# MULTI_PAIR_RESEARCH.md — Configurable Token Pair Universe & Research Methodology

> **STATUS**: **ACTIVE SPECIFICATION (Phase 1E)**  
> **SCOPE**: Market Observation & Route Universe  
> **EPISTEMIC TAGS**: [FACT] = verified on-chain, [ASSUMPTION] = research hypothesis, [PROVISIONAL] = working configuration  

---

## 1. Objectives & Universe Design

In Phase 1D, observation was restricted solely to WETH/USDC on Base. Phase 1E expands the universe into a structured, configurable registry (`scanner/src/config/pairs.ts`) capable of dynamically scaling from single pairs to dozens of pairs across multiple Layer-2 environments without modifying engine logic.

### Core Principles:
1. **Never Assume Profitability by Popularity**: High social volume or high Uniswap TVL does not imply arbitrage profitability. Every candidate must be verified empirically.
2. **Deterministic Lifecycle States**:
   - `BASELINE_ACTIVE`: Proven, verified pair actively polled in core baseline.
   - `RESEARCH_CANDIDATE`: Verified contract address and decimals on-chain, candidate for spread discovery.
   - `UNVERIFIED`: Proposed token where contract address, decimals, or pool mappings have not been verified against block explorer or factory contracts. Never used in active quoting loops until verified.
3. **Verified Canonical Addresses**: Token addresses must never be fabricated. Each address is documented with its verified on-chain source.

---

## 2. Initial Base Research Universe

All addresses verified against BaseScan and official project deployments [FACT]:

| Pair | Base Token | Quote Token | Base Address | Quote Address | Status | Notes / Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WETH/USDC** | WETH | USDC | `0x4200000000000000000000000000000000000006` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `BASELINE_ACTIVE` | Canonical Base WETH & native Circle USDC (DEC-010). |
| **AERO/USDC** | AERO | USDC | `0x940181a94A35A4569E4529A3CDfB74e48FD98AE3` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `RESEARCH_CANDIDATE` | Aerodrome protocol governance token. High volume on Aerodrome & UniV3. |
| **DEGEN/WETH** | DEGEN | WETH | `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` | `0x4200000000000000000000000000000000000006` | `RESEARCH_CANDIDATE` | Base community token (18 decimals). Subject to high volatility and spreads. |
| **VIRTUAL/WETH** | VIRTUAL | WETH | `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b` | `0x4200000000000000000000000000000000000006` | `RESEARCH_CANDIDATE` | Virtual Protocol AI agent token on Base. Concentrated liquidity on UniV3/Aero. |

---

## 3. Pair Configuration Schema

Each research pair definition in `scanner/src/config/pairs.ts` specifies:

```typescript
export interface ResearchPair {
  id: string;                      // e.g. 'base-weth-usdc'
  chainId: number;                 // e.g. 8453
  baseToken: TokenDefinition;      // symbol, decimals, address, addressTier
  quoteToken: TokenDefinition;     // symbol, decimals, address, addressTier
  status: 'BASELINE_ACTIVE' | 'RESEARCH_CANDIDATE' | 'UNVERIFIED';
  enabled: boolean;                // Operator flag for scanning
  notes: string;                   // Audit notes and rationale
  sourceReference: string;         // Verified contract deployment source
}
```

---

## 4. Multi-Chain Preparation

The schema and engine natively support multi-chain pair registration:
- **Base** (`8453`): Active research deployment.
- **Arbitrum One** (`42161`): Prepared for cross-DEX latency and spread benchmarking.
- **Polygon PoS** (`137`): Prepared for low-fee multi-venue spread comparison.
- **Optimism** (`10`): Prepared for Superchain ecosystem comparative study.

> [!IMPORTANT]
> Cross-chain execution or bridge arbitrage is strictly out of scope. Each chain's observation loop operates independently in read-only mode.
