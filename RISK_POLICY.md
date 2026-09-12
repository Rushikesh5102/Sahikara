# RISK_POLICY.md — Quantitative Risk Controls & Operational Limits

> **PROVISIONAL STATUS NOTICE**  
> All numerical limits, dollar/rupee figures, gas thresholds, and percentages defined in this document are **PROVISIONAL**.  
> They represent initial conservative constraints designed to protect capital. They will be refined and validated with empirical simulation data during Phase 3 (Simulator) and Phase 4 (Paper Validation) prior to live capital deployment.

---

## 1. Trading Risk Limits (PROVISIONAL)

| Parameter | Provisional Baseline Value | Rationale | State |
| :--- | :--- | :--- | :--- |
| **Minimum Expected Net Profit ($\Pi_{\text{min}}$)** | $\ge \$0.05$ (or $\ge 0.50\%$ of trade capital) | Protects against micro-reverts and unexpected gas slippage | **PROVISIONAL** |
| **Maximum Trade Size ($Q_{\text{max}}$)** | ₹100 equivalent (~1.20 USD / ~2.5 POL) | Matches Phase 8 total experimental capital envelope | **PROVISIONAL** |
| **Maximum Slippage Tolerance ($S_{\text{max}}$)** | $0.20\%$ ($20\text{ bps}$) | Prevents execution if price shifts unfavorably during block assembly | **PROVISIONAL** |
| **Maximum Gas Price Cap ($G_{\text{max}}$)** | $50\text{ Gwei}$ (Polygon POS) | Prevents submitting transactions during severe gas auctions | **PROVISIONAL** |
| **Maximum Gas Cost per Trade ($C_{\text{gas, max}}$)** | $\le 20\%$ of expected gross profit | Prevents gas consumption from dominating trade economics | **PROVISIONAL** |
| **Minimum Pool Liquidity Depth ($L_{\text{min}}$)** | $\$5,000$ pool reserve equivalent | Filters out hyper-illiquid, manipulative, or rug-pull pools | **PROVISIONAL** |
| **Allowed Token Assets** | Whitelist only (e.g., WETH, WMATIC/POL, USDC, USDT) | Restricts trading strictly to high-reputation, non-rebasing tokens | **PROVISIONAL** |

---

## 2. Infrastructure & Operational Risk Limits (PROVISIONAL)

| Parameter | Provisional Baseline Value | Rationale | State |
| :--- | :--- | :--- | :--- |
| **Maximum Daily Cumulative Loss** | ₹15.00 (~15% of initial experimental capital) | Hard stop to prevent systemic balance erosion from reverts | **PROVISIONAL** |
| **Maximum Consecutive Reverted Trades** | $3$ consecutive failed transactions | Immediate circuit breaker trip to investigate network/mempool desync | **PROVISIONAL** |
| **Maximum Simulator-to-Mempool Latency** | $150\text{ ms}$ | Stale opportunities must be aborted rather than submitted late | **PROVISIONAL** |
| **RPC Discrepancy Tolerance** | 1 block height difference between providers | Prevents acting on out-of-sync or reorged node states | **PROVISIONAL** |
| **Max Pending Transactions in Flight** | 1 transaction | Enforces strict sequential nonces and eliminates nonce collision risk | **PROVISIONAL** |

---

## 3. Mandatory Risk Protocols

### 3.1 Mandatory Off-Chain Transaction Pre-Simulation
Before any live transaction calldata is dispatched to the network:
1. The transaction must be simulated against the current block state via `eth_call` or local EVM state fork.
2. If the simulated call reverts, fails to generate net profit, or exceeds gas limits, the transaction is dropped immediately.
3. No transaction may be broadcast without a successful simulation timestamp $<200\text{ ms}$ old.

### 3.2 Automated Circuit Breakers & Pause Mechanics
The off-chain engine must automatically transition to `PAUSED` state if:
- Cumulative loss over any 24-hour rolling window exceeds ₹15.00.
- Consecutive transaction failures reach 3.
- Primary RPC endpoint drops connection or fails 2 consecutive health checks.
- Rapid divergence in pool reserves ($>10\%$ shift in single block) occurs without corresponding volume.

### 3.3 Emergency Kill Switch Execution
- When the kill switch is engaged (either automatically or manually by the Human Operator):
  1. Off-chain transaction generation stops instantly.
  2. All pending/unmined transactions are checked; if necessary, replacement high-gas cancellation transactions (0 ETH transfer to self with same nonce) are broadcast.
  3. All cached market state is wiped.
  4. Telemetry dispatch alerts the operator on all configured notification channels.
  5. The system remains in `LOCKDOWN` until manually reset via signed operator command.

---

## 4. Procedure for Modifying Risk Limits

1. Any change to these provisional limits requires documented justification in `EXPERIMENTS.md` showing at least 100 simulation or testnet runs supporting the change.
2. A formal Architecture Decision Record must be approved in `DECISIONS.md`.
3. `RISK_POLICY.md` must be updated and committed before any code adjusts the runtime thresholds.
