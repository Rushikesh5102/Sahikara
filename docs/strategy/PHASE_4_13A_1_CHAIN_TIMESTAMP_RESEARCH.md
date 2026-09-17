# PHASE 4.13A.1: Blockchain Timestamp Semantics Across Target Networks

> **PHASE**: 4.13A.1 (Measurement Forensics Only)  
> **CANONICAL SUBJECT**: Architectural and protocol-level timestamp semantics  
> **STATUS**: RESEARCH ONLY / EXECUTION STRICTLY LOCKED  

---

## 1. Overview & Research Question

To establish whether `block.timestamp` can legitimately serve as a baseline for latency calculations, this document examines the exact protocol specifications and consensus rules governing timestamp assignment across Base, Arbitrum One, OP Mainnet, and Polygon PoS.

---

## 2. Network-by-Network Protocol Analysis

### A. Base & OP Mainnet (OP Stack Architecture)
- **Specification**: Optimism Bedrock / OP Stack Rollup Consensus Specification.
- **Block Time**: Fixed at exactly **2.0 seconds** ($\Delta t = 2$).
- **Timestamp Rules**:
  - Every L2 block must satisfy:
    $$\text{block.timestamp} = \text{parent.timestamp} + 2$$
  - The centralized sequencer increments the block timestamp by exactly 2 seconds for every sequential block height.
- **Sub-Second Granularity**: **None**. Timestamps are strictly quantized to even integer seconds.
- **Relationship to Transaction Execution**:
  - Transactions executed at $t = 14.1\text{s}$, $t = 14.8\text{s}$, and $t = 15.9\text{s}$ are all sealed within a block stamped $t = 16\text{s}$.
  - Subtracting `block.timestamp` from local machine arrival time will inevitably produce a value between $0$ and $2,000\text{ ms}$ purely due to **block slot quantization**, regardless of network speed.

### B. Arbitrum One (Arbitrum Nitro Architecture)
- **Specification**: Arbitrum Nitro Whitepaper & Time-Boost Specification.
- **Block Time**: Dynamic micro-blocks produced on demand ($\approx 250\text{ ms}$).
- **Timestamp Rules**:
  - The Nitro sequencer assigns `block.timestamp` based on its local server clock, bounded by the underlying Ethereum L1 block time:
    $$\text{L1BlockTime} - \text{TimeWindow} \le \text{block.timestamp} \le \text{L1BlockTime} + \text{TimeWindow}$$
  - Because multiple Nitro micro-blocks can be minted within a single second, multiple consecutive blocks often share the **exact same integer timestamp**.
- **Sub-Second Granularity**: EVM `block.timestamp` does not expose fractional seconds; micro-block order is determined by `blockNumber` and transaction index, not timestamp.

### C. Polygon PoS (Heimdall + Bor Architecture)
- **Specification**: Polygon Bor (Geth-derived) Consensus Documentation.
- **Block Time**: Approximately $2.0–2.2\text{ seconds}$.
- **Timestamp Rules**:
  - The active Bor block producer sets `block.timestamp` using its local server clock.
  - The consensus validation rule enforces:
    $$\text{parent.timestamp} < \text{block.timestamp} \le \text{validator.localTime} + \text{maxClockDrift}$$
  - Validators do not share a single synchronized clock; individual validator NTP offsets drift by hundreds of milliseconds.
- **Empirical Evidence in SAHIKARA**:
  - During live benchmarking, Polygon reference deltas dropped to **$-1,223\text{ ms}$**, proving that a Bor validator's clock was ahead of the client machine's clock by over 1 second.

---

## 3. Comparative Summary

| Parameter | Base (OP Stack) | Arbitrum One (Nitro) | OP Mainnet (OP Stack) | Polygon PoS (Bor) |
| :--- | :--- | :--- | :--- | :--- |
| **Block Slot Time** | $2.0\text{ s}$ (fixed) | $\approx 0.25\text{ s}$ (dynamic) | $2.0\text{ s}$ (fixed) | $\approx 2.0\text{ s}$ (sprint) |
| **Timestamp Increment** | Exactly $+2\text{ s}$ per block | $\ge 0\text{ s}$ (identical for micro-blocks)| Exactly $+2\text{ s}$ per block | $+1\text{ to }+3\text{ s}$ variable |
| **Quantization Step** | $2,000\text{ ms}$ | $1,000\text{ ms}$ (integer sec) | $2,000\text{ ms}$ | $1,000\text{ ms}$ |
| **Server Clock Source** | Centralized Sequencer | Centralized Sequencer | Centralized Sequencer | Rotating Validator Set |
| **Sub-Second Precision**| Absent | Absent | Absent | Absent |

---

## 4. Epistemic Conclusion

`block.timestamp` is a state-progression counter designed for EVM smart contract logic (e.g. vesting schedules, deadline expirations, TWAP calculations). It is **not** a physical timestamp of when an event traversed the network. Treating `block.timestamp` as a stopclock for sub-second network latency is fundamentally invalid under all EVM consensus specifications.
