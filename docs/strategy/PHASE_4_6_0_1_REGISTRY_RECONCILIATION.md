# PHASE 4.6.0.1 — Canonical Pool Registry Reconciliation & Re-Verification Report

> **STATUS**: **RECONCILIATION COMPLETE & ON-CHAIN VERIFIED (100% PASS ON ACTIVE POOLS)**  
> **OPERATIONAL DIRECTIVE**: **CANONICAL REGISTRY UPGRADE (READ-ONLY ON-CHAIN TELEMETRY)**  
> **CAPITAL AT RISK**: **₹0.00 / $0.00 (EXECUTION PERMANENTLY LOCKED)**  
> **CANONICAL REFERENCE**: [`DECISIONS.md#DEC-028`](../../DECISIONS.md#DEC-028) | [`CHANGELOG.md#072---2026-09-16`](../../CHANGELOG.md#072---2026-09-16)

---

## 1. Executive Summary & Reconciliation Objectives

During the Phase 4.6.0 pre-campaign on-chain audit, four provisional pool definitions exhibited configuration discrepancies (such as bridged token address confusion, fee tier mismatches, or wrong pair mappings), and one pool exhibited inverted token ordering relative to EVM address sorting.

Phase 4.6.0.1 reconciles the multi-chain registries by:
1. Activating **strictly verified canonical pool replacements** discovered on-chain.
2. Preserving all **historical incorrect entries** as disabled with documented forensic audit notes (zero silent deletions).
3. Re-verifying every canonical replacement independently on-chain (bytecode, token0, token1, fee, tickSpacing, factory provenance, and active liquidity).
4. Executing bidirectional smoke quotes via QuoterV2 across all active pools.
5. Enforcing that all active pools are upgraded to `[FACT]`, while disabled historical entries remain `[PROVISIONAL]`.

### Reconciliation Summary Scorecard

| Metric Category | Checked | Active / Passed | Historical Disabled | Pass Rate (Active) | Truth-Tier |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Tokens (ERC20)** | 17 | 17 | 0 | 100% | `[FACT]` |
| **Uniswap v3 Factories** | 3 | 3 | 0 | 100% | `[FACT]` |
| **Uniswap v3 Quoters (QuoterV2)** | 3 | 3 | 0 | 100% | `[FACT]` |
| **Uniswap v3 Pools (Total)** | 19 | 15 | 4 | 100% (15/15) | `[FACT]` (active) / `[PROVISIONAL]` (disabled) |
| **Bidirectional Smoke Quotes** | 30 | 30 | 0 | 100% (30/30) | Valid Non-Zero Output |

---

## 2. Canonical Replacements & Historical Evidence Preservation

In accordance with Section 3 and Section 4 Directives, no evidence was deleted. The four mismatched pools were renamed with `-historical-disabled` suffixes, retained with `status: "disabled"`, and replaced by canonical active deployments:

### Reconciliation Mapping Table

| Chain | Pair & Tier | Old Pool Address (Disabled) | Old Observed Identity | Canonical Replacement (Active) | Status | Verification Source & Date |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Polygon** | WETH / USDC native 500 (0.05%) | `0x45dDa9cb7c25131DF268515131f647d726f50608` | WETH / USDC.e bridged (5 bps) | `0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9` | ✅ ACTIVE `[FACT]` | Polygon RPC `eth_call` / Factory (2026-09-16) |
| **Polygon** | WETH / USDC native 3000 (0.30%) | `0x167384319B41F7094e62f7506409Eb38079AbfF8` | WMATIC / WETH (30 bps) | `0x19C5505638383337D2972Ce68B493aD78E315147` | ✅ ACTIVE `[FACT]` | Polygon RPC `eth_call` / Factory (2026-09-16) |
| **Polygon** | WETH / USDT 500 (0.05%) | `0x4CcD010148379ea531D6C587CfDd60180196F9b1` | WETH / USDT (30 bps / 0.30%) | `0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4` | ✅ ACTIVE `[FACT]` | Polygon RPC `eth_call` / Factory (2026-09-16) |
| **Optimism** | WETH / USDC.e 3000 (0.30%) | `0x1C3140aB59d6cAf9fa7459C6f83D4B52ba881d36` | OP / USDC.e (30 bps) | `0xB589969D38CE76D3d7AA319De7133bC9755fD840` | ✅ ACTIVE `[FACT]` | Optimism RPC `eth_call` / Factory (2026-09-16) |
| **Optimism** | USDC / WETH 500 (0.05%) | `0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b` | Canonical address correct; token order inverted | `0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b` | ✅ ACTIVE `[FACT]` | Token order corrected: `token0: USDC`, `token1: WETH` |

---

## 3. Re-Verified On-Chain Pool State (Active Universe)

Every active pool was independently re-verified on-chain for exact contract bytecode, token addresses, fee tiers, tick spacing, factory provenance, and active liquidity:

| Chain | Pool ID | Pool Address | Token0 (On-Chain) | Token1 (On-Chain) | Fee | Tick Spacing | Factory Match | Current Liquidity | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| Polygon | `univ3-polygon-weth-usdc-500` | `0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | 5 bps | 10 | ✅ Yes | 40073582060047172 | ✅ PASS |
| Polygon | `univ3-polygon-weth-usdc-3000` | `0x19C5505638383337D2972Ce68B493aD78E315147` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | 30 bps | 60 | ✅ Yes | 1505333388256606 | ✅ PASS |
| Polygon | `univ3-polygon-wmatic-usdce-500` | `0xA374094527e1673A86dE625aa59517c5dE346d32` | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | 5 bps | 10 | ✅ Yes | 320136683918833283 | ✅ PASS |
| Polygon | `univ3-polygon-wmatic-weth-500` | `0x86f1d8390222A3691C28938eC7404A1661E618e0` | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | 5 bps | 10 | ✅ Yes | 34511719299530291584499 | ✅ PASS |
| Polygon | `univ3-polygon-weth-usdt-500` | `0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | 5 bps | 10 | ✅ Yes | 255300896637932832 | ✅ PASS |
| Arbitrum | `univ3-arbitrum-weth-usdc-500` | `0xC6962004f452bE9203591991D15f6b388e09E8D0` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 5 bps | 10 | ✅ Yes | 3343440664016239144 | ✅ PASS |
| Arbitrum | `univ3-arbitrum-weth-usdce-500` | `0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 5 bps | 10 | ✅ Yes | 26580800556771221 | ✅ PASS |
| Arbitrum | `univ3-arbitrum-weth-usdc-3000` | `0x17c14D2c404D167802b16C450d3c99F88F2c4F4d` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 30 bps | 60 | ✅ Yes | 11871533535443592 | ✅ PASS |
| Arbitrum | `univ3-arbitrum-wbtc-weth-500` | `0x2f5e87C9312fa29aed5c179E456625D79015299c` | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 5 bps | 10 | ✅ Yes | 270171158117890977 | ✅ PASS |
| Arbitrum | `univ3-arbitrum-weth-usdt-500` | `0x641C00A822e8b671738d32a431a4Fb6074E5c79d` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 5 bps | 10 | ✅ Yes | 315319984444470716 | ✅ PASS |
| Optimism | `univ3-optimism-weth-usdc-500` | `0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b` | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | `0x4200000000000000000000000000000000000006` | 5 bps | 10 | ✅ Yes | 10910285928981873 | ✅ PASS |
| Optimism | `univ3-optimism-weth-usdce-500` | `0x85149247691df622eaF1a8Bd0CaFd40BC45154a9` | `0x4200000000000000000000000000000000000006` | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | 5 bps | 10 | ✅ Yes | 1711601236993330 | ✅ PASS |
| Optimism | `univ3-optimism-weth-usdc-3000` | `0xB589969D38CE76D3d7AA319De7133bC9755fD840` | `0x4200000000000000000000000000000000000006` | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | 30 bps | 60 | ✅ Yes | 2019308444049489 | ✅ PASS |
| Optimism | `univ3-optimism-weth-usdt-500` | `0xc858A329Bf053BE78D6239C4A4343B8FbD21472b` | `0x4200000000000000000000000000000000000006` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` | 5 bps | 10 | ✅ Yes | 13836497639930643 | ✅ PASS |
| Optimism | `univ3-optimism-wsteth-weth-100` | `0x04F6C85A1B00F6D9B75f91FD23835974Cc07E65c` | `0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb` | `0x4200000000000000000000000000000000000006` | 1 bps | 1 | ✅ Yes | 624565879729950356381 | ✅ PASS |

### Historical Disabled Pools (Evidence Preserved)

| Chain | Pool ID | Pool Address | Observed Token0 | Observed Token1 | Observed Fee | Status | Historical Audit Note |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| Polygon | `univ3-polygon-weth-usdc-500-historical-disabled` | `0x45dDa9cb7c25131DF268515131f647d726f50608` | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | 5 bps | ⚠️ DISABLED | Mismatch: token0=false, token1=false, fee=true, factory=true, factoryPoolMatch=true |
| Polygon | `univ3-polygon-weth-usdc-3000-historical-disabled` | `0x167384319B41F7094e62f7506409Eb38079AbfF8` | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | 30 bps | ⚠️ DISABLED | Mismatch: token0=false, token1=false, fee=true, factory=true, factoryPoolMatch=true |
| Polygon | `univ3-polygon-weth-usdt-500-historical-disabled` | `0x4CcD010148379ea531D6C587CfDd60180196F9b1` | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | 30 bps | ⚠️ DISABLED | Mismatch: token0=true, token1=true, fee=false, factory=true, factoryPoolMatch=true |
| Optimism | `univ3-optimism-weth-usdc-3000-historical-disabled` | `0x1C3140aB59d6cAf9fa7459C6f83D4B52ba881d36` | `0x4200000000000000000000000000000000000042` | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | 30 bps | ⚠️ DISABLED | Mismatch: token0=false, token1=true, fee=true, factory=true, factoryPoolMatch=true |

---

## 4. Complete Bidirectional Smoke Quote Results (30/30 Succeeded)

One small read-only quote was executed in each direction across all 15 active pools via QuoterV2:

| Chain | Pool ID | Direction | Input Amount | Output Amount | Block Number | Latency | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| Polygon | `univ3-polygon-weth-usdc-500` | USDC → WETH | 1 USDC | 0.000416148960444131 WETH | 93898257 | 286 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-weth-usdc-500` | WETH → USDC | 0.001 WETH | 2.400579 USDC | 93898257 | 278 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-weth-usdc-3000` | USDC → WETH | 1 USDC | 0.000415758463955183 WETH | 93898257 | 276 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-weth-usdc-3000` | WETH → USDC | 0.001 WETH | 2.390722 USDC | 93898257 | 284 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-wmatic-usdce-500` | WMATIC → USDC.e | 0.001 WMATIC | 0.000094 USDC.e | 93898257 | 284 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-wmatic-usdce-500` | USDC.e → WMATIC | 1 USDC.e | 10.62347326914489854 WMATIC | 93898257 | 326 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-wmatic-weth-500` | WMATIC → WETH | 0.001 WMATIC | 0.000000039158696173 WETH | 93898257 | 277 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-wmatic-weth-500` | WETH → WMATIC | 0.001 WETH | 25.511462973729979865 WMATIC | 93898257 | 275 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-weth-usdt-500` | WETH → USDT | 0.001 WETH | 2.402375 USDT | 93898257 | 276 ms | ✅ SUCCESS |
| Polygon | `univ3-polygon-weth-usdt-500` | USDT → WETH | 1 USDT | 0.00041583842187025 WETH | 93898257 | 278 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdc-500` | WETH → USDC | 0.001 WETH | 2.4008 USDC | 505720405 | 237 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdc-500` | USDC → WETH | 1 USDC | 0.000416111304268568 WETH | 505720405 | 225 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdce-500` | WETH → USDC.e | 0.001 WETH | 2.400461 USDC.e | 505720405 | 230 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdce-500` | USDC.e → WETH | 1 USDC.e | 0.000416169075927107 WETH | 505720405 | 234 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdc-3000` | WETH → USDC.e | 0.001 WETH | 2.39062 USDC.e | 505720405 | 224 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdc-3000` | USDC.e → WETH | 1 USDC.e | 0.000415792992343169 WETH | 505720405 | 235 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-wbtc-weth-500` | WBTC → WETH | 0.0001 WBTC | 0.00315304710719516 WETH | 505720405 | 243 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-wbtc-weth-500` | WETH → WBTC | 0.001 WETH | 0.00003168 WBTC | 505720405 | 248 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdt-500` | WETH → USDT | 0.001 WETH | 2.4027 USDT | 505720405 | 226 ms | ✅ SUCCESS |
| Arbitrum | `univ3-arbitrum-weth-usdt-500` | USDT → WETH | 1 USDT | 0.00041578208637382 WETH | 505720405 | 229 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdc-500` | USDC → WETH | 1 USDC | 0.000416097533844344 WETH | 156976837 | 397 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdc-500` | WETH → USDC | 0.001 WETH | 2.400864 USDC | 156976837 | 406 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdce-500` | WETH → USDC.e | 0.001 WETH | 2.400802 USDC.e | 156976837 | 407 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdce-500` | USDC.e → WETH | 1 USDC.e | 0.000416094058891424 WETH | 156976837 | 406 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdc-3000` | WETH → USDC.e | 0.001 WETH | 2.39336 USDC.e | 156976837 | 412 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdc-3000` | USDC.e → WETH | 1 USDC.e | 0.000415305064328797 WETH | 156976837 | 397 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdt-500` | WETH → USDT | 0.001 WETH | 2.402725 USDT | 156976837 | 406 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-weth-usdt-500` | USDT → WETH | 1 USDT | 0.000415775814533593 WETH | 156976837 | 422 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-wsteth-weth-100` | wstETH → WETH | 0.001 wstETH | 0.00124366802678225 WETH | 156976837 | 412 ms | ✅ SUCCESS |
| Optimism | `univ3-optimism-wsteth-weth-100` | WETH → wstETH | 0.001 WETH | 0.00080390969949255 wstETH | 156976837 | 411 ms | ✅ SUCCESS |

---

## 5. Active Universe Summary By Chain

Following Phase 4.6.0.1 reconciliation, the multi-chain active pool universe consists of:
- **Base (8453)**: 17 active pools (100% `[FACT]`)
- **Polygon (137)**: 5 active pools (100% `[FACT]`) + 3 historical disabled entries
- **Arbitrum One (42161)**: 5 active pools (100% `[FACT]`) + 0 disabled entries
- **Optimism (10)**: 5 active pools (100% `[FACT]`) + 1 historical disabled entry

### Final Inventory Metrics:
- **Total Active Pools**: **32** (17 Base + 15 Non-Base)
- **Total Disabled Pools**: **4** (3 Polygon + 1 Optimism)
- **Total Provisional Pools**: **4** (strictly the 4 disabled historical pools; 0 active pools are provisional)

### Remaining Provisional Assumptions
- **Arbitrum L1 Calldata Fee**: The flat L1 calldata fee estimate in `ArbitrumGasModel.ts` ($0.003 USD) remains labeled `[PROVISIONAL]` pending empirical precompile calibration during the campaign.
- **MATIC USD Price**: The MATIC price parameter in `PolygonGasModel.ts` ($0.80 USD) remains operator-configurable.

---

## 6. Campaign Safety Gates & Invariants
- Capital at Risk: **₹0.00 / $0.00**
- Private Keys Handled: **0**
- Transactions Signed / Broadcast: **0**
- Execution Lock: **ACTIVE (STRICTLY LOCKED)**
- Baseline Database (`observations.db`): **UNTOUCHED**
- Dedicated Campaign Database: `observations_phase46.db`
