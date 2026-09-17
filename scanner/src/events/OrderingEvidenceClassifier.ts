/**
 * SAHIKARA — Phase 4.13A Ordering Evidence Classifier & Intra-Block Sequence Model
 *
 * Implements formal taxonomy for:
 *   1. Six Ordering Evidence Levels (LEVEL 0 through LEVEL 5)
 *   2. Replay Capability Classification
 *   3. Deterministic Intra-Block Event Sorting (transactionIndex, logIndex)
 *
 * INVARIANT:
 * Zero private keys, zero live execution. Research telemetry only.
 */

export enum OrderingEvidenceLevel {
  LEVEL_0_THEORETICAL = 0,
  LEVEL_1_SETTLED_BLOCK = 1,
  LEVEL_2_EVENT_ORDER_RECONSTRUCTION = 2,
  LEVEL_3_PUBLIC_PENDING_TX = 3,
  LEVEL_4_TX_LEVEL_STATE_REPLAY = 4,
  LEVEL_5_DIRECT_PRIVATE_ORDER_FLOW = 5,
}

export type ReplayCapabilityType =
  | 'BLOCK_STATE_REPLAY'
  | 'EVENT_SEQUENCE_RECONSTRUCTION'
  | 'TRANSACTION_LEVEL_STATE_REPLAY'
  | 'EXACT_INTERMEDIATE_STATE_REPLAY';

export interface IntraBlockLogItem {
  blockNumber: bigint;
  transactionIndex: number;
  logIndex: number;
  poolAddress: string;
  eventType: string;
  txHash: string;
}

export class OrderingEvidenceClassifier {
  /**
   * Describes the meaning and limitations of each ordering evidence level.
   */
  public static describeLevel(level: OrderingEvidenceLevel): {
    title: string;
    description: string;
    epistemicBoundary: string;
  } {
    switch (level) {
      case OrderingEvidenceLevel.LEVEL_0_THEORETICAL:
        return {
          title: 'LEVEL 0 — Theoretical / Documented Only',
          description: 'Based solely on whitepapers, sequencer specifications, and docs without empirical capture.',
          epistemicBoundary: 'Cannot verify real-time sequencing deviation.',
        };
      case OrderingEvidenceLevel.LEVEL_1_SETTLED_BLOCK:
        return {
          title: 'LEVEL 1 — Settled Block Observation',
          description: 'Observes committed post-execution pool states via public RPC eth_call / multicall.',
          epistemicBoundary: 'Intermediate intra-block states and transient pending spreads are invisible.',
        };
      case OrderingEvidenceLevel.LEVEL_2_EVENT_ORDER_RECONSTRUCTION:
        return {
          title: 'LEVEL 2 — Event-Order Reconstruction',
          description: 'Reconstructs intra-block chronological sequence using transactionIndex and logIndex.',
          epistemicBoundary: 'Establishes order of execution but cannot query intermediate EVM balances without archive/trace APIs.',
        };
      case OrderingEvidenceLevel.LEVEL_3_PUBLIC_PENDING_TX:
        return {
          title: 'LEVEL 3 — Public Pending Transaction Observation',
          description: 'Monitors public mempool streams (eth_subscribe newPendingTransactions).',
          epistemicBoundary: 'L2 sequencers with private mempools emit zero public pending transactions.',
        };
      case OrderingEvidenceLevel.LEVEL_4_TX_LEVEL_STATE_REPLAY:
        return {
          title: 'LEVEL 4 — Transaction-Level State Replay',
          description: 'Reconstructs exact EVM state after each individual transaction using trace/debug APIs.',
          epistemicBoundary: 'Requires specialized archive nodes (debug_traceTransaction). Costly infrastructure.',
        };
      case OrderingEvidenceLevel.LEVEL_5_DIRECT_PRIVATE_ORDER_FLOW:
        return {
          title: 'LEVEL 5 — Direct Private / Order-Flow Visibility',
          description: 'Direct visibility into private builder queues, block builder bundles, and priority sequencer feeds.',
          epistemicBoundary: 'Strictly unobservable via standard public endpoints.',
        };
    }
  }

  /**
   * Sorts events within the same block deterministically by transactionIndex, then logIndex.
   */
  public static sortIntraBlockEvents<T extends IntraBlockLogItem>(events: T[]): T[] {
    return [...events].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex;
      }
      return a.logIndex - b.logIndex;
    });
  }

  /**
   * Classifies the replay capability of an observation engine.
   */
  public static classifyReplay(hasTraceApi: boolean, hasIntraBlockLogs: boolean): ReplayCapabilityType {
    if (hasTraceApi) {
      return 'TRANSACTION_LEVEL_STATE_REPLAY';
    }
    if (hasIntraBlockLogs) {
      return 'EVENT_SEQUENCE_RECONSTRUCTION';
    }
    return 'BLOCK_STATE_REPLAY';
  }
}
