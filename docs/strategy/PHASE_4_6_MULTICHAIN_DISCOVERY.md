# PHASE 4.6 — Multi-Market / Multi-Chain Discovery & Empirical Validation

> **STATUS**: **INFRASTRUCTURE & VALIDATION SUITE COMPLETE (PASS)**  
> **OPERATIONAL STATE**: **RESEARCH & OBSERVATION ONLY**  
> **EXECUTION ENGINE**: **PERMANENTLY LOCKED (₹0.00 / $0.00 Capital at Risk)**  
> **CANONICAL REFERENCE**: [`DECISIONS.md#DEC-026`](../../DECISIONS.md#DEC-026) | [`CHANGELOG.md#070---2026-09-16`](../../CHANGELOG.md#070---2026-09-16)

---

## 1. Executive Summary & Objective

Following the Phase 4.5.1 forensic audit, which rigorously established that Base Mainnet DEX markets operate in tight pricing equilibrium during normal block intervals (zero qualifying round-trip arbitrage opportunities observed across 432 valid executable quotes, with median gross spread at $-55.98\text{ bps}$), the Operator authorized **Phase 4.6: Multi-Market / Multi-Chain Discovery & Empirical Validation**.

The primary objective of Phase 4.6 is to determine whether the absence of qualifying round-trip arbitrage opportunities is unique to Base or whether it persists across the broader EVM ecosystem when expanding:
- **EVM Chains**: Base (8453), Optimism (10), Arbitrum One (42161), Polygon (137)
- **AMM Venues**: Uniswap v3 (canonical multi-chain deployment), Aerodrome (Volatile, Stable, Slipstream), PancakeSwap v3
- **Fee Tiers**: 1 bps, 5 bps, 30 bps, and volatile/stable curves
- **Token Pairs**: Native wrapped assets (WETH, WMATIC, OP, ARB), major liquid stables (native USDC, bridged USDC.e, USDT, DAI), and synthetic/liquid-staked wrappers (wstETH, cbBTC)
- **Trade Sizes**: Sweeps across 8 discrete trade sizes ($1, $5, $10, $25, $50, $100, $250, $500 USD)

---

## 2. Non-Negotiable Safety & Isolation Directives

1. **Capital at Risk**: Strictly ₹0.00 / $0.00. No wallet, no private key, no transaction signing, and no transaction broadcasting. All interactions with nodes are strictly read-only (`eth_call`, `eth_getCode`, `getLogs`, `getBlock`).
2. **Execution Lock**: The execution engine remains permanently LOCKED.
3. **Database Segregation**: All Phase 4.6 telemetry is directed to a separate, dedicated SQLite database (`data/observations_phase46.db`). The Phase 4.5/4.5.1 baseline database (`data/observations.db`) is never opened, read, or modified by Phase 4.6.
4. **On-Chain Verification Gate**: All contract and pool addresses on non-Base chains are classified with truth-tier `[PROVISIONAL]`. Prior to issuing quotes, the campaign runner executes `verifyPoolBytecode()` (`eth_getCode`). Any pool returning $<4\text{ bytes}$ of bytecode is safely logged and skipped, preventing phantom quotes or quoter reverts.
5. **Radical Honesty & Negative Findings**: If all chains return TIER 0 equilibrium (no profitable dislocation), this is treated as a valid, honest, and high-value empirical scientific discovery. Calculations and spreads are never artificially manipulated to fabricate profitability.

---

## 3. Multi-Chain EVM Target Matrix

| Chain | Chain ID | Architecture | L1 Calldata Fee Mechanism | Gas Asset | Gas Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Base** | `8453` | OP Stack Rollup | L1 Blob Fee via GasPriceOracle | ETH | `BaseGasModel` ($0.0020 L1 flat estimate) |
| **Optimism** | `10` | OP Stack Rollup | L1 Blob Fee via GasPriceOracle | ETH | `BaseGasModel` (reused OP Stack model) |
| **Arbitrum One** | `42161` | Nitro Rollup | Nitro Calldata Batch Posting | ETH | `ArbitrumGasModel` ($0.0030 L1 provisional flat fee) |
| **Polygon PoS** | `137` | EVM Sidechain | **None** (Independent sidechain) | MATIC | `PolygonGasModel` ($0.00 L1 fee, MATIC pricing) |

---

## 4. Architecture & Component Implementations

### 4.1 Type Extensions (`src/config/pools.ts`)
- `SupportedChain` union extended to: `'base' | 'polygon' | 'arbitrum' | 'optimism'`.
- `PoolDefinition` extended with `chainId?: number` to facilitate unambiguous chain-level routing while maintaining full backward-compatibility with mock pool definitions in existing test suites.
- `CHAIN_IDS` lookup table added:
  ```typescript
  export const CHAIN_IDS = {
    BASE: 8453,
    POLYGON: 137,
    ARBITRUM: 42161,
    OPTIMISM: 10,
  } as const;
  ```

### 4.2 Pool & Pair Registries (`src/config/pools-*.ts` & `src/config/pairs-*.ts`)
- **Isolation**: Production Base pools (`ALL_ACTIVE_POOLS`, `ALL_POOLS`) remain strictly Base-only (`chain: 'base', chainId: 8453`). Multi-chain pools are encapsulated in their respective registries:
  - `ALL_POLYGON_ACTIVE_POOLS` (`pools-polygon.ts`)
  - `ALL_ARBITRUM_ACTIVE_POOLS` (`pools-arbitrum.ts`)
  - `ALL_OPTIMISM_ACTIVE_POOLS` (`pools-optimism.ts`)
- **EIP-55 Checksum Auditing**: All token and pool addresses in all registries are strictly audited and verified to conform to EIP-55 mixed-case checksum rules, completely preventing client-side Viem address exceptions.

### 4.3 Chain-Specific Gas Models (`src/shadow/`)
1. **`PolygonGasModel`**:
   - Designed for Polygon's sidechain architecture.
   - Enforces `l1DataFeeUsd = 0.00` (no L1 rollup posting).
   - Multiplies total execution gas by `(baseFee + priorityFee)` and converts using operator-configured `maticPriceUsd` (default $0.80).
2. **`ArbitrumGasModel`**:
   - Accounts for Arbitrum Nitro gas mechanics.
   - Computes L2 execution cost via `gasUnits * (l2BaseFee + priorityFee) * ethPriceUsd`.
   - Incorporates a provisional flat L1 calldata fee of `$0.003 USD` (`[ESTIMATED]`), pending future on-chain precompile (`NodeInterface.gasEstimateL1Component`) calibration.
3. **`BaseGasModel`**:
   - Continues to serve Base (8453) and is reused for Optimism (10) due to identical OP Stack rollup calldata accounting.

### 4.4 On-Chain Pool Bytecode Verification Utility
The `verifyPoolBytecode(poolAddress, publicClient)` helper performs a read-only `eth_getCode` call:
```typescript
export async function verifyPoolBytecode(
  poolAddress: `0x${string}`,
  publicClient: any,
): Promise<boolean> {
  try {
    const bytecode: string = await publicClient.getBytecode({ address: poolAddress }) ?? '0x';
    const stripped = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    return stripped.length >= 8; // >= 4 bytes = >= 8 hex chars
  } catch {
    return false;
  }
}
```
If a pool address has not been deployed on that specific chain or returns empty bytecode, the campaign runner logs a descriptive warning and safely bypasses the pool, protecting the quoting pipeline from RPC errors.

### 4.5 Sequential Campaign Runner (`scripts/run-phase4-6-campaign.ts`)
The campaign runner executes sequential observation campaigns per chain:
1. `PHASE_4_6_BASE` (regression and cross-chain baseline)
2. `PHASE_4_6_OPTIMISM`
3. `PHASE_4_6_ARBITRUM`
4. `PHASE_4_6_POLYGON`

**Sequential Execution Rationale**: Running one chain at a time avoids RPC concurrency limits, keeps process memory bounded, isolates failures, and allows clean interruptibility.

---

## 5. Verification & Testing Evidence

All quality gates passed with zero warnings and zero failures:

1. **Unit & Integration Test Suite**:
   ```
   Test Files  17 passed (17)
        Tests  219 passed (219)
     Duration  2.49s
   ```
   Added `tests/phase46MultiChain.test.ts` (18 new tests), increasing test coverage from 201 to 219 tests.
2. **TypeScript Compilation**:
   ```
   node node_modules/typescript/bin/tsc --noEmit -> Exit Code 0 (Clean)
   ```
3. **ESLint Static Analysis**:
   ```
   node node_modules/eslint/bin/eslint.js src tests --ext .ts -> Exit Code 0 (0 errors, 0 warnings)
   ```
4. **Security Audit**:
   ```
   vitest run tests/security.test.ts -> 15/15 passed (55 files scanned, 0 banned patterns, 0 private keys, 0 signing logic)
   ```

---

## 6. Campaign Execution Protocol

To execute the live multi-chain observation campaign:

1. Ensure the desired RPC URLs are populated in `scanner/.env`:
   ```bash
   BASE_RPC_URL=https://...
   POLYGON_RPC_URL=https://...
   ARBITRUM_RPC_URL=https://...
   OPTIMISM_RPC_URL=https://...
   ```
2. Execute the multi-chain campaign:
   ```bash
   cd scanner
   npm run campaign:46
   ```
3. If an RPC endpoint for any chain is not provided, the campaign runner automatically skips that chain with an informative notice and proceeds to the next chain without terminating the campaign.
4. Output telemetry is written to `scanner/data/observations_phase46.db`, leaving all previous baselines intact.
