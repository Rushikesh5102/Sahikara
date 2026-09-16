# SushiSwap V2 Integration & Protocol Analysis

## 1. Protocol Overview
SushiSwap V2 is a multi-chain automated market maker utilizing the standard Uniswap V2 constant-product invariant ($x \cdot y = k$) with a uniform 30 basis points (0.30%) liquidity provider fee.

## 2. Supported Chains & Deployments
- **Verified Factory**: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4`
  - Arbitrum One: 22,530 bytes bytecode [FACT]
  - Polygon PoS: 22,530 bytes bytecode [FACT]
  - Optimism: 35,950 bytes bytecode [FACT]
- **Base Deployment Note**: On Base (8453), the address `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` is Sushi's RouteProcessor / BentoBox contract and does not expose `getPair(address, address)`. SushiSwap V2 on Base is explicitly documented as **EXCLUDED / UNSUPPORTED_FACTORY_INTERFACE**.

## 3. Verified Pairs
- **Arbitrum One**:
  - WETH/USDC.e: `0x905dfCD5649217c42684f23958568e533C711Aa3`
- **Polygon PoS**:
  - WMATIC/USDC.e: `0xcd353F79d9FADe311fC3119B841e1f456b54e858`
  - WETH/USDC.e: `0x34965ba0ac2451A34a0471F04CCa3F990b8dea27`

## 4. Quoting Methodology
- Reads reserves via `getReserves()` on the pair contract and computes exact output via standard constant-product formula with 30 bps fee.
- Fee accounting transparency: 30 bps fee drag recorded in metadata, zero double-subtraction.
