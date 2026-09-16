/**
 * SAHIKARA — Phase 4.8 Searcher Competition & Ordering Layer Model
 *
 * Models the multi-stage MEV lifecycle from market dislocation through private ordering
 * and block inclusion, explicitly demarcating SAHIKARA's observation visibility boundaries.
 *
 * CRITICAL INVARIANT:
 * Do not estimate exact searcher profitability without empirical transaction evidence.
 * All competitive timing estimates must clearly distinguish between observed and theoretical.
 */

export type MEVLifecycleStage =
  | 'MARKET_STATE_CHANGE'       // 1. Initial pool swap or state divergence occurs
  | 'SEARCHER_DETECTION'        // 2. Colocated/local searcher detects opportunity
  | 'BUNDLE_CONSTRUCTION'       // 3. Searcher forms atomic execution bundle
  | 'ORDERING_LAYER_SUBMISSION' // 4. Sent to private relay / builder / sequencer
  | 'COMPETITIVE_REACTION'      // 5. Competing searchers observe/bid in builder auctions
  | 'BUILDER_SEQUENCER_ORDER'   // 6. Block builder or L2 sequencer orders transactions
  | 'ON_CHAIN_INCLUSION';       // 7. Transaction included and state committed on-chain

export type VisibilityStatus = 'FULL_VISIBILITY' | 'PARTIAL_VISIBILITY' | 'NO_VISIBILITY';

export interface MEVStageAnalysis {
  stage: MEVLifecycleStage;
  sequenceOrder: number;
  description: string;
  sahikaraVisibility: VisibilityStatus;
  primaryInfrastructure: string;
  observableData: string[];
  hiddenData: string[];
}

export interface CompetitionModelReport {
  analyzedChain: string;
  orderingMechanism: 'CENTRALIZED_FCFS' | 'BUILDER_BUNDLE_AUCTION' | 'MEMPOOL_PGA';
  lifecycle: MEVStageAnalysis[];
  visibilityCoveragePct: number;
  criticalBlindSpots: string[];
  searcherAdvantageFactors: string[];
}

export class SearcherCompetitionModel {
  /**
   * Generates the analytical competition and visibility map for a target chain.
   */
  public static analyzeChainCompetition(chainName: string): CompetitionModelReport {
    const c = chainName.toLowerCase();
    const isL2 = c === 'base' || c === 'arbitrum' || c === 'optimism';

    const lifecycle: MEVStageAnalysis[] = [
      {
        stage: 'MARKET_STATE_CHANGE',
        sequenceOrder: 1,
        description: 'A trade, liquidation, or pool interaction causes a cross-venue or cross-tier price divergence.',
        sahikaraVisibility: 'FULL_VISIBILITY',
        primaryInfrastructure: 'On-chain DEX smart contracts & liquidity pools',
        observableData: ['Swap event logs', 'Updated slot0 / reserves', 'Historical block receipts'],
        hiddenData: ['Unincluded pending state changes inside sequencer queue'],
      },
      {
        stage: 'SEARCHER_DETECTION',
        sequenceOrder: 2,
        description: 'Arbitrage bot detects discrepancy via local in-memory pool state simulation.',
        sahikaraVisibility: 'NO_VISIBILITY',
        primaryInfrastructure: 'Private searcher infrastructure (C++ / Rust / Colocated nodes)',
        observableData: [],
        hiddenData: ['Searcher algorithms', 'In-memory graph traversals', 'Detection timestamps'],
      },
      {
        stage: 'BUNDLE_CONSTRUCTION',
        sequenceOrder: 3,
        description: 'Searcher constructs flash loan or atomic multi-leg routing bundle with optimal sizing.',
        sahikaraVisibility: 'NO_VISIBILITY',
        primaryInfrastructure: 'Proprietary smart contracts (custom arbitrage executors)',
        observableData: [],
        hiddenData: ['Pre-calculated optimal input size', 'Flash loan provider choice', 'Custom execution bytecode'],
      },
      {
        stage: 'ORDERING_LAYER_SUBMISSION',
        sequenceOrder: 4,
        description: 'Transaction bundle transmitted to builder endpoint, sequencer socket, or private RPC.',
        sahikaraVisibility: 'NO_VISIBILITY',
        primaryInfrastructure: isL2
          ? 'Direct L2 Sequencer feed / Builder relays (Flashbots / Titan)'
          : 'Polygon Bor p2p mempool / Validator private RPCs',
        observableData: !isL2 ? ['Pending transaction hash if broadcast to public Bor mempool'] : [],
        hiddenData: ['Private RPC bundles', 'MEV-Share bids', 'Sequencer FCFS socket buffer'],
      },
      {
        stage: 'COMPETITIVE_REACTION',
        sequenceOrder: 5,
        description: 'Secondary searchers react or bundle auctions compete for block inclusion.',
        sahikaraVisibility: 'NO_VISIBILITY',
        primaryInfrastructure: 'Block builder auctions (MEV-Boost / Builder auction engines)',
        observableData: [],
        hiddenData: ['Bribe bids', 'Priority gas auction (PGA) bidding wars', 'Builder order matching'],
      },
      {
        stage: 'BUILDER_SEQUENCER_ORDER',
        sequenceOrder: 6,
        description: 'Sequencer stamps transaction timestamp (FCFS) or builder finalizes block bundle.',
        sahikaraVisibility: 'NO_VISIBILITY',
        primaryInfrastructure: isL2 ? 'L2 Sequencer state machine' : 'Block Builder algorithm',
        observableData: [],
        hiddenData: ['Relative ordering decisions', 'Microsecond sequencer arrival offsets'],
      },
      {
        stage: 'ON_CHAIN_INCLUSION',
        sequenceOrder: 7,
        description: 'Block containing the arbitrage transaction is sealed, executed, and broadcast.',
        sahikaraVisibility: 'FULL_VISIBILITY',
        primaryInfrastructure: 'L1/L2 Execution Client (Geth, Reth, Nitro, Bor)',
        observableData: [
          'Confirmed block receipts',
          'Searcher contract address',
          'Actual profit captured (tokens transferred)',
          'Gas units consumed and priority fees paid',
        ],
        hiddenData: ['Reverted / canceled bundle bids not included in the block'],
      },
    ];

    const fullCount = lifecycle.filter((s) => s.sahikaraVisibility === 'FULL_VISIBILITY').length;
    const partialCount = lifecycle.filter((s) => s.sahikaraVisibility === 'PARTIAL_VISIBILITY').length;
    const visibilityCoveragePct = Number((((fullCount + partialCount * 0.5) / lifecycle.length) * 100).toFixed(1));

    const criticalBlindSpots = [
      'Pre-inclusion state: SAHIKARA observes the market strictly at Stage 1 and Stage 7 (post-inclusion).',
      'Sequencer queue dynamics: Stages 2 through 6 occur off-chain or inside private ordering infrastructure with 0 public visibility.',
      'Negative fee-floor signals: Discrepancies that are arbitraged within the same block appear to SAHIKARA only as already-balanced pools.',
    ];

    const searcherAdvantageFactors = [
      'Colocation: Searchers colocate nodes in identical cloud regions/datacenters as the sequencer (e.g. AWS us-east-1 for Base).',
      'Private Order Flow: Searchers utilize direct websocket connections or builder endpoints with sub-10ms delivery.',
      'In-Memory Pool State: Full local fork simulation avoids public RPC quoter round-trip latencies (saving 50–200ms per quote).',
      'Gas Efficiency: Custom handwritten Yul/assembly executor contracts consume ~120,000 gas vs ~280,000 for standard multi-router calls.',
    ];

    return {
      analyzedChain: chainName,
      orderingMechanism: isL2 ? 'CENTRALIZED_FCFS' : 'MEMPOOL_PGA',
      lifecycle,
      visibilityCoveragePct,
      criticalBlindSpots,
      searcherAdvantageFactors,
    };
  }
}
