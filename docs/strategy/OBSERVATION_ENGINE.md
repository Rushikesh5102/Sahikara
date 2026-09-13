# OBSERVATION_ENGINE.md — Phase 1C Market Observation Engine Architecture

> **DOCUMENT STATUS**: ACTIVE (PHASE 1C)  
> **IMPLEMENTATION STATUS**: COMPLETE (read-only observation; no execution capability)  
> **TRUTH-TIER LABELS**: `[FACT]`, `[ASSUMPTION]`, `[PROVISIONAL]`, `[ESTIMATE]`, `[DECISION]`

---

## 1. Purpose & Scope

The **Market Observation Engine** is the first functional code component of SAHIKARA. It is a strictly **read-only** system that collects on-chain market data from Base mainnet, produces executable quotes, calculates economics, stores observations, and generates research reports.

It is an **observation engine, not a trading bot**. It cannot and does not:
- Sign transactions
- Submit transactions
- Handle private keys
- Deploy contracts
- Approve tokens
- Execute swaps
- Hold or transfer capital

**Capital deployed: ₹0 / $0**

---

## 2. System Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Base Mainnet (Chain 8453)     │
                    │  Uniswap v3 Pools │ Aerodrome Pools  │
                    └────────────┬────────────────────────┘
                                 │ eth_call (read-only)
                    ┌────────────▼────────────────────────┐
                    │     IDataSource (Abstract Layer)     │
                    │   RpcDataSource (viem publicClient)  │
                    │   [Future: FlashblocksDataSource]    │
                    └────────────┬────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────┐
              │                  │                       │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌─────────▼────────┐
   │ UniswapV3Adapter│  │ AerodromeAdapter│  │  [Future Adapters]│
   │   [COMPLETE]    │  │ volatile: ✅    │  │                   │
   │                 │  │ stable:   ✅    │  │                   │
   │                 │  │ slipstream: 🔲  │  │                   │
   └──────────┬──────┘  └────────┬────────┘  └──────────────────┘
              │                  │
              └────────┬─────────┘
                       │ PoolObservation
          ┌────────────▼────────────────────┐
          │         Economics Engine         │
          │   gasEstimator + profitCalc      │
          │   3-tier profit model            │
          └────────────┬────────────────────┘
                       │ ProfitCalculation
              ┌────────┴────────┐
              │                 │
   ┌──────────▼──────┐  ┌───────▼───────┐
   │ ObservationStore│  │ Console Report │
   │ (SQLite/WAL)    │  │  (stdout)      │
   └─────────────────┘  └───────────────┘
```

---

## 3. Data Flow

For each observation cycle:

1. **Block fetch** — `getLatestBlock()` → block number + base fee
2. **Gas price** — `getGasPrice()` → dynamic base fee + priority fee
3. **For each pool × trade size:**
   a. Convert USD trade size → raw token amount (decimal-normalised)
   b. Adapter fetches pool state + produces executable quote via `eth_call`
   c. Economics engine calculates all 3 profit tiers
   d. Result stored in SQLite with status + rejection reason
   e. Formatted report printed to stdout
4. **Sleep** for configured interval

---

## 4. Profit Tiers (Three-Level Model)

Per spec requirement, the system distinguishes three tiers:

| Tier | Name | Description |
|---|---|---|
| 1 | `grossProfitUsd` | `executableOutput - inputCapital` — raw quote difference |
| 2 | `netProfitBeforeBufferUsd` | Tier 1 minus gas cost estimate |
| 3 | `netExpectedProfitUsd` | Tier 2 minus risk buffer — **the only candidate metric** |

Only `netExpectedProfitUsd > minNetProfitUsd` qualifies as `CANDIDATE`.

---

## 5. Rejection Reasons Taxonomy

Every observation is classified. Non-candidates always have an explicit reason:

| Reason | Meaning |
|---|---|
| `INSUFFICIENT_LIQUIDITY` | Pool reserve below minimum threshold |
| `SPREAD_TOO_SMALL` | Gross spread ≤ 0 bps, or net profit < min threshold |
| `FEES_EXCEED_SPREAD` | Pool fees consume the entire gross profit |
| `GAS_EXCEEDS_PROFIT` | Gas cost [ESTIMATE] ≥ gross profit |
| `STALE_DATA` | Observation timestamp > staleness threshold |
| `QUOTE_FAILED` | Adapter could not produce a quote |
| `RPC_ERROR` | RPC call failed |
| `PRICE_MOVED` | Price moved between fetch and use |
| `UNSUPPORTED_POOL` | No adapter supports this pool |
| `INVALID_TOKEN` | Token not in registry |
| `ADAPTER_STUB` | Adapter is explicitly marked as stub (e.g., Slipstream) |
| `OTHER` | Catch-all — always accompanied by `rejection_detail` |

---

## 6. Assumptions & Limitations

### 6.1 Token Prices
- **`[ASSUMPTION]`** Token USD prices (WETH, cbBTC, AERO) are configured via environment variables — NOT fetched from a live oracle.
- Stablecoins (USDC, USDbC, DAI) are assumed to be $1.00 [FACT — within normal peg].
- This is adequate for Phase 1C spread research but must be replaced with a live price feed in Phase 3+.

### 6.2 Gas Estimates
- **`[ESTIMATE]`** Gas unit counts per protocol are provisional starting estimates:
  - Uniswap v3: ~150,000 units [ASSUMPTION]
  - Aerodrome volatile: ~120,000 units [ASSUMPTION]
  - Aerodrome stable: ~130,000 units [ASSUMPTION]
- Actual gas varies with number of tick crossings (see `LIQUIDITY_RESEARCH.md §4`).
- Gas cost in USD requires ETH/USD price — configured via `ETH_PRICE_USD` env var [ASSUMPTION].

### 6.3 Pool Addresses
- **`[FACT]`** Active pool addresses in `pools.ts` have been verified on-chain via Factory contract calls (`Factory.getPool`).
- Uniswap v3 QuoterV2 canonical address verified: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`.
- Aerodrome PoolFactory verified: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`.
- Truth-tier labels in `pools.ts` document the verified status of each address.

### 6.4 Quote Accuracy
- **`[FACT]`** Uniswap v3 quotes via `QuoterV2.quoteExactInputSingle` are exact for the current block state — they account for tick depth, liquidity, and fee tier.
- **`[FACT]`** Aerodrome volatile quotes via `getAmountOut` are exact for the current reserve state. Pool fees are dynamically queried from `Factory.getFee(pool, stable)`.
- **`[FACT]`** Aerodrome stable `getAmountOut` uses on-chain stableswap invariant math — exact executable output.
- **`[STUB]`** Aerodrome Slipstream not implemented — see [DEC-015].

### 6.5 Directional Quotes & Cross-DEX Round Trips (Phase 1C.2 & 1C.2.1 Updates)
- **One-Way Quotes**: Labeled strictly as *one-way quotes* / *theoretical conversions*. Never labeled as arbitrage profit.
- **Cross-DEX Round Trips**: The engine implements full closed-loop evaluation for the primary research pair (WETH/USDC) across Uniswap v3 and Aerodrome volatile in both directions:
  - Route A: `WETH -> Uniswap v3 -> USDC -> Aerodrome -> WETH`
  - Route B: `WETH -> Aerodrome -> USDC -> Uniswap v3 -> WETH`
- **Fee Deductions**: Executable outputs returned by QuoterV2 and getAmountOut already incorporate swap fees. The engine does NOT subtract pool fees again when calculating net expected PnL.
- **Fee Metadata & Schema Migration**: Database table `round_trip_observations` safely migrated with `leg1_fee_bps`, `leg2_fee_bps`, `leg1_fee_amount`, and `leg2_fee_amount` via idempotent `ALTER TABLE` migrations. Historical rows preserved.
- **Block Synchronization**: Every quote cycle obtains the latest block number and timestamp directly from the live Base RPC context (verifying block ~51,270,xxx+).
- **Reconstructibility**: Every round-trip observation is stored in `round_trip_observations` with complete leg parameters, prices, fees, provisional gas estimates, and rejection reasons.

---

## 7. Flashblocks Interface (Future)

The `IDataSource` interface is designed to be Flashblocks-compatible. A future `FlashblocksDataSource` can be drop-in-replaced without modifying any adapter or economics code.

**`[FACT]`** Base Flashblocks streams 200ms pre-confirmation block state deltas via WebSocket. Integration is deferred per Phase 1C scope [DEC-010].

---

## 8. Security Invariants

Verified by automated tests in `tests/security.test.ts`:

- ✅ Zero `privateKey` identifiers in `scanner/src/`
- ✅ Zero `signTransaction` calls
- ✅ Zero `sendTransaction` calls  
- ✅ Zero `sendRawTransaction` calls
- ✅ Zero `createWalletClient` (viem signing client)
- ✅ Zero `viem/accounts` imports
- ✅ `.env.example` contains no real credentials
