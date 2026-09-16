# Balancer V2 Integration & Architecture Analysis

## 1. Protocol Overview
Balancer V2 is a generalized AMM architecture that consolidates all pool liquidity into a single canonical Vault contract. It supports arbitrary token weights ($n$-token pools with weights $w_i$) and custom pool types (Weighted, Composable Stable, Liquidity Bootstrapping Pools).

The weighted pool invariant is:
$$V = \prod_{i=1}^k B_i^{w_i}$$
where $B_i$ is the balance of token $i$ and $w_i$ is its normalized weight ($\sum w_i = 1$).

## 2. Supported Chains & Deployments
- **Canonical Vault Address**: `0xBA12222222228d8Ba445958a75a0704d566BF2C8`
  - Base: 49,026 bytes bytecode [FACT]
  - Arbitrum One: 49,026 bytes bytecode [FACT]
  - Optimism: 49,026 bytes bytecode [FACT]
  - Polygon PoS: 49,026 bytes bytecode [FACT]
- **WeightedPoolFactory (Arbitrum)**: `0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7` (7,896 bytes bytecode).

## 3. Interface & Quoting Methodology
- **Pool Identification**: Every Balancer pool is identified by a unique `bytes32 poolId` where the first 20 bytes correspond to the pool contract address.
- **Reserves Inspection**:
  ```solidity
  function getPoolTokens(bytes32 poolId) external view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock);
  ```
- **Quoting Algorithm**: For 50/50 weighted pools, output is evaluated via:
  $$\text{amountOut} = \frac{\text{balanceOut} \cdot \text{amountInWithFee}}{\text{balanceIn} + \text{amountInWithFee}}$$
  where $\text{amountInWithFee} = \text{amountIn} \cdot (1 - \text{feeBps}/10000)$.

## 4. Limitations & Exclusions
- **Composable Stable Pools**: Pools containing nested BPT (Balancer Pool Tokens) require recursive rate lookups and are excluded in Phase 4.10.
- **Gas Overhead**: Swaps interacting with the centralized Vault incur slightly higher gas overhead (~120,000–180,000 gas) than isolated pair contracts.
