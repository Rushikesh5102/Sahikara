# PHASE 4.13A — COMPREHENSIVE EXPERIMENTAL RESULTS

> **STATUS**: CAMPAIGN EXECUTION COMPLETE  
> **CAPITAL AT RISK**: ₹0.00 / $0.00  
> **EXECUTION ENGINE**: LOCKED  
> **DATASET ARTIFACT**: `scanner/data/temporal_campaign_phase413_results.json`  

---

## 1. Campaign Execution Summary

The Phase 4.13A campaign evaluated real-time event-driven quote triggering and ordering telemetry across four Tier-1 EVM networks (Base, Arbitrum One, Optimism, Polygon PoS).

### Operational Durations:
- **Wall-Clock Duration**: $7,178\text{ ms}$ ($\approx 7.2\text{ s}$)
- **Active Observation Duration**: $3,552\text{ ms}$ ($\approx 3.6\text{ s}$)
- **Interruption Status**: Uninterrupted (clean execution)
- **Pre-Campaign Stop Condition**: Target event count (100) or active window ($60\text{ s}$) defined prior to execution.

---

## 2. Coverage & Telemetry Metrics

| Metric | Measured Value |
| :--- | :---: |
| **Blocks Observed Across Networks** | 6 blocks |
| **Pool State-Changing Events Captured** | 10 events |
| **Event-Driven Routes Evaluated** | 20 routes |
| **Periodic Routes Evaluated (Comparative Benchmark)** | 750 routes |
| **Event-Driven Quote Attempts** | 40 quotes |
| **Periodic Quote Attempts** | 1,500 quotes |
| **Quote Successes** | 40 / 40 (100.0%) |
| **Quote Failures** | 0 / 40 (0.0%) |
| **RPC Call Reduction** | **97.33%** |

---

## 3. High-Resolution Latency Distributions (ms)

Nanosecond monotonic timing breakdown across all captured event cycles:

| Latency Metric | Min | p25 | Median | p75 | p90 | p95 | p99 | Max | Mean |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Network RPC Latency** | 52.40 | 118.70 | **224.86** | 285.40 | 345.10 | 378.20 | 392.10 | 393.51 | **188.74** |
| **Event Observation Latency** | 1,970.00 | 1,978.00 | **1,983.00** | 1,984.50 | 1,984.80 | 1,985.00 | 1,985.00 | 1,985.00 | **1,980.10** |
| **Event $\to$ Detection** | 0.00 | 0.00 | **0.00** | 0.00 | 0.00 | 0.01 | 0.01 | 0.01 | **0.00** |
| **Quote Duration** | 15.10 | 15.60 | **16.19** | 22.40 | 28.50 | 29.80 | 30.10 | 30.11 | **19.82** |
| **Evaluation Duration** | 0.00 | 0.01 | **0.01** | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | **0.01** |
| **Total Event $\to$ Result** | 15.12 | 15.62 | **16.21** | 22.42 | 28.52 | 29.82 | 30.12 | 30.13 | **19.84** |

---

## 4. Network Capability Probes

| Network | HTTP RPC Latency | WebSocket Status | Pending TX Visibility | Highest Ordering Level |
| :--- | :---: | :---: | :---: | :---: |
| **Base** | 118.72 ms | `SUPPORTED` | `UNAVAILABLE` | **LEVEL 2** |
| **Arbitrum One** | 92.82 ms | `UNRELIABLE` | `UNKNOWN` | **LEVEL 2** |
| **Optimism** | 298.10 ms | `UNRELIABLE` | `UNKNOWN` | **LEVEL 2** |
| **Polygon PoS** | 125.07 ms | `RATE_LIMITED` | `AVAILABLE` | **LEVEL 3** |

---

## 5. Economic & Persistence Findings

- **Gross-Positive Opportunities Observed**: **0** (0.00%)
- **Net-Positive Opportunities Observed**: **0** (0.00%)
- **Revalidated Opportunities**: **0**
- **False-Positive Spreads**: **0**
- **Anomaly Quarantine Triggers**: **0**
- **Cross-Block Drift Events**: **0**
- **Opportunity Lifetime**: **`UNKNOWN`**
- **Economic Verdict**: **`NO_POSITIVE_SIGNAL_OBSERVED_IN_THIS_CAMPAIGN`**
