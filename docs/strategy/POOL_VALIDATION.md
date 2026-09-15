# SAHIKARA — Pool Validation & Verification Log (Base Mainnet)

> **TRUTH TIER**: [FACT] — All addresses, factories, bytecode sizes, and quoting interfaces documented here have been verified on-chain via Base Mainnet RPC (`chain_id: 8453`).
> **SECURITY DIRECTIVE**: Strictly read-only research. Zero private keys, zero wallet signing, zero transaction submission. Execution remains LOCKED.

---

## 1. Verified Protocol Infrastructure Deployments

| Protocol | Component | Contract Address | On-Chain Verification Details | Truth Tier |
|---|---|---|---|---|
| **Uniswap v3** | Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | Official Base deployment; bytecode verified | `[FACT]` |
| **Uniswap v3** | QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | Factory pointer matches `0x3312...`; 16,548 bytes | `[FACT]` |
| **Aerodrome** | Factory (v2) | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Volatile & stable pool factory; 7,034 bytes | `[FACT]` |
| **Aerodrome** | Router (v2) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `defaultFactory()` matches `0x420D...`; getAmountOut operational | `[FACT]` |
| **Aerodrome Slipstream** | CLFactory | `0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef` | Concentrated liquidity factory; 1,527 pools deployed | `[FACT]` |
| **Aerodrome Slipstream** | MixedQuoterV3 | `0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555` | Deployed contract; 16,452 bytes; selector `0x891e50c6` | `[FACT]` |
| **PancakeSwap v3** | Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` | Official Base deployment; 10,304 bytes | `[FACT]` |
| **PancakeSwap v3** | QuoterV2 | `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997` | Factory pointer matches `0x0BFb...`; 16,664 bytes | `[FACT]` |

---

## 2. PancakeSwap V3 Root Cause Analysis & Resolution

### Root Cause
In Phase 1E, PancakeSwap V3 quotes consistently returned `0x` (execution reverted without reason).
- **Inspection Finding**: The configured QuoterV2 address (`0x8553AA1615549A86882151784b329B017aA7c832`) was completely empty on Base Mainnet (0 bytecode bytes).
- **Resolution**: Queried PancakeSwap's official deployment registry on BaseScan and identified the canonical `QuoterV2` at `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`. Verified that its `factory()` method returns `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`.
- **Pool Verification**: Queried `Factory.getPool(WETH, USDC, 500)` which returned active pool `0xB775272E537cc670C65DC852908aD47015244EaF`.
- **Live Output Test**: Calling `quoteExactInputSingle` via eth_call on Base with 1 WETH returned `999,277,000` raw USDC units (~$999.28), proving functional quoting.

---

## 3. Aerodrome Slipstream Investigation & Resolution

### Background
In Phase 1C–1E, Aerodrome Slipstream was marked as a `NOT_READY` stub per DEC-015 to prevent unverified quote fabrication.

### On-Chain Investigation Findings
- **Factory**: Slipstream uses CLFactory `0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef`.
- **Quoter**: MixedQuoterV3 is deployed at `0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555`.
- **Interface & Quoting Signature**: Unlike Uniswap V3 (which passes `uint24 fee`), Slipstream's `quoteExactInputSingleV3` takes `int24 tickSpacing`:
  ```solidity
  struct QuoteExactInputSingleV3Params {
      address tokenIn;
      address tokenOut;
      uint256 amountIn;
      int24 tickSpacing;
      uint160 sqrtPriceLimitX96;
  }
  function quoteExactInputSingleV3(QuoteExactInputSingleV3Params memory params)
      external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate);
  ```
- **Active Pools Discovered**:
  - `WETH/USDC` (ts=50, 5 bps): `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A`
  - `cbBTC/WETH` (ts=10, 1 bps): `0x42d4a22CaD0F5a49681a5715cE994Af73A43B76b`
- **Live Test**: Calling with 1 WETH input returned `999,930,419` raw USDC units, confirming active, deep concentrated liquidity.

---

## 4. Verified Active Research Pool Registry

| Pool ID | Pair | Protocol | Fee Tier / Tick Spacing | Verified Pool Address | Status | Tier |
|---|---|---|---|---|---|---|
| `univ3-base-weth-usdc-500` | WETH/USDC | Uniswap v3 | 5 bps (500) | `0xd0b53D9277642d899DF5C87A3966A349A798F224` | Active | `[FACT]` |
| `univ3-base-usdc-usdbc-100` | USDC/USDbC | Uniswap v3 | 1 bps (100) | `0x06959273E9A65433De71F5A452D529544E07dDD0` | Active | `[FACT]` |
| `univ3-base-weth-cbbtc-500` | cbBTC/WETH | Uniswap v3 | 5 bps (500) | `0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1` | Active | `[FACT]` |
| `univ3-base-aero-usdc-3000` | AERO/USDC | Uniswap v3 | 30 bps (3000) | `0x2426DC0A657BD481ab48f86C1616431905901238` | Active | `[FACT]` |
| `univ3-base-degen-weth-3000` | DEGEN/WETH | Uniswap v3 | 30 bps (3000) | `0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA` | Active | `[FACT]` |
| `univ3-base-virtual-weth-3000` | VIRTUAL/WETH | Uniswap v3 | 30 bps (3000) | `0x1D4daB3f27C7F656b6323C1D6Ef713b48A8f72F1` | Active | `[FACT]` |
| `univ3-base-weth-wsteth-100` | wstETH/WETH | Uniswap v3 | 1 bps (100) | `0x20E068D76f9E90b90604500B84c7e19dCB923e7e` | Active | `[FACT]` |
| `aero-base-weth-usdc-volatile` | WETH/USDC | Aerodrome | 30 bps | `0xcDAC0d6c6C59727a65F871236188350531885C43` | Active | `[FACT]` |
| `aero-base-usdc-usdbc-stable` | USDC/USDbC | Aerodrome | 5 bps | `0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD` | Active | `[FACT]` |
| `aero-base-aero-usdc-volatile` | AERO/USDC | Aerodrome | 30 bps | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` | Active | `[FACT]` |
| `aero-base-degen-weth-volatile` | DEGEN/WETH | Aerodrome | 30 bps | `0x2C4909355b0C036840819484c3A882A95659aBf3` | Active | `[FACT]` |
| `aero-base-virtual-weth-volatile` | VIRTUAL/WETH | Aerodrome | 30 bps | `0x21594b992F68495dD28d605834b58889d0a727c7` | Active | `[FACT]` |
| `aero-base-cbbtc-weth-volatile` | cbBTC/WETH | Aerodrome | 30 bps | `0x2578365B3dfA7FfE60108e181EFb79FeDdec2319` | Active | `[FACT]` |
| `aero-slipstream-weth-usdc-50` | WETH/USDC | Aero Slipstream | 5 bps (ts=50) | `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A` | Active | `[FACT]` |
| `aero-slipstream-weth-cbbtc-10` | cbBTC/WETH | Aero Slipstream | 1 bps (ts=10) | `0x42d4a22CaD0F5a49681a5715cE994Af73A43B76b` | Active | `[FACT]` |
| `cakev3-base-weth-usdc-500` | WETH/USDC | PancakeSwap v3 | 5 bps (500) | `0xB775272E537cc670C65DC852908aD47015244EaF` | Active | `[FACT]` |

---

## 5. Rejected / Disabled Pools

1. **PancakeSwap V3 Old Address (`0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18`)**:
   - Status: `DISABLED`.
   - Reason: Succeeded by verified active 5 bps pool `0xB775272E537cc670C65DC852908aD47015244EaF`.
2. **Aerodrome Slipstream Provisional Stub (`0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59`)**:
   - Status: `DISABLED`.
   - Reason: Replaced by empirically verified CLFactory pool `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A`.
3. **Aerodrome Slipstream AERO/USDC (ts=100)**:
   - Status: `UNVERIFIED` (returned `0x0000000000000000000000000000000000000000` on CLFactory).
   - Action: Disabled from Slipstream quoting. AERO/USDC routes exclusively through UniV3 and Aerodrome Volatile.
