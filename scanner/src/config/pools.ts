/**
 * SAHIKARA Observer — Candidate Pool Registry
 *
 * Phase 1F: Verified Multi-Pair & Low-Fee Pool Universe
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — Verified on-chain or from official documentation
 *   [ASSUMPTION] — Working premise subject to empirical validation
 *   [PROVISIONAL]— To be confirmed/replaced after empirical data collection
 *
 * References:
 *   - Base mainnet chain ID: 8453 [FACT]
 *   - Uniswap v3 on Base: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
 *   - Aerodrome: https://aerodrome.finance/liquidity
 *   - PancakeSwap v3: https://docs.pancakeswap.finance/developers/smart-contracts/pancakeswap-exchange/v3-contracts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenDefinition {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  /** Truth-tier for address accuracy */
  addressTier: '[FACT]' | '[ASSUMPTION]' | '[PROVISIONAL]';
}

/**
 * Base mainnet token addresses.
 * Sourced and verified on-chain via bytecode and symbol inspection.
 */
export const BASE_TOKENS: Record<string, TokenDefinition> = {
  WETH: {
    symbol: 'WETH',
    // [FACT] Canonical WETH9 address on Base (bytecode length: 4084 bytes)
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    addressTier: '[FACT]',
  },
  USDC: {
    symbol: 'USDC',
    // [FACT] Native USDC on Base (Circle bridged, bytecode length: 3706 bytes)
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDbC: {
    symbol: 'USDbC',
    // [FACT] Bridged USDC on Base
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    decimals: 6,
    addressTier: '[FACT]',
  },
  DAI: {
    symbol: 'DAI',
    // [FACT] DAI on Base
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    addressTier: '[FACT]',
  },
  cbBTC: {
    symbol: 'cbBTC',
    // [FACT] Coinbase Wrapped BTC on Base (bytecode length: 3102 bytes)
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    addressTier: '[FACT]',
  },
  wstETH: {
    symbol: 'wstETH',
    // [FACT] Lido Wrapped Staked ETH on Base (bytecode length: 6594 bytes)
    address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    decimals: 18,
    addressTier: '[FACT]',
  },
  AERO: {
    symbol: 'AERO',
    // [FACT] Aerodrome governance token on Base (bytecode length: 9474 bytes)
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    decimals: 18,
    addressTier: '[FACT]',
  },
  DEGEN: {
    symbol: 'DEGEN',
    // [FACT] Degen token on Base (bytecode length: 23218 bytes)
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    decimals: 18,
    addressTier: '[FACT]',
  },
  VIRTUAL: {
    symbol: 'VIRTUAL',
    // [FACT] Virtuals Protocol token on Base (bytecode length: 29700 bytes)
    address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    decimals: 18,
    addressTier: '[FACT]',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pool Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type DexProtocol =
  | 'uniswap-v3'
  | 'aerodrome-volatile'
  | 'aerodrome-stable'
  | 'aerodrome-slipstream'
  | 'pancakeswap-v3';
export type PoolStatus = 'active' | 'stub' | 'disabled';

export interface PoolDefinition {
  id: string;
  chain: 'base';
  dex: string;
  protocol: DexProtocol;
  poolAddress: `0x${string}`;
  token0: TokenDefinition;
  token1: TokenDefinition;
  /** Fee tier in basis points (e.g., 5 = 0.05%) */
  feeBps: number;
  /** Concentrated liquidity tick spacing (e.g., 1, 10, 50, 100) */
  tickSpacing?: number;
  /** Implementation status for the adapter */
  status: PoolStatus;
  /** Human-readable note about this pool */
  note: string;
  /** Truth tier for this pool's existence and parameters */
  tier: '[FACT]' | '[ASSUMPTION]' | '[PROVISIONAL]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v3 Pool Registry (Base)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniswap v3 deployment on Base.
 * [FACT] Factory: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
 * [FACT] QuoterV2: 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
 */
export const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as const;
export const UNISWAP_V3_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

export const UNISWAP_V3_POOLS: PoolDefinition[] = [
  {
    id: 'univ3-base-weth-usdc-500',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(WETH, USDC, 500)
    poolAddress: '0xd0b53D9277642d899DF5C87A3966A349A798F224',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 5,
    status: 'active',
    note: 'Primary WETH/USDC 5 bps pool on Base. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-weth-usdc-3000',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(WETH, USDC, 3000)
    poolAddress: '0x6c561B446416E1A00E8E93E221854d6eA4171372',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 30,
    status: 'active',
    note: 'Secondary WETH/USDC 30 bps pool on Uniswap v3. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-usdc-usdbc-100',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(USDC, USDbC, 100)
    poolAddress: '0x06959273E9A65433De71F5A452D529544E07dDD0',
    token0: BASE_TOKENS['USDC']!,
    token1: BASE_TOKENS['USDbC']!,
    feeBps: 1,
    status: 'active',
    note: 'Stablecoin pair: native USDC vs bridged USDbC (0.01%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-weth-cbbtc-500',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(cbBTC, WETH, 500)
    poolAddress: '0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['cbBTC']!,
    feeBps: 5,
    status: 'active',
    note: 'WETH/cbBTC: cross-chain BTC exposure pair on Base (0.05%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-aero-usdc-3000',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(AERO, USDC, 3000)
    poolAddress: '0x2426DC0A657BD481ab48f86C1616431905901238',
    token0: BASE_TOKENS['AERO']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 30,
    status: 'active',
    note: 'AERO/USDC 0.30% pool on Uniswap v3. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-degen-weth-3000',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(DEGEN, WETH, 3000)
    poolAddress: '0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA',
    token0: BASE_TOKENS['DEGEN']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'DEGEN/WETH 0.30% pool on Uniswap v3. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-virtual-weth-3000',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(VIRTUAL, WETH, 3000)
    poolAddress: '0x1D4daB3f27C7F656b6323C1D6Ef713b48A8f72F1',
    token0: BASE_TOKENS['VIRTUAL']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'VIRTUAL/WETH 0.30% pool on Uniswap v3. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-weth-wsteth-100',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(wstETH, WETH, 100)
    poolAddress: '0x20E068D76f9E90b90604500B84c7e19dCB923e7e',
    token0: BASE_TOKENS['wstETH']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 1,
    status: 'active',
    note: 'wstETH/WETH 0.01% pool on Uniswap v3. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Aerodrome Pool Registry (Base)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aerodrome Finance deployments on Base.
 * [FACT] Factory (volatile + stable): 0x420DD381b31aEf6683db6B902084cB0FFECe40Da
 * [FACT] Router: 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
 * [FACT] Slipstream CLFactory: 0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef
 * [FACT] Slipstream Quoter: 0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555
 */
export const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43' as const;
export const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' as const;
export const AERODROME_SLIPSTREAM_FACTORY = '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef' as const;
export const AERODROME_SLIPSTREAM_QUOTER = '0xCd2A7D98e82D6107eac1828ce8DeAA6acB65b555' as const;

export const AERODROME_POOLS: PoolDefinition[] = [
  {
    id: 'aero-base-weth-usdc-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(WETH, USDC, false)
    poolAddress: '0xcDAC0d6c6C59727a65F871236188350531885C43',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 30,
    status: 'active',
    note: 'Aerodrome WETH/USDC volatile pool (0.30%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-usdc-usdbc-stable',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-stable',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(USDC, USDbC, true)
    poolAddress: '0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD',
    token0: BASE_TOKENS['USDC']!,
    token1: BASE_TOKENS['USDbC']!,
    feeBps: 5,
    status: 'active',
    note: 'Aerodrome stablecoin pool: native USDC vs bridged USDbC (0.05%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-aero-usdc-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(AERO, USDC, false)
    poolAddress: '0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d',
    token0: BASE_TOKENS['AERO']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 30,
    status: 'active',
    note: 'Aerodrome AERO/USDC volatile pool (0.30%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-degen-weth-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(DEGEN, WETH, false)
    poolAddress: '0x2C4909355b0C036840819484c3A882A95659aBf3',
    token0: BASE_TOKENS['DEGEN']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'Aerodrome DEGEN/WETH volatile pool (0.30%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-virtual-weth-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(VIRTUAL, WETH, false)
    poolAddress: '0x21594b992F68495dD28d605834b58889d0a727c7',
    token0: BASE_TOKENS['VIRTUAL']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'Aerodrome VIRTUAL/WETH volatile pool (0.30%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-cbbtc-weth-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(cbBTC, WETH, false)
    poolAddress: '0x2578365B3dfA7FfE60108e181EFb79FeDdec2319',
    token0: BASE_TOKENS['cbBTC']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'Aerodrome cbBTC/WETH volatile pool (0.30%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-slipstream-weth-usdc-50',
    chain: 'base',
    dex: 'Aerodrome Slipstream',
    protocol: 'aerodrome-slipstream',
    // [FACT] Verified on-chain via Aerodrome CLFactory.getPool(WETH, USDC, 50)
    poolAddress: '0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 5,
    tickSpacing: 50,
    status: 'active',
    note: 'Aerodrome Slipstream concentrated liquidity WETH/USDC (tick spacing 50 ≈ 0.05%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-slipstream-weth-cbbtc-10',
    chain: 'base',
    dex: 'Aerodrome Slipstream',
    protocol: 'aerodrome-slipstream',
    // [FACT] Verified on-chain via Aerodrome CLFactory.getPool(cbBTC, WETH, 10)
    poolAddress: '0x42d4a22CaD0F5a49681a5715cE994Af73A43B76b',
    token0: BASE_TOKENS['cbBTC']!,
    token1: BASE_TOKENS['WETH']!,
    feeBps: 1,
    tickSpacing: 10,
    status: 'active',
    note: 'Aerodrome Slipstream concentrated liquidity cbBTC/WETH (tick spacing 10 ≈ 0.01%). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PancakeSwap v3 Pool Registry (Base)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PancakeSwap v3 deployment on Base.
 * [FACT] Factory: 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865
 * [FACT] QuoterV2: 0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
 * Source: PancakeSwap verified contracts on BaseScan.
 */
export const PANCAKESWAP_V3_FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const;
export const PANCAKESWAP_V3_QUOTER_V2 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as const;
export const PANCAKESWAP_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as const;

export const PANCAKESWAP_V3_POOLS: PoolDefinition[] = [
  {
    id: 'cakev3-base-weth-usdc-500',
    chain: 'base',
    dex: 'PancakeSwap v3',
    protocol: 'pancakeswap-v3',
    // [FACT] Verified on-chain via PancakeSwap Factory.getPool(WETH, USDC, 500)
    poolAddress: '0xB775272E537cc670C65DC852908aD47015244EaF',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 5,
    status: 'active',
    note: 'PancakeSwap v3 WETH/USDC 0.05% concentrated liquidity pool on Base. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cross-DEX Research Pairs
// ─────────────────────────────────────────────────────────────────────────────

export interface CrossDexPair {
  id: string;
  description: string;
  poolA: PoolDefinition;
  poolB: PoolDefinition;
  isObservable: boolean;
}

export const CROSS_DEX_PAIRS: CrossDexPair[] = [
  {
    id: 'weth-usdc-univ3-vs-aero-volatile',
    description: 'WETH/USDC: Uniswap v3 (0.05%) ↔ Aerodrome volatile (0.30%) — 35 bps fee friction baseline [DEC-011]',
    poolA: UNISWAP_V3_POOLS[0]!, // univ3-base-weth-usdc-500
    poolB: AERODROME_POOLS[0]!,  // aero-base-weth-usdc-volatile
    isObservable: true,
  },
  {
    id: 'weth-usdc-univ3-vs-aero-slipstream-lowfee',
    description: 'WETH/USDC: Uniswap v3 (0.05%) ↔ Aerodrome Slipstream (0.05%) — Ultra-low 10 bps fee friction [DEC-019]',
    poolA: UNISWAP_V3_POOLS[0]!, // univ3-base-weth-usdc-500
    poolB: AERODROME_POOLS[6]!,  // aero-slipstream-weth-usdc-50
    isObservable: true,
  },
  {
    id: 'weth-usdc-univ3-vs-cakev3-lowfee',
    description: 'WETH/USDC: Uniswap v3 (0.05%) ↔ PancakeSwap v3 (0.05%) — Ultra-low 10 bps fee friction [DEC-019]',
    poolA: UNISWAP_V3_POOLS[0]!, // univ3-base-weth-usdc-500
    poolB: PANCAKESWAP_V3_POOLS[0]!, // cakev3-base-weth-usdc-500
    isObservable: true,
  },
  {
    id: 'usdc-usdbc-univ3-vs-aero-stable',
    description: 'USDC/USDbC: Uniswap v3 (0.01%) ↔ Aerodrome stable (0.05%) — Stablecoin peg dislocation research',
    poolA: UNISWAP_V3_POOLS[1]!, // univ3-base-usdc-usdbc-100
    poolB: AERODROME_POOLS[1]!,  // aero-base-usdc-usdbc-stable
    isObservable: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All Active Pools (union of all registries, active status only)
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_ACTIVE_POOLS: PoolDefinition[] = [
  ...UNISWAP_V3_POOLS,
  ...AERODROME_POOLS,
  ...PANCAKESWAP_V3_POOLS,
].filter((p) => p.status === 'active');

export const ALL_POOLS: PoolDefinition[] = [
  ...UNISWAP_V3_POOLS,
  ...AERODROME_POOLS,
  ...PANCAKESWAP_V3_POOLS,
];
