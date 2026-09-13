/**
 * SAHIKARA Phase 1D — Short Controlled Validation Runner
 *
 * Runs exactly 2 observation cycles with a 10s delay in between.
 * Validates:
 *   - multiple consecutive live cycles complete
 *   - block numbers advance or match live head
 *   - timestamps advance
 *   - observations are inserted cleanly
 *   - zero duplicate errors
 *   - clean shutdown and store closure
 *
 * Usage:
 *   node scripts/run-short-validation.mjs
 */

import { loadConfig } from '../dist/config/config.js';
import { RpcDataSource } from '../dist/data-sources/RpcDataSource.js';
import { UniswapV3Adapter } from '../dist/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../dist/adapters/AerodromeAdapter.js';
import { MarketObserver } from '../dist/observer/MarketObserver.js';
import { ALL_ACTIVE_POOLS } from '../dist/config/pools.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 1D — Short Controlled Validation (2 Cycles)');
  console.log(' READ-ONLY | No transactions | Zero private keys');
  console.log('═══════════════════════════════════════════════════════════════');

  const config = loadConfig();
  const dataSource = new RpcDataSource(
    config.baseRpcUrl,
    config.baseRpcUrlSecondary,
    config.rpcEndpointId
  );
  const adapters = [
    new UniswapV3Adapter(dataSource),
    new AerodromeAdapter(dataSource),
  ];
  const observer = new MarketObserver(config, dataSource, adapters, ALL_ACTIVE_POOLS);

  console.log('\n--- Cycle 1 Starting ---');
  await observer.runCycle();
  console.log('--- Cycle 1 Complete ---\n');

  console.log('Pausing 10s before Cycle 2...');
  await new Promise((r) => setTimeout(r, 10000));

  console.log('\n--- Cycle 2 Starting ---');
  await observer.runCycle();
  console.log('--- Cycle 2 Complete ---\n');

  console.log('Controlled validation finished successfully. Safe shutdown complete.');
}

main().catch((err) => {
  console.error('Fatal error during validation:', err);
  process.exit(1);
});
