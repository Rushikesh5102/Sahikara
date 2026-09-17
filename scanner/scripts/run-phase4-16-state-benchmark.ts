/**
 * SAHIKARA Phase 4.16 — DEX State Acquisition & Local Price Benchmark Runner
 *
 * MISSION:
 *   Evaluate state-aligned correctness and latency performance of local pool state
 *   reconstruction vs remote QuoterV2 / getAmountOut calls on Base Mainnet.
 *
 * INVARIANTS:
 *   - Strictly read-only calls. Zero trading credentials.
 *   - Capital at risk: strictly ₹0.00 / $0.00.
 *   - Phase 5 strictly BLOCKED.
 */

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { LocalPoolStateManager } from '../src/dexstate/LocalPoolState.js';
import { LocalPriceEngine } from '../src/dexstate/LocalPriceEngine.js';
import { StateAlignedValidator, StateAlignedValidationReport } from '../src/dexstate/StateAlignedValidator.js';

const WETH = '0x4200000000000000000000000000000000000006' as const;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const V3_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224' as const;
const V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

// Minimal Pool ABIs
const V3_POOL_ABI = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    name: 'liquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
] as const;

const V3_QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.16 — DEX State Acquisition Benchmark');
  console.log(' Capital: ₹0.00 | Execution: LOCKED | Credentials: NONE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = createPublicClient({
    chain: base,
    transport: http('https://base-rpc.publicnode.com', { timeout: 10000 }),
  });

  const stateManager = new LocalPoolStateManager();

  // 1. Fetch Current Snapshot from Base Mainnet
  console.log('[1/4] Acquiring Authoritative On-Chain State Snapshot...');
  const tSnapshotStart = performance.now();

  const [blockNumber, blockHeader, slot0, liquidity] = await Promise.all([
    client.getBlockNumber(),
    client.getBlock({ blockTag: 'latest' }),
    client.readContract({
      address: V3_POOL,
      abi: V3_POOL_ABI,
      functionName: 'slot0',
    }),
    client.readContract({
      address: V3_POOL,
      abi: V3_POOL_ABI,
      functionName: 'liquidity',
    }),
  ]);

  const tSnapshotEnd = performance.now();
  const snapshotDurationMs = Number((tSnapshotEnd - tSnapshotStart).toFixed(2));
  console.log(`  Snapshot acquired in ${snapshotDurationMs}ms at Block ${blockNumber} (${blockHeader.hash.slice(0, 14)}...)`);
  console.log(`  slot0 sqrtPriceX96: ${slot0[0].toString()}`);
  console.log(`  slot0 tick:         ${slot0[1]}`);
  console.log(`  liquidity:          ${liquidity.toString()}\n`);

  // 2. Initialize In-Memory State
  console.log('[2/4] Initializing In-Memory Pool State...');
  const v3State = stateManager.initV3State(
    {
      poolAddress: V3_POOL,
      protocol: 'uniswap-v3',
      token0: WETH,
      token1: USDC,
      decimals0: 18,
      decimals1: 6,
    },
    slot0[0],
    slot0[1],
    liquidity,
    500, // 0.05%
    blockNumber,
    blockHeader.hash
  );
  console.log(`  Local state initialized with freshness: ${v3State.freshness}\n`);

  // 3. Compare Local Price Engine vs Authoritative QuoterV2 across multiple sizes
  console.log('[3/4] Evaluating State-Aligned Quotes Across Trade Sizes...');
  const testAmountsWeth = [
    { label: '0.01 WETH (~$25)', amount: 10000000000000000n },
    { label: '0.10 WETH (~$250)', amount: 100000000000000000n },
    { label: '1.00 WETH (~$2500)', amount: 1000000000000000000n },
    { label: '2.00 WETH (~$5000)', amount: 2000000000000000000n },
  ];

  const validationReports: StateAlignedValidationReport[] = [];
  const latencyResults: {
    size: string;
    localCalcMs: number;
    rpcQuoteMs: number;
    speedup: number;
  }[] = [];

  for (const item of testAmountsWeth) {
    // A. Local In-Memory Calculation
    const localResult = LocalPriceEngine.quoteV3(v3State, WETH, item.amount);

    // B. Authoritative On-Chain QuoterV2 RPC Call
    const tRpc0 = performance.now();
    const quoterRes = await client.readContract({
      address: V3_QUOTER,
      abi: V3_QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: WETH,
          tokenOut: USDC,
          amountIn: item.amount,
          fee: 500,
          sqrtPriceLimitX96: 0n,
        },
      ],
      blockNumber, // Enforce identical block state!
    });
    const tRpc1 = performance.now();
    const rpcQuoteMs = Number((tRpc1 - tRpc0).toFixed(2));

    const authAmountOut = quoterRes[0];

    // C. Validate alignment
    const report = StateAlignedValidator.validate({
      poolAddress: V3_POOL,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: item.amount,
      localAmountOut: localResult.amountOut,
      localBlockNumber: v3State.blockNumber,
      localBlockHash: v3State.blockHash,
      authoritativeAmountOut: authAmountOut,
      authoritativeBlockNumber: blockNumber,
      authoritativeBlockHash: blockHeader.hash,
    });

    validationReports.push(report);

    const speedup = Number((rpcQuoteMs / Math.max(localResult.calculationDurationMs, 0.001)).toFixed(1));
    latencyResults.push({
      size: item.label,
      localCalcMs: localResult.calculationDurationMs,
      rpcQuoteMs,
      speedup,
    });

    const localUsdc = (Number(localResult.amountOut) / 1e6).toFixed(4);
    const authUsdc = (Number(authAmountOut) / 1e6).toFixed(4);

    console.log(`  Size ${item.label.padEnd(20)}:`);
    console.log(`    Local AmountOut:   ${localUsdc} USDC (${localResult.calculationDurationMs.toFixed(3)}ms)`);
    console.log(`    Auth AmountOut:    ${authUsdc} USDC (${rpcQuoteMs}ms)`);
    console.log(`    Delta:             ${report.bpsDelta >= 0 ? '+' : ''}${report.bpsDelta.toFixed(4)} bps (${report.absoluteDeltaWei.toString()} wei)`);
    console.log(`    Classification:    [${report.classification}]`);
    console.log(`    Speedup:           ${speedup}x\n`);
    await new Promise((r) => setTimeout(r, 300));
  }

  // 4. Quantify RPC Call Reduction Architecture Model
  console.log('[4/4] Quantifying RPC Call Reduction Across Architectures...');
  // Scenario: 100 CEX order-book updates per minute
  const updatesPerMinute = 100;
  const tradeSizesEvaluated = 4;
  const totalEvaluationsPerMin = updatesPerMinute * tradeSizesEvaluated; // 400

  // Architecture A: Pure QuoterV2 polling
  const rpcCallsArchA = totalEvaluationsPerMin; // 400 calls/min

  // Architecture B: Local State only (0 verification)
  // Maintains WebSocket stream (1 subscription)
  const rpcCallsArchB = 0; // 0 calls/min

  // Architecture C: Hybrid (Local state pre-filtering + verified trigger on candidate)
  // In historical calm markets, gross candidate rate is 0.00% to 0.05%
  const candidateRate = 0.001; // 0.1% upper bound
  const verifiedCalls = Math.ceil(totalEvaluationsPerMin * candidateRate);
  const rpcCallsArchC = verifiedCalls; // ~1 call/min

  const reductionPercentC = Number((((rpcCallsArchA - rpcCallsArchC) / rpcCallsArchA) * 100).toFixed(2));

  console.log(`  Assumed Workload: ${updatesPerMinute} events/min x ${tradeSizesEvaluated} sizes = ${totalEvaluationsPerMin} evaluations/min`);
  console.log(`  Architecture A (Pure QuoterV2 Polling):         ${rpcCallsArchA} RPC calls/min`);
  console.log(`  Architecture B (Local State Only - No Safety):   ${rpcCallsArchB} RPC calls/min (100.0% reduction)`);
  console.log(`  Architecture C (Hybrid Local State + Verified):  ${rpcCallsArchC} RPC calls/min (${reductionPercentC}% reduction)\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' BENCHMARK SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.table(
    validationReports.map((r, i) => ({
      TradeSize: testAmountsWeth[i]?.label,
      LocalUsdc: (Number(r.localAmountOut) / 1e6).toFixed(4),
      AuthUsdc: (Number(r.authoritativeAmountOut) / 1e6).toFixed(4),
      BpsDelta: r.bpsDelta,
      Classification: r.classification,
      LocalLatencyMs: latencyResults[i]?.localCalcMs,
      RpcLatencyMs: latencyResults[i]?.rpcQuoteMs,
      Speedup: `${latencyResults[i]?.speedup}x`,
    }))
  );

  console.log('\nProcess terminating cleanly (code 0)...');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
