# RESEARCH_DATA_SOURCES.md — Canonical Research Citations & Data Registry

> **EVIDENCE STANDARD**: All architecture, risk parameters, protocol formulas, and economic assertions must be grounded in primary authoritative sources.  
> **RULE**: No random blogs or unverified social media posts are permitted as evidentiary basis for system design.

---

## 1. Primary Documentation Sources

### 1.1 Blockchain Network Documentation

| Chain | Primary Source Name | Official URL / Documentation Reference | Date Accessed | Evidence Established | Uncertainty / Caveats |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Polygon PoS** | Polygon Technology Docs | https://docs.polygon.technology/pos/ | 2026-09-12 | Bor/Heimdall architecture, EIP-1559 gas model, ~2s block time, checkpoint intervals. | Migration to zkEVM Validium architecture timeline. |
| **Base** | Base Developer Docs | https://docs.base.org/ | 2026-09-12 | OP Stack single-sequencer architecture, L2 execution + L1 data fee formula, FIFO ordering. | Decentralization timeline for fault proofs and multi-sequencer. |
| **Arbitrum One** | Arbitrum Nitro Docs | https://docs.arbitrum.io/ | 2026-09-12 | Nitro execution engine, 250ms sequencer sub-blocks, L1 blob data settlement, Time-Boost design. | Exact implementation date of Time-Boost priority auctions. |
| **Optimism** | OP Stack Documentation | https://docs.optimism.io/ | 2026-09-12 | Standard Superchain rollup specs, fee formulas, sequencer specs. | Interop layer (Superchain ERC-20) deployment schedule. |
| **BNB Chain** | BNB Chain Docs | https://docs.bnbchain.org/ | 2026-09-12 | PoSA validator consensus, gas price floors, block times. | MEV-boost integration details on BSC. |

---

### 1.2 DEX Protocol Documentation & Whitepapers

| Protocol | Documentation Reference | Whitepaper / Source Code | Date Accessed | Evidence Established |
| :--- | :--- | :--- | :---: | :--- |
| **Uniswap v3** | https://docs.uniswap.org/contracts/v3/overview | [Uniswap v3 Core Whitepaper (Adams et al.)](https://uniswap.org/whitepaper-v3.pdf) | 2026-09-12 | Concentrated liquidity tick math, $L = \Delta y / \Delta \sqrt{P}$, four fee tiers (1, 5, 30, 100 bps), `QuoterV2` interface. |
| **QuickSwap / Algebra** | https://docs.algebra.finance/ | [Algebra Protocol Technical Spec](https://algebra.finance/) | 2026-09-12 | Dynamic fee calculation, adaptive directional volatility curves, concentrated tick spacing on Polygon. |
| **Aerodrome Finance** | https://aerodrome.finance/docs | [Aerodrome ve(3,3) Architecture](https://github.com/aerodrome-finance) | 2026-09-12 | Volatile ($x \cdot y = k$) and Stable ($x^3y + y^3x = k$) pool formulas, Slipstream concentrated pools on Base. |
| **Curve Finance** | https://docs.curve.fi/ | [Curve StableSwap Whitepaper (Egorov, 2019)](https://curve.fi/files/stableswap-paper.pdf) | 2026-09-12 | StableSwap invariant $A \cdot n^n \sum x_i + D$, amplification coefficient $A$, low-slippage peg mechanics. |

---

### 1.3 Infrastructure & RPC Documentation

| Provider | Official Reference | Date Accessed | Evidence Established |
| :--- | :--- | :---: | :--- |
| **Alchemy** | https://docs.alchemy.com/reference/api-overview | 2026-09-12 | Compute Unit (CU) billing formulas, WebSocket `eth_subscribe` parameters, rate limit quotas. |
| **QuickNode** | https://www.quicknode.com/docs | 2026-09-12 | Endpoint latency benchmarks, Anycast global routing, credit consumption rates. |
| **Infura** | https://docs.infura.io/ | 2026-09-12 | Core JSON-RPC method specifications, daily request quotas, WebSocket reconnect behavior. |
| **FastLane (Polygon)** | https://fastlane-labs.gitbook.io/fastlane-docs/ | 2026-09-12 | Polygon-specific MEV auction relay, private transaction submission, validator tip sharing. |
| **Flashbots** | https://docs.flashbots.net/ | 2026-09-12 | MEV-Share, Flashbots Protect, private bundle submission architecture on EVM rollups. |

---

### 1.4 Regulatory & Statutory Sources (India)

| Authority | Document / Circular Reference | Date Accessed | Evidence Established |
| :--- | :--- | :---: | :--- |
| **Ministry of Finance (CBDT)** | Finance Act, 2022 (Sections 115BBH & 194S) | 2026-09-12 | Flat 30% tax on transfer of VDAs; zero deduction of expenses except cost of acquisition; prohibition on loss set-off; 1% TDS mandate. |
| **CBDT** | Circular No. 13 of 2022 (Guidelines on Section 194S) | 2026-09-12 | Clarifications on peer-to-peer VDA transfers, buyer withholding obligations, and Form 26QE requirements. |
| **FIU-IND** | Gazette Notification S.O. 1072(E) (March 7, 2023) | 2026-09-12 | Bringing VDA service providers, exchanges, and transfer agents under the Prevention of Money Laundering Act, 2002 (PMLA). |

---

## 2. Methodology for Adding Future Data Sources

When new empirical data or protocol specs are introduced in Phase 1 or later phases:
1. **Record the entry in this file** with exact URL, date accessed, and specific claims supported.
2. **Verify primary authenticity**: Confirm the URL is from the verified domain of the foundation, core developer team, or government gazette.
3. **Assess uncertainty**: Note if the protocol is upgrading (e.g. Uniswap v4 hook architecture, Polygon 2.0 ZK transition).
