# PHASE 4.13B — Opportunity Forensics & Signal Validation

> **DIRECTIVES 27, 28, 29, 52**: Independent recalculation for all positive candidates. Aggressive false-positive defense.

---

## 1. Candidate Opportunity Audit

During the controlled observation campaign across 192 evaluations:
- **Raw Gross Positives**: 12 candidates observed with positive gross spread ($+0.11\text{ to }+0.35\text{ bps}$).
- **Raw Net Positives**: 0 candidates observed with positive net profit after fees.
- **Authentic Gross Positives**: 12 candidates verified.
- **Authentic Net Positives**: 0 candidates verified.
- **Revalidated Net Positives**: 0 candidates verified.

---

## 2. Forensic Audit of the 12 Authentic Gross Candidates

Each of the 12 gross-positive observations occurred on the `CEX_TO_DEX` direction when CEX ask prices briefly dipped slightly below DEX executable sell prices:

```
Example Candidate Observation:
- Venue: Binance ETHUSDC vs Base Uniswap V3 WETH/USDC (0.05%)
- Direction: CEX -> DEX
- Notional Sizes: $10, $25, $50, $100, $250, $500, $1,000, $5,000
- CEX Best Ask: 2460.65 USDC
- CEX VWAP Price: 2460.65 to 2460.68 USDC
- DEX Executable Sell Price: 2460.73 USDC
- Raw Gross Spread: +0.33 to +0.35 bps
```

### Forensic Gate Checks:
1. **Asset Mapping Check**: PASS (`WETH/USDC` canonically bound to `0x4200...0006` and `0x8335...2913`).
2. **Data Staleness Check**: PASS (CEX data age $< 850\text{ ms}$, DEX quote age $< 1,200\text{ ms}$).
3. **Order Book Bid/Ask Integrity**: PASS (Coinbase and Binance books strictly ordered with positive spread).
4. **Depth Verification**: PASS (All trade sizes up to \$5,000 fully filled without extrapolation).
5. **Anomaly Quarantine Boundary**: PASS (Spread $+0.35\text{ bps}$ well within the $1,000\text{ bps}$ threshold).
6. **Independent Recalculation**: PASS (Secondary calculation matched primary calculation with $0.0000\text{ bps}$ deviation).

### Net Profit Verdict:
- Gross spread: $+0.35\text{ bps}$
- Less CEX Taker Fee: $-10.00\text{ bps}$
- Less DEX Gas: $-0.04\text{ bps}$ (at \$5,000)
- Less Risk Buffer: $-10.00\text{ bps}$
- **Net Spread: $-19.69\text{ bps}$ (Net PnL: $-\$9.85$ on \$5,000 notional)**.
- **Conclusion**: The opportunity was **AUTHENTIC IN GROSS PRICE**, but **UNVIABLE ECONOMICALLY**.
