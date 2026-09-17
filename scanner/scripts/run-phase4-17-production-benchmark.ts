/**
 * SAHIKARA Phase 4.17 — Production-Grade DEX State Reconstruction & Benchmark Runner
 *
 * MISSION:
 *   Evaluate state-aligned correctness, multi-tick crossing traversal, Aerodrome V2
 *   reconstruction, and restart recovery against live Base Mainnet contracts.
 *
 * INVARIANTS:
 *   - Strictly read-only calls. Zero trading credentials.
 *   - Capital at risk: strictly ₹0.00 / $0.00.
 *   - Phase 5 strictly BLOCKED.
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { LocalPoolStateManager } from '../src/dexstate/LocalPoolState.js';
import { LocalPriceEngine } from '../src/dexstate/LocalPriceEngine.js';
import { StateAlignedValidator, StateAlignedValidationReport } from '../src/dexstate/StateAlignedValidator.js';

const WETH = '0x4200000000000000000000000000000000000006' as const;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Canonical Base Deployments
const V3_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224' as const;
const V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;
const AERO_V2_POOL = '0xcDAC0d6c6C59727a65F871236188350531885C43' as const;

const V3_POOL_ABI = parseAbi([
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function tickBitmap(int16 wordPosition) external view returns (uint256)',
  'function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityInsideX128, uint32 secondsOutside, bool initialized)'
]);

const V3_QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const AERO_V2_ABI = parseAbi([
  'function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)',
  'function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)'
]);

interface LatencyStats {
  min: number;
  median: number;
  p95: number;
  max: number;
}

function computeStats(samples: number[]): LatencyStats {
  if (samples.length === 0) return { min: 0, median: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const median = sorted[Math.floor(sorted.length * 0.5)]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  return { min, median, p95, max };
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  SAHIKARA Phase 4.17 — Production DEX State Reconstruction & Multi-Tick');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const client = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org', { timeout: 10000 }),
  });

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const retryRead = async <T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        let errStr = String(err);
        try {
          errStr += ' ' + JSON.stringify(err, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
        } catch {
          // Ignore serialization error
        }
        if (errStr.includes('rate limit') || errStr.includes('429') || errStr.includes('-32016') || errStr.includes('over rate limit')) {
          await sleep(attempt * 2000);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const currentBlock = await retryRead(() => client.getBlock({ includeTransactions: false }));
  const blockNumber = currentBlock.number;
  const blockHash = currentBlock.hash;
  const parentHash = currentBlock.parentHash;

  console.log(`[Base Mainnet Context]`);
  console.log(`  Block Height: ${blockNumber.toString()}`);
  console.log(`  Block Hash:   ${blockHash}`);
  console.log(`  Parent Hash:  ${parentHash}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UNISWAP V3 STATE RECONSTRUCTION & MULTI-TICK VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`[1. Uniswap V3 Pool State Acquisition (${V3_POOL})]`);
  await sleep(500);
  const slot0Data = await retryRead(() => client.readContract({ address: V3_POOL, abi: V3_POOL_ABI, functionName: 'slot0', blockNumber }));
  await sleep(300);
  const liquidityVal = await retryRead(() => client.readContract({ address: V3_POOL, abi: V3_POOL_ABI, functionName: 'liquidity', blockNumber }));
  await sleep(300);
  const feeUint = await retryRead(() => client.readContract({ address: V3_POOL, abi: V3_POOL_ABI, functionName: 'fee', blockNumber }));
  await sleep(300);
  const tickSpacingVal = await retryRead(() => client.readContract({ address: V3_POOL, abi: V3_POOL_ABI, functionName: 'tickSpacing', blockNumber }));

  const sqrtPriceX96 = slot0Data[0];
  const activeTick = slot0Data[1];
  const activeLiquidity = liquidityVal;
  const feeUint24 = Number(feeUint);
  const tickSpacing = Number(tickSpacingVal);

  console.log(`  Current SqrtPriceX96: ${sqrtPriceX96.toString()}`);
  console.log(`  Active Tick:          ${activeTick}`);
  console.log(`  Active Liquidity:     ${activeLiquidity.toString()}`);
  console.log(`  Fee:                  ${feeUint24} (${feeUint24 / 10000}%)`);
  console.log(`  Tick Spacing:         ${tickSpacing}`);

  // Ingest initialized ticks around active tick (-5 ticks downward, +3 ticks upward)
  // For WETH -> USDC swap, price decreases, so tick moves downward (more negative).
  const baseCompressed = Math.floor(activeTick / tickSpacing);
  const targetTicks: number[] = [];
  for (let i = -5; i <= 3; i++) {
    targetTicks.push((baseCompressed + i) * tickSpacing);
  }

  console.log(`  Querying ${targetTicks.length} ticks sequentially around active tick...`);
  const tickBitmap = new Map<number, bigint>();
  const initializedTicks = new Map<number, { tick: number; liquidityGross: bigint; liquidityNet: bigint; initialized: boolean }>();

  for (const t of targetTicks) {
    await sleep(200);
    const res = await retryRead(() =>
      client.readContract({ address: V3_POOL, abi: V3_POOL_ABI, functionName: 'ticks', args: [t], blockNumber })
    );
    const gross = res[0];
    const net = res[1];
    const initialized = res[7];

    if (initialized || gross > 0n) {
      initializedTicks.set(t, {
        tick: t,
        liquidityGross: gross,
        liquidityNet: net,
        initialized: true,
      });
      LocalPoolStateManager.setTickBitmapBit(tickBitmap, t, tickSpacing);
    }
  }

  console.log(`  Initialized Ticks Ingested: ${initializedTicks.size} ticks\n`);
  await sleep(500);

  // Initialize Local State Manager
  const stateManager = new LocalPoolStateManager();
  const v3State = stateManager.initV3State(
    {
      poolAddress: V3_POOL,
      protocol: 'uniswap-v3',
      token0: WETH,
      token1: USDC,
      decimals0: 18,
      decimals1: 6,
    },
    sqrtPriceX96,
    activeTick,
    activeLiquidity,
    feeUint24,
    blockNumber,
    blockHash,
    0,
    initializedTicks,
    tickSpacing,
    tickBitmap,
    parentHash
  );

  // Test trade sizes across single-tick and multi-tick crossings
  const v3TestAmounts = [
    { label: '0.001 WETH (~$2.46)', amountIn: 1000000000000000n },
    { label: '0.01 WETH (~$24.60)', amountIn: 10000000000000000n },
    { label: '0.10 WETH (~$245.90)', amountIn: 100000000000000000n },
    { label: '1.00 WETH (~$2,459.00)', amountIn: 1000000000000000000n },
    { label: '2.00 WETH (~$4,918.00)', amountIn: 2000000000000000000n },
    { label: '5.00 WETH (~$12,295.00)', amountIn: 5000000000000000000n },
  ];

  const v3Reports: StateAlignedValidationReport[] = [];
  const aeroReports: StateAlignedValidationReport[] = [];
  const localLatenciesUs: number[] = [];
  const rpcLatenciesMs: number[] = [];

  console.log(`[2. Uniswap V3 Multi-Tick Local vs On-Chain Verification]`);
  for (const testCase of v3TestAmounts) {
    await sleep(250);
    // 1. Local calculation with microsecond duration
    const t0Local = performance.now();
    const localQuote = LocalPriceEngine.quoteV3MultiTick(v3State, WETH, testCase.amountIn);
    const t1Local = performance.now();
    const localDurUs = (t1Local - t0Local) * 1000;
    localLatenciesUs.push(localDurUs);

    // 2. Authoritative QuoterV2 call at identical blockNumber
    const t0Rpc = performance.now();
    const [authAmountOut, , authTicksCrossed] = (await retryRead(() =>
      client.readContract({
        address: V3_QUOTER,
        abi: V3_QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: WETH,
          tokenOut: USDC,
          amountIn: testCase.amountIn,
          fee: feeUint24,
          sqrtPriceLimitX96: 0n,
        }],
        blockNumber,
      })
    )) as [bigint, bigint, number, bigint];
    const t1Rpc = performance.now();
    const rpcDurMs = t1Rpc - t0Rpc;
    rpcLatenciesMs.push(rpcDurMs);

    const report = StateAlignedValidator.validate({
      poolAddress: V3_POOL,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: testCase.amountIn,
      localAmountOut: localQuote.amountOut,
      localBlockNumber: blockNumber,
      localBlockHash: blockHash,
      authoritativeAmountOut: authAmountOut,
      authoritativeBlockNumber: blockNumber,
      authoritativeBlockHash: blockHash,
    });
    v3Reports.push(report);

    console.log(`  ${testCase.label}:`);
    console.log(`    Local Output:   ${(Number(localQuote.amountOut) / 1e6).toFixed(4)} USDC (${localQuote.amountOut} wei)`);
    console.log(`    Auth QuoterV2:  ${(Number(authAmountOut) / 1e6).toFixed(4)} USDC (${authAmountOut} wei)`);
    console.log(`    Ticks Crossed:  Local=${localQuote.initializedTicksCrossed} | Auth=${authTicksCrossed}`);
    console.log(`    Delta:          ${report.absoluteDeltaWei} wei (${report.bpsDelta.toFixed(6)} bps) -> [${report.classification}]`);
    console.log(`    Latency:        Local=${localDurUs.toFixed(1)} µs | QuoterV2=${rpcDurMs.toFixed(2)} ms (Speedup: ${(rpcDurMs * 1000 / localDurUs).toFixed(0)}x)`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AERODROME V2 STATE RECONSTRUCTION & VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n[3. Aerodrome V2 Pool State Acquisition (${AERO_V2_POOL})]`);
  await sleep(400);
  const aeroReserves = await retryRead(() =>
    client.readContract({ address: AERO_V2_POOL, abi: AERO_V2_ABI, functionName: 'getReserves', blockNumber })
  );
  const reserve0 = aeroReserves[0];
  const reserve1 = aeroReserves[1];

  console.log(`  Reserve0 (WETH): ${(Number(reserve0) / 1e18).toFixed(4)} WETH (${reserve0} wei)`);
  console.log(`  Reserve1 (USDC): ${(Number(reserve1) / 1e6).toFixed(2)} USDC (${reserve1} wei)`);

  const aeroState = stateManager.initV2State(
    {
      poolAddress: AERO_V2_POOL,
      protocol: 'aerodrome-v2',
      token0: WETH,
      token1: USDC,
      decimals0: 18,
      decimals1: 6,
    },
    reserve0,
    reserve1,
    30, // 0.30% fee
    blockNumber,
    blockHash,
    0,
    parentHash
  );

  const aeroTestAmounts = [
    { label: '0.01 WETH (~$24.60)', amountIn: 10000000000000000n },
    { label: '1.00 WETH (~$2,459.00)', amountIn: 1000000000000000000n },
    { label: '5.00 WETH (~$12,295.00)', amountIn: 5000000000000000000n },
  ];

  console.log(`\n[4. Aerodrome V2 Local vs On-Chain getAmountOut Verification]`);
  for (const testCase of aeroTestAmounts) {
    await sleep(300);
    const t0 = performance.now();
    const localQuote = LocalPriceEngine.quoteV2(aeroState, WETH, testCase.amountIn);
    const localUs = (performance.now() - t0) * 1000;

    const t0Rpc = performance.now();
    const authAmountOut = await retryRead(() =>
      client.readContract({
        address: AERO_V2_POOL,
        abi: AERO_V2_ABI,
        functionName: 'getAmountOut',
        args: [testCase.amountIn, WETH],
        blockNumber,
      })
    );
    const rpcMs = performance.now() - t0Rpc;

    const report = StateAlignedValidator.validate({
      poolAddress: AERO_V2_POOL,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: testCase.amountIn,
      localAmountOut: localQuote.amountOut,
      localBlockNumber: blockNumber,
      localBlockHash: blockHash,
      authoritativeAmountOut: authAmountOut,
      authoritativeBlockNumber: blockNumber,
      authoritativeBlockHash: blockHash,
    });
    aeroReports.push(report);

    console.log(`  ${testCase.label}:`);
    console.log(`    Local Output:   ${(Number(localQuote.amountOut) / 1e6).toFixed(4)} USDC (${localQuote.amountOut} wei)`);
    console.log(`    Auth getAmount: ${(Number(authAmountOut) / 1e6).toFixed(4)} USDC (${authAmountOut} wei)`);
    console.log(`    Delta:          ${report.absoluteDeltaWei} wei (${report.bpsDelta.toFixed(6)} bps) -> [${report.classification}]`);
    console.log(`    Latency:        Local=${localUs.toFixed(1)} µs | RPC=${rpcMs.toFixed(2)} ms`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. RESTART RECOVERY TEST
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n[5. Engine Restart & State Persistence Test]`);
  const snapshotJson = stateManager.exportStateSnapshot(V3_POOL);
  console.log(`  Exported state snapshot: ${snapshotJson.length} bytes`);

  const freshManager = new LocalPoolStateManager();
  freshManager.importStateSnapshot(snapshotJson);
  const restoredV3 = freshManager.getV3State(V3_POOL)!;

  const quoteBefore = LocalPriceEngine.quoteV3MultiTick(v3State, WETH, 1000000000000000000n);
  const quoteAfter = LocalPriceEngine.quoteV3MultiTick(restoredV3, WETH, 1000000000000000000n);

  const restartDelta = quoteBefore.amountOut > quoteAfter.amountOut
    ? quoteBefore.amountOut - quoteAfter.amountOut
    : quoteAfter.amountOut - quoteBefore.amountOut;

  console.log(`  Quote Pre-Restart:  ${quoteBefore.amountOut} wei`);
  console.log(`  Quote Post-Restart: ${quoteAfter.amountOut} wei`);
  console.log(`  Restart Parity:     ${restartDelta === 0n ? 'PERFECT 0 WEI MATCH ✅' : 'PARITY ERROR ❌'}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PERFORMANCE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  const localStats = computeStats(localLatenciesUs);
  const rpcStats = computeStats(rpcLatenciesMs);

  console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
  console.log(`  PERFORMANCE & CORRECTNESS SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════════════════════════`);
  console.log(`  Local In-Memory Quote Latency (Microseconds):`);
  console.log(`    Min:    ${localStats.min.toFixed(1)} µs`);
  console.log(`    Median: ${localStats.median.toFixed(1)} µs`);
  console.log(`    P95:    ${localStats.p95.toFixed(1)} µs`);
  console.log(`    Max:    ${localStats.max.toFixed(1)} µs`);
  console.log(`  Remote QuoterV2 RPC Latency (Milliseconds):`);
  console.log(`    Min:    ${rpcStats.min.toFixed(2)} ms`);
  console.log(`    Median: ${rpcStats.median.toFixed(2)} ms`);
  console.log(`    P95:    ${rpcStats.p95.toFixed(2)} ms`);
  console.log(`    Max:    ${rpcStats.max.toFixed(2)} ms`);
  console.log(`  Acceleration Ratio: ~${(rpcStats.median * 1000 / localStats.median).toFixed(0)}x speedup`);
  console.log(`  Uniswap V3 Classifications: ${v3Reports.map(r => r.classification).join(', ')}`);
  console.log(`  Aerodrome V2 Classifications: ${aeroReports.map(r => r.classification).join(', ')}`);
  console.log(`═══════════════════════════════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('Fatal Benchmark Error:', err);
  process.exit(1);
});
