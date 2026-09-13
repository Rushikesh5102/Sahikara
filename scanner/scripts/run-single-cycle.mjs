import { loadConfig } from '../dist/config/config.js';
import { RpcDataSource } from '../dist/data-sources/RpcDataSource.js';
import { UniswapV3Adapter } from '../dist/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../dist/adapters/AerodromeAdapter.js';
import { MarketObserver } from '../dist/observer/MarketObserver.js';
import { ALL_ACTIVE_POOLS } from '../dist/config/pools.js';

async function main() {
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
  console.log('Running single read-only live cycle against Base mainnet...');
  await observer.runCycle();
  console.log('Cycle finished successfully.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
