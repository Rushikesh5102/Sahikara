# Camelot DEX Integration & Architecture Analysis

## 1. Protocol Overview
Camelot is an Arbitrum-native decentralized exchange built around a dual-AMM architecture:
1. **Camelot v2**: Custom constant-product AMM supporting dynamic directional fees per token and fee discounts.
2. **Camelot v3**: Concentrated liquidity based on the Algebra engine.

## 2. Supported Chains & Deployments
- **Chain**: Arbitrum One (42161)
- **Verified Deployments**:
  - Factory: `0x6EcCab422D763aC031210895C81787E87B43A652` (47,294 bytes bytecode)
  - Router: `0xc873fEcbd354f5A56E00E710B90EF4201db2448d` (29,480 bytes bytecode)
  - Primary Pair (WETH/USDC.e): `0x84652bb2539513BAf36e225c930Fdd8eaa63CE27`

## 3. Interface & Quoting Methodology
- **Dynamic Directional Quoting**:
  ```solidity
  function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
  ```
  Calling `getAmountOut` directly evaluates Camelot's directional fee structure, preventing inaccurate off-chain approximations.
- **Fee Structure**: Typically 30 bps base fee, but direction-dependent fees can vary between 10 bps and 50 bps depending on pair governance.

## 4. Limitations & Exclusions
- **Algebra-based V3 Quoting**: Concentrated liquidity quoting via Algebra requires custom TickTable traversal or AlgebraQuoter; Phase 4.10 integrates Camelot v2 pairs directly.
