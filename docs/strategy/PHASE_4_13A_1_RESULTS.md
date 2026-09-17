# PHASE 4.13A.1: Empirical Results & Latency Reclassification Dossier

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL DATASET**: `scanner/data/temporal_forensics_phase413a1_results.json`  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED / PHASE 5 BLOCKED  

---

## 1. Executive Summary of Results

Phase 4.13A.1 successfully executed an empirical and architectural forensic audit of the timing measurements reported in Phase 4.13A. The investigation delivered four definitive conclusions:

1. **Reclassification of the ~1.98s Figure**:
   > *"The previously reported ~1.98 s event observation latency was not a valid measurement of RPC/network latency and has been reclassified."*
   The figure was produced by a combination of (a) an in-runner synthetic offset (`Date.now() - 2000`) used to model block lag, and (b) an uncalibrated cross-domain subtraction (`localWallClock - block.timestamp`) that conflates sequencer slot quantization ($2.0\text{ s}$ on OP Stack rollups) with network transit time.

2. **True Network RPC Latency Quantified**:
   Using hardware-backed monotonic nanosecond clocks (`process.hrtime.bigint()`), real public RPC request/response duration was measured across 160 controlled requests ($N=20$ per method/chain):
   - **Base**: Median **$247.50\text{ ms}$** (mean $252.94\text{ ms}$).
   - **Arbitrum One**: Median **$239.18\text{ ms}$** (mean $285.95\text{ ms}$).
   - **Polygon PoS**: Median **$162.80\text{ ms}$** (mean $195.30\text{ ms}$).
   - **OP Mainnet**: Median **$411.08\text{ ms}$** (mean $455.59\text{ ms}$).

3. **Event Observation Latency Formally Classified**:
   Because public EVM JSON-RPC nodes do not provide synchronized, sub-second event emission timestamps, true event observation latency is formally classified as:
   $$\text{EVENT\_OBSERVATION\_LATENCY} = \mathbf{UNMEASURABLE\_WITHOUT\_SYNCHRONIZED\_ORIGIN}$$

4. **Internal Pipeline Efficiency Confirmed**:
   From event delivery to economic decision, the entire in-memory evaluation pipeline concludes in **$16.21\text{ ms}$** (median), confirming that local computational latency is completely negligible.

---

## 2. Canonical Latency Benchmark Table

| Metric | Formal Definition | Clock Domain | Sample | Min | Median | p95 | Max | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Base HTTP Full Block** | $T_{\text{res}} - T_{\text{req}}$ (`eth_getBlock`) | `LOCAL_MONOTONIC` | 20 | $227.26\text{ ms}$ | **$247.50\text{ ms}$** | $344.64\text{ ms}$ | $344.64\text{ ms}$ | **MEASURED** |
| **Arbitrum HTTP Full Block** | $T_{\text{res}} - T_{\text{req}}$ (`eth_getBlock`) | `LOCAL_MONOTONIC` | 20 | $231.71\text{ ms}$ | **$239.18\text{ ms}$** | $1016.29\text{ ms}$| $1016.29\text{ ms}$| **MEASURED** |
| **Optimism HTTP Full Block** | $T_{\text{res}} - T_{\text{req}}$ (`eth_getBlock`) | `LOCAL_MONOTONIC` | 20 | $400.96\text{ ms}$ | **$411.08\text{ ms}$** | $1234.18\text{ ms}$| $1234.18\text{ ms}$| **MEASURED** |
| **Polygon HTTP Full Block** | $T_{\text{res}} - T_{\text{req}}$ (`eth_getBlock`) | `LOCAL_MONOTONIC` | 20 | $147.24\text{ ms}$ | **$162.80\text{ ms}$** | $345.77\text{ ms}$ | $345.77\text{ ms}$ | **MEASURED** |
| **Base Block Number Ping** | $T_{\text{res}} - T_{\text{req}}$ (`eth_blockNumber`)| `LOCAL_MONOTONIC` | 20 | $0.031\text{ ms}$ | **$0.082\text{ ms}$** | $408.89\text{ ms}$ | $408.89\text{ ms}$ | **MEASURED** |
| **Event Log Decode** | $T_6 - T_5$ (local log parsing) | `LOCAL_MONOTONIC` | 100 | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.000\text{ ms}$ | $0.001\text{ ms}$ | **MEASURED** |
| **Route Index Lookup** | $T_7 - T_6$ (O(1) pool route map) | `LOCAL_MONOTONIC` | 100 | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.001\text{ ms}$ | $0.002\text{ ms}$ | **MEASURED** |
| **Multi-Leg Quote Query** | $T_9 - T_8$ (adapter pool quote) | `LOCAL_MONOTONIC` | 40 | $15.45\text{ ms}$ | **$16.19\text{ ms}$** | $29.54\text{ ms}$ | $30.11\text{ ms}$ | **MEASURED** |
| **Economic Math Evaluation** | $T_{10} - T_9$ (fee/gas/spread math)| `LOCAL_MONOTONIC` | 100 | $0.000\text{ ms}$ | **$0.000\text{ ms}$** | $0.001\text{ ms}$ | $0.001\text{ ms}$ | **MEASURED** |
| **Total Event Pipeline** | $T_{10} - T_5$ (receive to decision)| `LOCAL_MONOTONIC` | 40 | $15.47\text{ ms}$ | **$16.21\text{ ms}$** | $29.56\text{ ms}$ | $30.13\text{ ms}$ | **MEASURED** |
| **WS vs HTTP Difference** | $T_{\text{HTTP\_res}} - T_{\text{WS\_res}}$ | `LOCAL_MONOTONIC` | — | — | — | — | — | **UNAVAILABLE** (WS Timeout)|
| **Event Observation Latency**| On-chain emission $\to$ Local | Cross-Domain | — | — | — | — | — | **UNMEASURABLE** |

---

## 3. Diagnostic Timestamp Reference Delta Distributions

$$\text{TIMESTAMP\_REFERENCE\_DELTA} = \text{Date.now()}_{\text{local}} - (\text{block.timestamp}_{\text{protocol}} \times 1000)$$

| Chain | Sample | Min | p25 | Median | p75 | p90 | p95 | Max | Mean |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Base** | 20 | $69\text{ ms}$ | $792\text{ ms}$ | **$1,243\text{ ms}$** | $1,714\text{ ms}$ | $2,262\text{ ms}$ | $2,572\text{ ms}$ | $2,572\text{ ms}$ | $1,253.6\text{ ms}$ |
| **Arbitrum One** | 20 | $858\text{ ms}$ | $1,059\text{ ms}$ | **$1,616\text{ ms}$** | $1,885\text{ ms}$ | $2,058\text{ ms}$ | $2,058\text{ ms}$ | $2,058\text{ ms}$ | $1,543.6\text{ ms}$ |
| **OP Mainnet** | 20 | $183\text{ ms}$ | $1,114\text{ ms}$ | **$1,891\text{ ms}$** | $2,216\text{ ms}$ | $2,641\text{ ms}$ | $3,014\text{ ms}$ | $3,014\text{ ms}$ | $1,715.2\text{ ms}$ |
| **Polygon PoS** | 20 | $-1,223\text{ ms}$| $-615\text{ ms}$ | **$360\text{ ms}$** | $844\text{ ms}$ | $1,219\text{ ms}$ | $1,341\text{ ms}$ | $1,341\text{ ms}$ | $171.4\text{ ms}$ |

*Key Takeaway*: On Polygon PoS, the minimum delta was $-1,223\text{ ms}$, conclusively disproving that reference deltas measure physical propagation latency.

---

## 4. Economic Status

- **Authentic Positive Opportunities**: 0.
- **Canonical Statement**: *"No authentic positive opportunity was observed in the Phase 4.13A campaign."*
- **Opportunity Lifetime**: Remains **`UNKNOWN`** (no authentic positive opportunities formed to observe duration).
