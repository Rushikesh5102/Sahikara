# BASE_RPC_SETUP.md — How to Configure a Base RPC Endpoint

> **DOCUMENT STATUS**: ACTIVE (PHASE 1C)  
> **SECURITY NOTICE**: Never commit RPC keys to Git. `.env` is in `.gitignore`.

---

## 1. Overview

The SAHIKARA observer requires a high-quality, low-latency RPC endpoint for Base mainnet. **Public RPC endpoints (e.g., `https://mainnet.base.org`) are explicitly prohibited** per `RPC_COMPARISON.md` due to:
- Rate limiting that will interrupt polling
- Higher latency than commercial providers
- No WebSocket support for future streaming phases

---

## 2. Obtaining a Free RPC Key

### Option A: Alchemy (Recommended)

1. Go to [https://www.alchemy.com/](https://www.alchemy.com/)
2. Create a free account
3. Click **Create App**
4. Select: **Chain = Base**, **Network = Base Mainnet**
5. Copy your **HTTP URL** and **WebSocket URL**

Format:
```
HTTP: https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
WS:   wss://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

Free tier: **300M compute units/month** — sufficient for Phase 1C research polling.

### Option B: QuickNode

1. Go to [https://www.quicknode.com/](https://www.quicknode.com/)
2. Create a free account
3. Create an endpoint: **Base Mainnet**
4. Copy HTTP and WSS endpoints

---

## 3. Configure the Observer

```bash
# From the project root
cd scanner

# Copy the example env file
cp .env.example .env
```

Open `.env` in an editor and fill in the required values:

```bash
# Required
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY_HERE
BASE_WS_URL=wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY_HERE
RPC_ENDPOINT_ID=alchemy-base-free-tier

# Optional (adjust for research context)
POLL_INTERVAL_MS=30000        # 30 seconds — safe for free tier
OBSERVATION_SIZES_USD=1,5,10  # observe at $1, $5, $10
INR_USD_RATE=83.50            # update to current rate
ETH_PRICE_USD=2400            # update to current ETH price [ASSUMPTION]

# Storage
DB_PATH=./data/observations.db
```

> [!WARNING]
> **NEVER commit `.env` to Git.** The `.gitignore` in `scanner/` blocks this file, but always double-check before every commit with `git status`.

---

## 4. Install Dependencies

```bash
cd scanner
npm install
```

This installs: `viem`, `@uniswap/v3-sdk`, `better-sqlite3`, `dotenv`, and all dev dependencies.

---

## 5. Verify Installation

```bash
# Run type checking
npm run typecheck

# Run tests (no RPC required)
npm test

# Security scan
npm run lint
```

All tests should pass before running against a live RPC.

---

## 6. Run the Observer

```bash
cd scanner
npm run observe
```

Expected startup output:
```
═══════════════════════════════════════════════════════════════
 SAHIKARA — Phase 1C Market Observation Engine
 READ-ONLY MODE | No transactions | No signing | No execution
═══════════════════════════════════════════════════════════════

Chain:          Base (chain ID 8453)
RPC endpoint:   alchemy-base-free-tier
Poll interval:  30000ms
Trade sizes:    $1, $5, $10 [OBSERVATION ONLY]
...

✅ RPC connectivity verified (Base mainnet, chain ID 8453)

📦 Block: 18234567  ⛽ Gas: 0.0012 gwei  🕐 2026-09-13T...
```

---

## 7. Observation Data

The observer writes all data to the SQLite database at `DB_PATH` (default: `scanner/data/observations.db`).

To inspect collected data:
```bash
# Using sqlite3 CLI
sqlite3 scanner/data/observations.db

# View recent observations
SELECT timestamp_ms, dex, token0_symbol, token1_symbol, gross_spread_bps, status, reason_if_rejected
FROM observations
ORDER BY timestamp_ms DESC
LIMIT 20;

# Count by status
SELECT status, COUNT(*) FROM observations GROUP BY status;

# Find any candidate opportunities
SELECT * FROM observations WHERE status = 'CANDIDATE';
```

---

## 8. Rate Limit Management

| Provider | Free Tier Limit | At 30s poll, 5 pools, 3 sizes |
|---|---|---|
| Alchemy | 300M CU/month | ~45 CU/cycle × 2880 cycles/day = ~3.9M CU/day = ~117M CU/month ✅ |
| QuickNode | 10M CU/month | Tight — use longer poll interval (60s+) |

Each Uniswap v3 QuoterV2 call = ~1 CU. Each Aerodrome `getReserves + getAmountOut` = ~2 CU.

If you see `429 Too Many Requests` errors, increase `POLL_INTERVAL_MS`.

---

## 9. Stopping the Observer

Press `Ctrl+C` — the observer handles `SIGINT` gracefully:
```
[Observer] Received SIGINT. Initiating graceful shutdown...
[Observer] Shutting down...
[Observer] Database closed. Goodbye.
```

---

## 10. Security Reminder

> [!CAUTION]
> **RPC API keys are credentials.** Treat them like passwords:
> - Never share them in chat, Discord, or GitHub issues
> - Never paste them into AI tools or code assistants
> - Never commit `.env` to Git
> - Rotate the key immediately if accidentally exposed
> - Use Alchemy/QuickNode's dashboard to monitor usage for anomalies
