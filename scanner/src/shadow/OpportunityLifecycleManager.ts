/**
 * SAHIKARA Phase 4 — Opportunity Lifecycle Manager
 *
 * Implements the deterministic state machine governing opportunity transitions:
 *
 *              ┌──────────── DETECTED ───────────┐
 *              │                                 │
 *              ▼                                 ▼
 *          EVALUATED                         REJECTED / INVALIDATED
 *              │
 *       ┌──────┴──────────────┐
 *       ▼                     ▼
 *  SHADOW_SUBMITTED    MISSED / REJECTED
 *       │
 *  ┌────┴────────────┐
 *  ▼                 ▼
 * INCLUDED        EXPIRED / INVALIDATED
 *
 * Enforces the 10-Point False-Positive Protection Policy.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only state machine. Zero transaction broadcasting.
 */

import type {
  OpportunityLifecycleState,
  OpportunityClassification,
  ShadowOpportunity,
  EconomicPolicyConfig,
} from './types.js';

export interface StateTransitionRecord {
  fromState: OpportunityLifecycleState;
  toState: OpportunityLifecycleState;
  timestampWallMs: number;
  timestampMonoMs: number;
  reason?: string;
}

export class OpportunityLifecycleManager {
  private static readonly VALID_TRANSITIONS: Record<OpportunityLifecycleState, OpportunityLifecycleState[]> = {
    DETECTED: ['EVALUATED', 'REJECTED', 'INVALIDATED'],
    EVALUATED: ['SHADOW_SUBMITTED', 'REJECTED', 'MISSED', 'INVALIDATED'],
    SHADOW_SUBMITTED: ['INCLUDED', 'EXPIRED', 'INVALIDATED'],
    INCLUDED: [], // Terminal
    EXPIRED: [], // Terminal
    MISSED: [], // Terminal
    REJECTED: [], // Terminal
    INVALIDATED: [], // Terminal
  };

  /**
   * Validates whether a state transition is legal according to the lifecycle graph.
   */
  public static isValidTransition(
    current: OpportunityLifecycleState,
    target: OpportunityLifecycleState
  ): boolean {
    return this.VALID_TRANSITIONS[current].includes(target);
  }

  /**
   * Transitions an opportunity to a new lifecycle state, validating the transition and recording timestamps.
   */
  public static transition(
    opportunity: ShadowOpportunity,
    targetState: OpportunityLifecycleState,
    reason?: string
  ): void {
    if (!this.isValidTransition(opportunity.lifecycleState, targetState)) {
      throw new Error(
        `Illegal lifecycle transition: ${opportunity.lifecycleState} -> ${targetState} for opp ${opportunity.opportunityId}`
      );
    }

    opportunity.lifecycleState = targetState;
    const nowWall = Date.now();

    if (targetState === 'EVALUATED') {
      opportunity.timestamps.tEvaluateWallMs = nowWall;
    } else if (targetState === 'SHADOW_SUBMITTED') {
      opportunity.timestamps.tShadowSubmitWallMs = nowWall;
    } else if (targetState === 'INCLUDED') {
      opportunity.timestamps.tHypotheticalInclusionWallMs = nowWall;
    } else if (targetState === 'EXPIRED') {
      opportunity.timestamps.tExpiryWallMs = nowWall;
    }

    if (reason) {
      opportunity.rejectionReason = reason;
    }
  }

  /**
   * 10-Point False-Positive Protection Policy.
   * Evaluates an opportunity against all strict economic and execution gates.
   */
  public static evaluateGates(
    opportunity: ShadowOpportunity,
    config: EconomicPolicyConfig,
    currentBlockNumber: bigint
  ): { passes: boolean; classification: OpportunityClassification; rejectionReason?: string } {
    // 1. Quote Validity: Non-zero positive outputs
    if (opportunity.quotedLeg1Output <= 0n || opportunity.quotedLeg2Output <= 0n) {
      return {
        passes: false,
        classification: 'QUOTE_FAILED',
        rejectionReason: 'One or both leg quotes returned zero or negative outputs',
      };
    }

    // 2. Block Freshness: Must not be stale relative to current block
    const blockDelta = currentBlockNumber - opportunity.triggerBlockNumber;
    if (blockDelta > 2n) {
      return {
        passes: false,
        classification: 'INVALIDATED',
        rejectionReason: `Stale block: event block ${opportunity.triggerBlockNumber} is ${blockDelta} blocks behind current block ${currentBlockNumber}`,
      };
    }

    // 3. Pool Validity: Valid pool addresses
    if (
      !opportunity.poolLeg1 ||
      !opportunity.poolLeg2 ||
      opportunity.poolLeg1.length !== 42 ||
      opportunity.poolLeg2.length !== 42
    ) {
      return {
        passes: false,
        classification: 'INVALIDATED',
        rejectionReason: 'Invalid pool contract addresses',
      };
    }

    // 4. Liquidity Check: Valid output relative to trade size
    if (opportunity.tradeSizeUsd <= 0 || opportunity.initialAmount <= 0n) {
      return {
        passes: false,
        classification: 'INSUFFICIENT_LIQUIDITY',
        rejectionReason: 'Zero trade size or invalid input amount',
      };
    }

    // 5. Executable Output Check: Gross spread must be positive
    if (opportunity.grossSpreadBps <= 0) {
      return {
        passes: false,
        classification: 'SPREAD_TOO_SMALL',
        rejectionReason: `Non-positive gross spread: ${opportunity.grossSpreadBps.toFixed(2)} bps`,
      };
    }

    // 6. Slippage Check: Total price impact must not exceed tolerance
    if (opportunity.totalPriceImpactBps > config.maxSlippageBps) {
      return {
        passes: false,
        classification: 'SLIPPAGE_TOO_HIGH',
        rejectionReason: `Total price impact ${opportunity.totalPriceImpactBps.toFixed(1)} bps exceeds limit of ${config.maxSlippageBps} bps`,
      };
    }

    // 7. Latency Check: Total detection + simulation latency within window
    const elapsedLatencyMs = opportunity.timestamps.detectionLatencyMs + opportunity.timestamps.simulationLatencyMs;
    if (elapsedLatencyMs > config.maxViableLatencyMs) {
      return {
        passes: false,
        classification: 'LATENCY_TOO_HIGH',
        rejectionReason: `End-to-end latency ${elapsedLatencyMs} ms exceeds max viable cutoff of ${config.maxViableLatencyMs} ms`,
      };
    }

    // 8. Gas Cost Check: Gas cost must not exceed ceiling
    if (opportunity.gasBreakdown.totalGasCostUsd > config.maxGasCostUsd) {
      return {
        passes: false,
        classification: 'GAS_TOO_HIGH',
        rejectionReason: `Total gas cost $${opportunity.gasBreakdown.totalGasCostUsd.toFixed(4)} exceeds ceiling of $${config.maxGasCostUsd.toFixed(4)}`,
      };
    }

    // 9. Risk Buffer Gate: Net profit after gas and risk buffer must be positive
    if (opportunity.netExpectedPnLUsd <= 0) {
      return {
        passes: false,
        classification: 'RISK_REJECTED',
        rejectionReason: `Net expected profit $${opportunity.netExpectedPnLUsd.toFixed(4)} is negative after gas and risk buffer`,
      };
    }

    // 10. Net Profitability Check: Must meet minimum net profit hurdle
    if (opportunity.netExpectedPnLUsd < config.minNetProfitUsd) {
      return {
        passes: false,
        classification: 'SPREAD_TOO_SMALL',
        rejectionReason: `Net profit $${opportunity.netExpectedPnLUsd.toFixed(4)} is below hurdle of $${config.minNetProfitUsd.toFixed(4)}`,
      };
    }

    // If all 10 checks pass:
    return {
      passes: true,
      classification: 'PROFITABLE_SHADOW',
    };
  }
}
