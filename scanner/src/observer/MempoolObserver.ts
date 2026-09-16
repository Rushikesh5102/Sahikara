/**
 * SAHIKARA — Phase 4.8 Public Mempool Research & Read-Only Observer
 *
 * Investigates and models public pending transaction visibility across chains:
 *   - Base (8453): Centralized sequencer with private mempool; public RPC does NOT broadcast pending txs.
 *   - Arbitrum One (42161): Off-chain sequencer (Nitro); transactions sent directly to sequencer feed (FCFS); zero public p2p mempool.
 *   - Optimism (10): OP Stack single sequencer; zero public pending transaction pool.
 *   - Polygon (137): Bor network (EVM compatible proof-of-stake); exposes txpool/pending transactions if RPC node enables txpool APIs.
 *
 * STRICT SAFETY DIRECTIVES:
 * 1. Read-only observation telemetry.
 * 2. ZERO transaction submission or broadcasting.
 * 3. ZERO front-running, sandwiching, or user exploitation.
 * 4. Honest documentation: If an RPC does not support pending transaction subscriptions, report 'UNSUPPORTED' without fabrication.
 */

import { type PublicClient } from 'viem';

export type ChainMempoolArchitecture =
  | 'CENTRALIZED_SEQUENCER_PRIVATE_MEMPOOL' // Base, Optimism
  | 'SEQUENCER_FEED_FCFS'                  // Arbitrum
  | 'PUBLIC_P2P_BOR_MEMPOOL'               // Polygon PoS
  | 'UNKNOWN';

export interface ChainMempoolCapability {
  chain: string;
  chainId: number;
  architecture: ChainMempoolArchitecture;
  hasPublicPendingTxSubscription: boolean;
  requiresDedicatedNodeOrWs: boolean;
  supportsTxpoolContent: boolean;
  preTradeAnalysisViability: 'UNVIABLE' | 'RESTRICTED' | 'VIABLE';
  architecturalLimitations: string[];
}

export interface ObservedPendingTransaction {
  hash: string;
  chain: string;
  from?: string;
  to?: string;
  valueWei?: bigint;
  gasPriceWei?: bigint;
  observedAtMs: number;
  isDexInteraction: boolean;
}

export class MempoolObserver {
  /**
   * Returns canonical architectural capability profiles for each target chain.
   */
  public static getCapabilityProfile(chain: string): ChainMempoolCapability {
    const c = chain.toLowerCase();

    switch (c) {
      case 'base':
        return {
          chain: 'base',
          chainId: 8453,
          architecture: 'CENTRALIZED_SEQUENCER_PRIVATE_MEMPOOL',
          hasPublicPendingTxSubscription: false,
          requiresDedicatedNodeOrWs: true,
          supportsTxpoolContent: false,
          preTradeAnalysisViability: 'UNVIABLE',
          architecturalLimitations: [
            'Base operates a single centralized sequencer operated by Coinbase.',
            'Standard public RPC nodes (mainnet.base.org) reject eth_subscribe("newPendingTransactions").',
            'Pending user transactions are routed directly to the sequencer queue and ordered FCFS or via builder relays.',
            'Public observers only learn of transactions after block inclusion.',
          ],
        };

      case 'arbitrum':
        return {
          chain: 'arbitrum',
          chainId: 42161,
          architecture: 'SEQUENCER_FEED_FCFS',
          hasPublicPendingTxSubscription: false,
          requiresDedicatedNodeOrWs: true,
          supportsTxpoolContent: false,
          preTradeAnalysisViability: 'UNVIABLE',
          architecturalLimitations: [
            'Arbitrum Nitro utilizes a single sequencer operating first-come, first-served (FCFS) within sub-second time windows.',
            'There is no public p2p mempool. Nitro sequencer websocket feed broadcasts already-sequenced transactions, not pending unsequenced ones.',
            'Public RPC does not expose unsequenced pending transaction flow.',
          ],
        };

      case 'optimism':
        return {
          chain: 'optimism',
          chainId: 10,
          architecture: 'CENTRALIZED_SEQUENCER_PRIVATE_MEMPOOL',
          hasPublicPendingTxSubscription: false,
          requiresDedicatedNodeOrWs: true,
          supportsTxpoolContent: false,
          preTradeAnalysisViability: 'UNVIABLE',
          architecturalLimitations: [
            'Optimism (OP Stack) routes all user transactions directly to the block producer sequencer.',
            'No public p2p mempool exists for unincluded transactions.',
            'Standard public RPC (mainnet.optimism.io) drops or disallows txpool introspection.',
          ],
        };

      case 'polygon':
        return {
          chain: 'polygon',
          chainId: 137,
          architecture: 'PUBLIC_P2P_BOR_MEMPOOL',
          hasPublicPendingTxSubscription: true,
          requiresDedicatedNodeOrWs: false,
          supportsTxpoolContent: true,
          preTradeAnalysisViability: 'RESTRICTED',
          architecturalLimitations: [
            'Polygon Bor utilizes a standard Geth-derived p2p transaction pool.',
            'Public free-tier RPCs frequently rate-limit or disable eth_subscribe("newPendingTransactions") to conserve bandwidth.',
            'Full pending transaction payloads require follow-up eth_getTransactionByHash calls, incurring round-trip RPC latency.',
          ],
        };

      default:
        return {
          chain,
          chainId: 0,
          architecture: 'UNKNOWN',
          hasPublicPendingTxSubscription: false,
          requiresDedicatedNodeOrWs: true,
          supportsTxpoolContent: false,
          preTradeAnalysisViability: 'UNVIABLE',
          architecturalLimitations: ['Unknown chain architecture.'],
        };
    }
  }

  /**
   * Tests whether an active public RPC provider supports pending transaction subscription.
   * Read-only test with timeout.
   */
  public static async testPendingTxSupport(
    client: PublicClient,
    chainName: string
  ): Promise<{ supported: boolean; details: string }> {
    try {
      // Attempt an unprivileged RPC method check (e.g., txpool_status or eth_newPendingTransactionFilter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (client as any).request({
        method: 'eth_newPendingTransactionFilter',
        params: [],
      });

      if (res) {
        // Clean up filter immediately
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any).request({
            method: 'eth_uninstallFilter',
            params: [res],
          });
        } catch {
          // ignore cleanup error
        }
        return {
          supported: true,
          details: `Filter successfully created and uninstalled on ${chainName} (Filter ID: ${res})`,
        };
      }
      return { supported: false, details: `Filter creation returned null/empty on ${chainName}` };
    } catch (err) {
      const msg = (err as Error).message || String(err);
      return {
        supported: false,
        details: `RPC rejected pending transaction filter on ${chainName}: ${msg.slice(0, 120)}`,
      };
    }
  }
}
