# PHASE 4.15 — Cross-Venue Synchronization Architecture & Contemporaneity

> **STATUS**: PRELIMINARY TRANSPORT PROBE COMPLETE  
> **SCOPE**: Synchronization models, pipeline decomposition, and contemporaneity classifications.

---

## 1. Cross-Venue Synchronization Model

In high-frequency cross-venue arbitrage, two market states from disparate venues (CEX and DEX) can only be considered "contemporaneous" if the time elapsed between their respective states is smaller than the interval over which prices remain static.

### Pipeline Decomposition

For every cross-venue observation, SAHIKARA decomposes the latency pipeline into discrete, non-overlapping intervals:

$$\Delta t_{\text{pipeline}} = \Delta t_{\text{CEX, receipt}} + \Delta t_{\text{local, dispatch}} + \Delta t_{\text{DEX, roundtrip}} + \Delta t_{\text{local, eval}}$$

1. **$\Delta t_{\text{CEX, receipt}}$ (CEX Receipt Latency)**:
   - Elapsed monotonic duration between WebSocket frame arrival on network interface and order-book state update.
   - Measured via `performance.now()` in `CexWebSocketFeed.ts`: typical duration **0.05 ms – 0.25 ms**.
2. **$\Delta t_{\text{local, dispatch}}$ (Local Dispatch Latency)**:
   - Time required to detect order-book depth change and construct QuoterV2 `eth_call` payload.
   - Measured in memory: typical duration **0.10 ms – 0.50 ms**.
3. **$\Delta t_{\text{DEX, roundtrip}}$ (DEX QuoterV2 Round-Trip Latency)**:
   - Time from transmitting `eth_call` to receiving decoded quote.
   - Measured in Phase 4.15 preliminary probe: **456.08 ms – 641.67 ms**.
4. **$\Delta t_{\text{local, eval}}$ (Economic Accounting Latency)**:
   - In-memory execution of VWAP, taker fee, gas fee, risk buffer, and net spread calculation in `CrossVenueEconomics.ts`.
   - Measured in memory: **0.02 ms – 0.08 ms**.

### Pipeline Totals & Uncertainty
The dominant component of the synchronization pipeline is $\Delta t_{\text{DEX, roundtrip}}$, accounting for $> 99.8\%$ of total elapsed time. The local processing stages contribute $< 1.0\text{ ms}$ combined.

---

## 2. Block Contemporaneity Classification

Every DEX quote must be correlated with on-chain consensus state:

| Block Classification | Definition |
|---|---|
| **`SAME_BLOCK`** | DEX quote and CEX observation occur strictly within the same block interval (demonstrated via block hash and event ordering). |
| **`PREVIOUS_BLOCK`** | DEX quote was evaluated against the block immediately preceding the CEX observation. |
| **`MULTI_BLOCK`** | DEX quote reflects state that is two or more blocks older than the CEX observation. |
| **`UNKNOWN`** | Exact block synchronization cannot be established without clock assumptions. |

On Base mainnet, blocks are produced every **2.0 seconds** (2,000 ms). During an elapsed quote interval of 500 ms – 650 ms, the probability of crossing a block boundary during transport is approximately $25\% - 32\%$.

---

## 3. Synchronization Feasibility Categories

SAHIKARA defines four mathematical categories for cross-venue contemporaneity:

### Category A: MEASURABLY CONTEMPORANEOUS
- **Criterion**: Total pipeline latency $\Delta t_{\text{pipeline}} \le 100\text{ ms}$, with deterministic block attribution and verified order-book depth validity throughout the interval.
- **Economic Viability**: Supports authentic, executable cross-venue opportunity evaluation.

### Category B: PARTIALLY CONTEMPORANEOUS
- **Criterion**: $100\text{ ms} < \Delta t_{\text{pipeline}} \le 400\text{ ms}$.
- **Economic Viability**: Usable for high-frequency sensitivity research; boundary block transitions must be tracked and labeled.

### Category C: TRANSPORT-LIMITED
- **Criterion**: $\Delta t_{\text{pipeline}} > 400\text{ ms}$.
- **Economic Viability**: Unsuitable for establishing executable cross-venue arbitrage. Comparisons must be classified as `ASYNCHRONOUS_COMPARISON`.
- **Current Finding**: Across the six measured QuoterV2 requests, observed round-trip latency ranged from 456 ms to 642 ms from the tested client environment, placing the tested public RPC configuration squarely in **Category C**.

### Category D: UNMEASURABLE
- **Criterion**: Origin timestamps, sequence identifiers, or monotonic elapsed timers are missing or conflate clock domains.
- **Economic Viability**: Methodologically invalid; results must be discarded.
