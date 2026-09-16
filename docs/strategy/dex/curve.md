# Curve Finance Integration & Protocol Analysis

## 1. Protocol Overview
Curve Finance is an automated market maker optimized for low slippage between tightly pegged or correlated assets. It implements the stableswap invariant:
$$A \cdot n^n \sum x_i + D = A \cdot D \cdot n^n + \frac{D^{n+1}}{n^n \prod x_i}$$
where $A$ is the amplification parameter controlling the flatness of the bonding curve near the peg ($1:1$ ratio).

## 2. Supported Chains & Deployments
- **Ethereum L1 & L2s**: Deployed on Base (8453), Arbitrum One (42161), Optimism (10), and Polygon PoS (137).
- **Address Provider**: `0x0000000022D53366457F9d5E68Ec105046FC4383` (verified on Base, Arbitrum, Optimism, Polygon).
- **Canonical Pools Verified**:
  - Arbitrum 2pool (USDC/USDT): `0x7f90122BF0700F9E7e1F688fe926940E8839F353` (33,664 bytes bytecode)
  - Polygon Aave Pool (DAI/USDC.e/USDT): `0x445FE580eF8d70FF569aB36e80c647af338db351` (45,008 bytes bytecode)

## 3. Interface & Quoting Methodology
- Quoting uses the view function:
  ```solidity
  function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);
  // Or uint256 signature for CryptoSwap / newer pools:
  function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256);
  ```
- **Fee Mechanics**: Pool fee is nominally 4 bps (0.04%). Fee drag is calculated and deducted internally in `get_dy`. Output amounts reflect net post-fee amounts.
- **Zero Fee Double-Counting**: `CurveAdapter` records nominal fee metadata (`feeBps = 4`) for accounting transparency, but does NOT subtract fees a second time in economic round-trip calculations.

## 4. Limitations & Unsupported Pool Types
- **Meta-pools**: Excluded from active routing in Phase 4.10 due to underlying asset unwrapping latency and LP token pricing dependencies.
- **CryptoSwap (v2 Tricrypto)**: Dynamic fee curves based on internal oracle price updates can cause slight quote divergence if internal EMAs drift between quote and execution.
