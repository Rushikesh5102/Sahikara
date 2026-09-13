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
- **`[PROVISIONAL]`** All pool addresses in `pools.ts` must be verified by querying the respective factory contracts on-chain.
- Truth-tier labels in `pools.ts` document the confidence level of each address.

### 6.4 Quote Accuracy
- **`[FACT]`** Uniswap v3 quotes via `QuoterV2.quoteExactInputSingle` are exact for the current block state — they account for tick depth, liquidity, and fee tier.
- **`[FACT]`** Aerodrome volatile quotes via `getAmountOut` are exact for the current reserve state.
- **`[ASSUMPTION]`** Aerodrome stable `getAmountOut` uses on-chain stableswap invariant math — accurate but gas-intensive to verify.
- **`[STUB]`** Aerodrome Slipstream not implemented — see [DEC-015].

### 6.5 Single-Direction Quotes
- Phase 1C produces buy-direction quotes only (token0 → token1).
- Sell-direction quote (token1 → token0, for full arbitrage cycle modeling) is recorded as `null` in storage.
- Full bi-directional cycle modeling is a Phase 2/3 concern.

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
