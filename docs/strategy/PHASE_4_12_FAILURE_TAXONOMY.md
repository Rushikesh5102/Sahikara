# PHASE 4.12: Structured Failure Taxonomy Dossier

## 1. Failure Taxonomy Classification Standard

In compliance with Phase 4.12 Directive §26 and SAHIKARA Transparency Policy, quote execution failures, network anomalies, and economic non-viability events are strictly classified into mutually exclusive, canonical categories.

Failures are **never coerced** to synthetic economic values (e.g. $0.00 or -10,000 bps) or disguised as market spreads.

---

## 2. Canonical Failure Taxonomy

| Category Code | Domain | Definition & Trigger Conditions | Remediation / Protocol Behavior |
| :--- | :--- | :--- | :--- |
| **`SPREAD_TOO_SMALL`** | Economics | Executable round-trip quote completed with negative gross spread ($\text{grossDiff} \le 0$). | Standard non-profitable settled state. Recorded as economic measurement. |
| **`GAS_EXCEEDS_PROFIT`** | Economics | Gross spread is positive ($\text{grossDiff} > 0$), but estimated gas costs exceed gross profit. | Logged in Stage 4 of Positive Signal Gate. Classified as false positive (`GAS_DRAG`). |
| **`INSUFFICIENT_LIQUIDITY`**| Execution | Leg output is zero or quote simulation reverts due to pool reserve exhaustion at evaluated size. | Recorded as liquidity constraint. Route retained in inventory. |
| **`CONTRACT_REVERT`** | Protocol | QuoterV2 or pool contract execution reverted during read-only simulation. | Classified as structured contract revert. |
| **`RATE_LIMIT`** | Infrastructure | RPC provider returned HTTP 429 (Too Many Requests). | Handled by fallback RPC rotation and pacing delay. |
| **`TIMEOUT`** | Infrastructure | Contract read call exceeded timeout threshold (>10,000 ms). | Logged as network timeout. |
| **`RPC_ERROR`** | Infrastructure | Transport connection failure, socket hangup, or unparsable JSON response. | Failover to alternate public RPC endpoint. |
| **`UNSUPPORTED_POOL_TYPE`** | Mathematical | Pool topology detected whose mathematical invariant is unsupported (e.g., Balancer Composable Stable). | Explicitly marked unsupported. No heuristic approximations allowed. |
| **`TOKEN_IDENTITY_ERROR`** | State / Registry | Mismatched token address or non-standard ERC-20 interface. | Pool excluded from routable graph. |
| **`STALE_STATE`** | Temporal | Multi-leg quotes observed across differing block heights ($B_1 \neq B_2$). | Discarded under same-block consistency rule. |

---

## 3. Handling of Structured Failures in Phase 4.12

Across the 2,400 multi-size matrix evaluations:
- Structured quote failures occur predominantly on pools with micro-liquidity at higher trade sizes ($250 and $500).
- Network rate limits are actively mitigated through fallback multi-endpoint client pools with round-robin failover.
- All non-error evaluations reflect settled state negative round-trip economics driven by pool swap fee drag.
