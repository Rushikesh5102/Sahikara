/**
 * SAHIKARA — Phase 4.9 RPC Latency Benchmark Runner
 * Runs live measurement of 5 RPC methods across Base, Arbitrum, Optimism, Polygon.
 */

import { writeFileSync } from 'fs';
import path from 'path';
import { RpcLatencyBenchmark } from '../src/rpc/RpcLatencyBenchmark.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA — Phase 4.9: Actual RPC Latency Measurement');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allMeasurements = [];
  const breakdowns = [];

  for (const chainConfig of RpcLatencyBenchmark.CANONICAL_CHAINS) {
    console.log(`Profiling ${chainConfig.name.toUpperCase()} (${chainConfig.rpcUrl})...`);
    try {
      const res = await RpcLatencyBenchmark.benchmarkChain(chainConfig);
      breakdowns.push(res.breakdown);
      allMeasurements.push(...res.measurements);
      console.log(` - eth_blockNumber:     ${res.breakdown.rawNetworkRpcLatencyMs.eth_blockNumber} ms`);
      console.log(` - eth_getBlockByNumber: ${res.breakdown.rawNetworkRpcLatencyMs.eth_getBlockByNumber} ms`);
      console.log(` - eth_call (slot0):     ${res.breakdown.rawNetworkRpcLatencyMs.eth_call} ms`);
      console.log(` - multicall (v3):       ${res.breakdown.rawNetworkRpcLatencyMs.multicall} ms`);
      console.log(` - eth_getLogs:          ${res.breakdown.rawNetworkRpcLatencyMs.eth_getLogs} ms`);
      console.log(` - Median Network RPC:   ${res.breakdown.rawNetworkRpcLatencyMs.medianNetworkMs} ms`);
      console.log(` - Estimated Quote Sim:  ${res.breakdown.quoteSimulationLatencyMs} ms`);
      console.log(` - Local Evaluation:     ${res.breakdown.economicEvaluationLatencyMs} ms\n`);
    } catch (err) {
      console.error(`Error on ${chainConfig.name}:`, err);
    }
  }

  const outPath = path.resolve('data/rpc_latency_benchmark_phase49.json');
  const payload = {
    timestamp: new Date().toISOString(),
    breakdowns,
    allMeasurements,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Saved benchmark results to ${outPath}`);
}

main().catch(console.error);
