# QuickSwap Integration & Protocol Analysis

## 1. Protocol Overview
QuickSwap is the leading native AMM ecosystem on Polygon PoS. It features:
1. **QuickSwap v2**: Standard Uniswap v2 constant-product $x \cdot y = k$ pair architecture with a fixed 30 bps fee.
2. **QuickSwap v3**: Concentrated liquidity powered by the Algebra engine.

## 2. Supported Chains & Deployments
- **Chain**: Polygon PoS (137)
- **Verified Deployments**:
  - V2 Factory: `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` (27,720 bytes bytecode)
  - V2 Router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` (43,888 bytes bytecode)
  - V3 Factory (Algebra): `0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28` (26,456 bytes bytecode)
  - Verified Active Pairs:
    - WMATIC/USDC.e: `0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827`
    - WMATIC/USDC (native): `0x6D9e8dbB2779853db00418D4DcF96F3987CFC9D2`
    - WETH/USDC.e: `0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d`

## 3. Quoting Methodology
- Reads reserves directly from the pair contract:
  ```solidity
  function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
  ```
- Evaluates exact output with 30 bps fee:
  $$\text{amountInWithFee} = \text{amountIn} \cdot 9970$$
  $$\text{amountOut} = \frac{\text{amountInWithFee} \cdot \text{reserveOut}}{\text{reserveIn} \cdot 10000 + \text{amountInWithFee}}$$

## 4. Gas Accounting on Polygon
- Unlike Ethereum and rollup L2s (Base, Arbitrum, Optimism), Polygon PoS gas is paid in POL (formerly MATIC) at standard Geth Bor gas mechanics.
- In `roundTripEvaluator.ts`, gas token price is strictly separated (`nativeGasTokenPriceUsd = 0.35` for POL vs `$2,600` for ETH) to eliminate cross-chain valuation leakage [DEC-036].
