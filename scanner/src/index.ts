/**
 * SAHIKARA Observer — CLI Entry Point
 *
 * Usage:
 *   cd scanner
 *   cp .env.example .env   # Fill in BASE_RPC_URL
 *   npm run observe
 *
 * SECURITY NOTICE:
 *   This process is structurally read-only.
 *   It does NOT sign transactions.
 *   It does NOT submit transactions.
 *   It does NOT handle private keys.
 *   It does NOT deploy contracts.
 *   It does NOT require a wallet.
 *
 * Capital deployed: ₹0 / $0
 * Phase: 1C (Observation Engine)
 */

import { loadConfig } from './config/config.js';
import { RpcProvider } from './rpc/RpcProvider.js';
import { RpcManager } from './rpc/RpcManager.js';
import { UniswapV3Adapter } from './adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from './adapters/AerodromeAdapter.js';
import { PancakeSwapV3Adapter } from './adapters/PancakeSwapV3Adapter.js';
import { AerodromeSlipstreamAdapter } from './adapters/AerodromeSlipstreamAdapter.js';
import { MarketObserver } from './observer/MarketObserver.js';
import { ALL_ACTIVE_POOLS } from './config/pools.js';
import { RESEARCH_PAIRS } from './config/pairs.js';

async function main(): Promise<void> {
  // ── Load and validate configuration ───────────────────────────────────────
  let config;
  try {
    config = loadConfig();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[STARTUP] Configuration error:');
    console.error(message);
    console.error('');
    console.error('Ensure scanner/.env exists and all required variables are set.');
    console.error('Copy scanner/.env.example to scanner/.env as a starting point.');
    process.exit(1);
  }

  // ── Build data source (RPC Abstraction Layer) ─────────────────────────────
  const primaryProvider = new RpcProvider({
    id: config.rpcEndpointId || 'base-primary',
    url: config.baseRpcUrl,
    chainId: 8453,
  });

  const secondaryProvider = config.baseRpcUrlSecondary
    ? new RpcProvider({
        id: 'base-secondary',
        url: config.baseRpcUrlSecondary,
        chainId: 8453,
      })
    : null;

  const dataSource = new RpcManager({
    primaryProvider,
    secondaryProvider,
    maxRetries: 3,
  });

  // ── Build adapters ────────────────────────────────────────────────────────
  const adapters = [
    new UniswapV3Adapter(dataSource),
    new AerodromeAdapter(dataSource),
    new PancakeSwapV3Adapter(dataSource),
    new AerodromeSlipstreamAdapter(),
  ];

  // ── Build observer ────────────────────────────────────────────────────────
  const observer = new MarketObserver(
    config,
    dataSource,
    adapters,
    ALL_ACTIVE_POOLS,
    RESEARCH_PAIRS
  );

  // ── Graceful shutdown handling ────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    console.log(`\n[Observer] Received ${signal}. Initiating graceful shutdown...`);
    observer.stop();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ── Start observation loop ────────────────────────────────────────────────
  await observer.start();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[FATAL] Unhandled error in observation engine:');
  console.error(message);
  process.exit(1);
});
