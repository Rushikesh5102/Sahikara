# TOKEN_PAIR_RESEARCH.md — Liquid Candidate Asset & Pair Investigation

> **DOCUMENT STATUS**: ACTIVE RESEARCH (PHASE 1)  
> **POLICY**: Strictly investigative. **No token pairs are whitelisted at this stage.**  
> **OBJECTIVE**: Identify high-liquidity, low-friction token pairs capable of sustaining positive net profit on small trade sizes ($1–$100).

---

## 1. Candidate Asset Evaluation

To prevent catastrophic losses from token-specific vulnerabilities, SAHIKARA will only evaluate tokens meeting these non-negotiable criteria:
- **No transfer taxes or burn-on-transfer mechanics** (e.g., standard ERC-20 compliance).
- **No algorithmic or uncollateralized rebase mechanisms** (e.g., stETH rebasing can desync internal balance tracking; wstETH or plain WETH preferred).
- **Deep multi-DEX liquidity** ($\ge \$500,000$ aggregate liquidity across target DEXs).
- **High daily secondary market trading volume** ($\ge \$1,000,000 / \text{day}$).

### Evaluated Assets

| Token Symbol | Asset Type | Decimals | Standard Contract on Polygon PoS | Standard Contract on Base |
| :--- | :--- | :---: | :--- | :--- |
| **USDC** (Native) | Fiat-backed Stablecoin | 6 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **USDT** | Fiat-backed Stablecoin | 6 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` (Bridged) |
| **WETH** | Wrapped Native Ether | 18 | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` | `0x4200000000000000000000000000000000000006` |
| **WMATIC / POL** | Wrapped Native Gas Token | 18 | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | N/A (Polygon native) |
| **WBTC** | Wrapped Bitcoin | 8 | `0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6` | `0x0555E30da8f98308EdB960aa94C0Db47230d2B9c` (cbBTC) |

*Note: Addresses are cataloged for documentation and research only; no contracts will interact with them until authorized in Phase 6/8.*

---

## 2. Cross-DEX Pair Profiles & Spread Dynamics

### Pair A: WMATIC/POL — USDC (Polygon Target)
- **`[FACT]` Liquidity Distribution**:
  - **QuickSwap**: Deep pools in both v2 (0.3%) and v3 concentrated Algebra ($>\$5\text{M}$ combined TVL).
  - **Uniswap v3**: Massive liquidity in the 0.05% fee tier ($>\$8\text{M}$ TVL) and 0.30% fee tier.
- **`[FACT]` Volatility Profile**: High intraday volatility (beta vs BTC/ETH > 1.2), generating frequent pool rebalancing volume from retail and aggregators.
- **`[HYPOTHESIS]` Arbitrage Viability**: Highest probability of recurring spatial divergence on Polygon. Because the fee tier on Uniswap v3 is 5 bps ($0.05\%$) while QuickSwap v2 is 30 bps ($0.30\%$), a gross divergence exceeding $0.35\%$ is necessary for a two-hop cycle to clear fees before gas.

### Pair B: WETH — USDC (Multi-Chain Target)
- **`[FACT]` Liquidity Distribution**: The single most liquid crypto trading pair in global DeFi.
  - Deployed on Uniswap v3 (0.05% tier) across Polygon, Base, Arbitrum, and Optimism.
  - Deployed on Aerodrome (Base) and QuickSwap (Polygon).
- **`[FACT]` Volatility Profile**: Benchmark institutional volatility. Highest frequency of updates from CEX-DEX arbitrage bots (Wintermute, GSR, Jump, etc.).
- **`[ASSUMPTION]` Arbitrage Viability for ₹100 Capital**: Low. Institutional CEX-DEX market makers maintain the WETH/USDC spread tightly within $\pm 0.05\%$. Micro-capital bots relying on spatial cross-DEX spreads will rarely see a spread wide enough to clear gas unless during extreme market flash crashes.

### Pair C: USDC — USDT (Stablecoin Peg Arbitrage)
- **`[FACT]` Liquidity Distribution**:
  - Extremely deep concentrated liquidity in Uniswap v3 `100` fee tier ($0.01\%$) and Curve 3pool/2pool.
- **`[FACT]` Volatility Profile**: Minimal volatility; nominal range typically \$0.9995 to \$1.0005.
- **`[FACT]` Price Impact for ₹100**: Virtually zero price impact at $\$1.20$ trade size.
- **`[ASSUMPTION]` Arbitrage Viability for ₹100 Capital**: Fails economically. A typical spread between USDC and USDT is $0.02\%$ to $0.05\%$ ($2\text{ to }5\text{ bps}$). On a $\$1.20$ trade size, a $0.05\%$ gross gain equals $\$0.0006$, which cannot even cover a $\$0.003$ gas fee. Stablecoin peg arbitrage requires large capital ($>\$10,000$) to generate executable net yield.

---

## 3. Pair Comparison Matrix

| Candidate Pair | Volatility | Typical Gross Spread | Combined DEX Fees | Net Spread Margin | Price Impact ($Q=\$1.20$) | Viability Rating (Micro-Capital) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **WMATIC / USDC** | High | 0.20% – 0.60% | 0.10% – 0.35% | **Positive (+0.10% to +0.25%)** | $<0.001\%$ | **HIGH (Prime Candidate)** |
| **WETH / USDC** | Medium | 0.05% – 0.15% | 0.10% – 0.35% | Negative / Near Zero | $<0.001\%$ | MEDIUM (Requires High Volatility) |
| **WBTC / USDC** | Medium | 0.05% – 0.20% | 0.10% – 0.35% | Negative / Near Zero | $<0.001\%$ | LOW (CEX-DEX dominated) |
| **USDC / USDT** | Ultra-Low | 0.01% – 0.04% | 0.02% – 0.08% | **Severely Negative** | $<0.0001\%$ | **UNVIABLE for ₹100** |

---

## 4. Key Takeaways & Research Guidelines

1. **Reject Stable-to-Stable Pairs for Phase 8 Experiment**:
   - Despite minimal price risk, the microscopic percentage spread on stable-to-stable pairs ($<0.05\%$) makes them mathematically incapable of covering base gas on ₹100 capital.
2. **Focus on Volatile-to-Stable Pairs**:
   - The primary research focus for Phase 1 data collection must be **Native Token vs. USDC** (e.g., WMATIC/USDC on Polygon, or WETH/USDC on Base). These pairs exhibit retail volume spikes that frequently overwhelm pool equilibrium before MEV bots clear them.
3. **No Pair Whitelisting Until Phase 2**:
   - Whitelisting of specific pool addresses will only occur after empirical spread frequency is logged via historical RPC scripts in Phase 1B.
