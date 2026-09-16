# Velodrome Finance Integration & Protocol Analysis

## 1. Protocol Overview
Velodrome is the primary native liquidity layer on Optimism (OP Mainnet), built on the Solidly ve(3,3) design. It supports two pool invariants:
1. **Volatile Pairs**: Standard Uniswap v2 constant-product $x \cdot y = k$ with default 30 bps fee.
2. **Stable Pairs**: Stableswap curve $x^3 y + y^3 x = k$ optimized for $1:1$ pegged assets with default 5 bps fee.

## 2. Supported Chains & Deployments
- **Chain**: Optimism (10)
- **Verified Deployments**:
  - Factory: `0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a` (8,718 bytes bytecode)
  - Router: `0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858` (48,960 bytes bytecode)
  - Verified Active Pools:
    - WETH/USDC (volatile): `0xF4F2657AE744354bAcA871E56775e5083F7276Ab`
    - USDC/USDC.e (stable): `0x36E3c209B373b861c185ecdBb8b2EbDD98587BDb`
    - WETH/OP (volatile): `0xd25711EdfBf747efCE181442Cc1D8F5F8fc8a0D3`
    - OP/USDC (volatile): `0x67F56Ac099F11aD5F65E2ec804f75F2cEa6ab8C5`

## 3. Quoting Methodology
- Quoting uses the pair contract's internal evaluation function:
  ```solidity
  function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
  ```
  This handles both the volatile and stable invariants without off-chain numerical divergence.
- **Fees**: 30 bps for volatile, 5 bps for stable. Fees are deducted internally by `getAmountOut`.

## 4. Relationship to Aerodrome
- Aerodrome Finance on Base is an official fork of Velodrome Finance. Both share identical contract ABIs and mathematical invariants, ensuring unified adapter semantics across Base and Optimism.
