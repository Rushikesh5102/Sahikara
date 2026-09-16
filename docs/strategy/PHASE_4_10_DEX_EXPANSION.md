# Phase 4.10: DEX Ecosystem Expansion Technical Architecture

## 1. Multi-DEX Architecture Overview
The SAHIKARA market observer interacts with heterogeneous AMM protocols via the standardized `IPoolAdapter` interface. In Phase 4.10, adapter coverage is expanded from concentrated liquidity (Uniswap v3, Aerodrome Slipstream, PancakeSwap v3) to encompass the full spectrum of constant-product, stableswap, and weighted vaults.

```
                  ┌───────────────────────────────┐
                  │    Market Observer Engine     │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
  [Concentrated]          [Constant Product]        [Stableswap & Vault]
  - Uniswap v3            - QuickSwap v2            - Curve Stableswap
  - Aerodrome Slipstream  - SushiSwap v2            - Balancer v2
  - PancakeSwap v3        - Velodrome v2            - Aerodrome Stable
                          - Camelot v2              - Velodrome Stable
```

## 2. Token Identity Architecture
A critical source of past evaluation bugs in DeFi arbitrage engines is symbol ambiguity.
In Phase 4.10, token identity is enforced canonically via `chainId + address.toLowerCase()`:

| Chain | Symbol | Address | Classification | Confidence | Provenance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Base | WETH | `0x4200000000000000000000000000000000000006` | NATIVE_CANONICAL | HIGH | OP Stack System WETH9 |
| Base | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | NATIVE_CANONICAL | HIGH | Circle Native Deployment |
| Base | USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | BRIDGED | HIGH | Base Official Bridge Escrow |
| Arbitrum | WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | NATIVE_CANONICAL | HIGH | Arbitrum Nitro WETH |
| Arbitrum | USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | NATIVE_CANONICAL | HIGH | Circle Native Deployment |
| Arbitrum | USDC.e | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | BRIDGED | HIGH | Arbitrum Bridge Escrow |
| Optimism | USDC | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | NATIVE_CANONICAL | HIGH | Circle Native Deployment |
| Optimism | USDC.e | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | BRIDGED | HIGH | Optimism Standard Bridge |
| Polygon | WMATIC | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | NATIVE_CANONICAL | HIGH | Polygon PoS Wrapped Gas Token |
| Polygon | USDC | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | NATIVE_CANONICAL | HIGH | Circle Native Deployment |
| Polygon | USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | BRIDGED | HIGH | Polygon PoS Bridge Escrow |

### Strict Valuation Independence
```typescript
interface TokenValuationContext {
  nativeGasTokenPriceUsd: number; // ETH ($2,600) on Base/Arb/OP; POL ($0.35) on Polygon
  baseTradeTokenPriceUsd: number; // $1.00 for USDC
  tokenPriceUsd: number;          // Asset valuation
}
```
Under no circumstances may gas token pricing leak into trade token valuation or cross-contaminate disparate assets sharing a ticker.

## 3. Verified Pool Quality Tiers
Pools admitted to the SAHIKARA market graph are categorized into explicit tiers:
- **`TIER_0`**: Verified bytecode $\ge 4$ bytes, reserves/liquidity $\ge \$10,000$, confirmed active quote.
- **`TIER_1`**: Verified bytecode, reserves $\$1,000$ to $\$10,000$.
- **`TIER_2`**: Verified bytecode, reserves $<\$1,000$ (exploratory).
- **`REJECTED`**: Empty bytecode, unresolvable tokens, or contract revert. Rejections are formally tracked and never silently discarded.
