# SPEC.md

## 1. Architectural Overview

**Project Codename:** Forex Radar  
**Goal:** A zero-cost, statically hosted currency tracking application providing historical exchange rates from Visa, Mastercard, and ECB with dual-axis charting (Rate vs. Markup).

### 1.1 Design Philosophy
*   **Sharded CSV Data Layer:** Server-side CSV files sharded by source currency and year (`db/{FROM_CURR}/{YEAR}.csv`). No database required.
*   **Serverless Git Pattern:** The "backend" is Bun scripts running inside GitHub Actions that commit CSV changes directly to the repo.
*   **Progressive Enhancement:** Data loading priority: IndexedDB Cache → Server CSV → Live API (for gaps).

### 1.2 Data Providers
| Provider | Rate | Markup | Notes |
|----------|------|--------|-------|
| **Visa** | ✓ | ✓ | Request params are **inverted** (`from=to&to=from`) |
| **Mastercard** | ✓ | ✗ | Akamai bot detection requires `headless: false` + session management |
| **ECB** | ✓ | ✗ | Official European Central Bank reference rates |

### 1.3 Key Constraints
*   **Visa API Hard Limit:** Returns HTTP 500 for dates older than ~1 year (365 days).
*   **Mastercard Bot Detection:** Requires Chromium with `headless: false`, session refresh every 6 requests, browser restart every 18 requests.
*   **ECB Update Timing:** Rates typically update around UTC 12:00.
*   **Hosting:** GitHub Pages (static files).
*   **Compute:** GitHub Actions (Free Tier) + Bun runtime.

---

## 2. Data Model

### 2.1 Storage Layers

1.  **Server-Side (CSV Files):**
    *   **Location:** `db/{FROM_CURRENCY}/{YEAR}.csv`
    *   **Purpose:** Persistent history for all tracked pairs. Committed to Git.
    *   **Sharding:** One file per source currency per year.

2.  **Client-Side (IndexedDB):**
    *   **Database:** `ForexRadarDB`
    *   **Store:** `rates`
    *   **Purpose:** Cache for all data (server + live API). Unified storage.
    *   **Staleness:** Refreshed from server after UTC 12:00 (tracked via localStorage per currency).

### 2.2 Record Schema

**TypeScript Interface (JSDoc typedef in `shared/types.js`):**
```typescript
interface RateRecord {
  date: string;        // "YYYY-MM-DD"
  from_curr: string;   // "USD"
  to_curr: string;     // "INR"
  provider: string;    // "VISA" | "MASTERCARD" | "ECB"
  rate: number;        // 83.50102
  markup: number|null; // 0.45 (percentage) or null for ECB/Mastercard
}
```

**CSV Format (from_curr is implicit from folder):**
```csv
date,to_curr,provider,rate,markup
2024-01-01,USD,VISA,1.0892,0.45
2024-01-01,USD,MASTERCARD,1.0876,
2024-01-01,USD,ECB,1.0856,
```

---

## 3. Backend Infrastructure

### 3.1 File Structure
```text
backend/
  backfill-orchestrator.js  # Gap analysis + batch orchestration
  csv-store.js              # CSV read/write with in-memory deduplication
  daily-update.js           # GitHub Action entry point
  visa-client-batch.js      # Parallel batch fetcher (Playwright/Firefox)
  visa-client.js            # Single-request client (for daily updates)
  mastercard-client-batch.js # Sequential batch fetcher (Playwright/Chromium)
  mastercard-client.js      # Single-request client (for daily updates)
  ecb-client.js             # ECB HTML scraper
  ecb-backfill.js           # Full ECB history backfill
  watchlist.json            # Visa/Mastercard currency pairs
  ecb-watchlist.json        # ECB currencies to track
  cli.js                    # CLI argument parsing utilities
shared/
  types.js                  # JSDoc typedefs (central type definitions)
  csv-utils.js              # CSV parsing/serialization (isomorphic)
  utils.js                  # Date utilities, shared helpers
  constants.js              # Provider config (rate limits, timeouts)
```

### 3.2 Provider Clients

#### Visa Client (`backend/visa-client-batch.js`)
*   **Browser:** Firefox (headless)
*   **Concurrency:** 16 parallel requests
*   **API:** `https://www.visa.co.in/cmsapi/fx/rates`
*   **Quirk:** Currency params are **inverted** (`fromCurr=to&toCurr=from`)
*   **Response:** `originalValues.fxRateVisa` → rate, `benchmarks[0].markupWithoutAdditionalFee` → markup

#### Mastercard Client (`backend/mastercard-client-batch.js`)
*   **Browser:** Chromium (headed, anti-bot evasion)
*   **Concurrency:** Sequential (1 request at a time)
*   **Session Management:**
    *   Refresh session by visiting UI page every 6 requests
    *   Restart browser every 18 requests
    *   Pause 2 minutes on HTTP 403
*   **API:** `https://www.mastercard.co.in/settlement/currencyrate/conversion-rate`
*   **Response:** Returns error in JSON body (not HTTP codes) for out-of-range dates

#### ECB Client (`backend/ecb-client.js`)
*   **Method:** Scrapes embedded JavaScript from ECB HTML pages
*   **URL:** `https://www.ecb.europa.eu/stats/.../eurofxref-graph-{currency}.en.html`
*   **Data:** Extracts both EUR→Currency and Currency→EUR rates
*   **Output:** Provides bidirectional rates (stored in respective currency folders)

### 3.3 Backfill Orchestrator (`backend/backfill-orchestrator.js`)

**Usage:**
```bash
bun run backfill                         # Default: 365 days, all providers
bun run backfill --days=180              # Custom range
bun run backfill --provider=visa         # Single provider
bun run backfill --provider=mastercard --days=30
```

**Flow:**
1.  Load watchlist from `backend/watchlist.json`
2.  Analyze gaps: Check each date/pair/provider combination against `csv-store`
3.  Group missing data by provider
4.  Execute batch fetches (Visa parallel, Mastercard sequential)
5.  Save results to sharded CSV files

### 3.4 Daily Update (`backend/daily-update.js`)

**Trigger:** GitHub Actions cron at UTC 17:00, 19:00, 21:00, 23:00 (retry schedule)

**Flow:**
1.  Load watchlists (Visa/Mastercard pairs + ECB currencies)
2.  Determine latest available date (yesterday or today after noon)
3.  For each Visa/Mastercard pair:
    *   Check if record exists → skip if yes
    *   Fetch from API → store in CSV
4.  For each ECB currency:
    *   Fetch all historical rates → store new records
5.  On Visa/ECB failures: Auto-create GitHub issue via `gh` CLI
6.  Commit and push CSV changes

### 3.5 GitHub Actions Workflows

**`.github/workflows/daily.yml`:**
```yaml
on:
  schedule:
    - cron: '0 17 * * *'  # UTC times (retry schedule)
    - cron: '0 19 * * *'
    - cron: '0 21 * * *'
    - cron: '0 23 * * *'
  workflow_dispatch:

jobs:
  update-rates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2.1.0
      - run: bun install
      - run: bunx playwright install --with-deps chromium
      - run: xvfb-run bun run daily  # Headed browser needs display
      - run: git add db/ && git commit -m "auto: daily rates update" && git push
```

**`.github/workflows/deploy.yml`:**
*   Triggers on push to `main` or after daily update workflow completes
*   Deploys entire repo to GitHub Pages

---

## 4. Frontend Architecture

### 4.1 File Structure
```text
js/
  app.js              # Main application, UI event handlers
  data-manager.js     # Data orchestration (cache/server/live)
  storage-manager.js  # IndexedDB operations + staleness tracking
  csv-reader.js       # Server CSV fetching
  chart-manager.js    # ApexCharts configuration + rendering
  visa-client.js      # Browser-side Visa API client (via CORS proxy)
  mastercard-client.js# Browser-side Mastercard API client (via CORS proxy)
  currencies.js       # Currency metadata (code, name, symbol)
  theme.js            # Dark/light mode toggle
  animations.js       # UI animations
```

### 4.2 Data Manager (`js/data-manager.js`)

**Progressive Enhancement Flow:**
```
1. Check IndexedDB cache (fastest)
   ↓
2. If stale (after UTC 12:00), fetch server CSV files
   ↓
3. Merge: Create Map<"date:provider", RateRecord>
   - Insert server records
   - Overwrite with cache records (fresher)
   ↓
4. Check for gaps (latest data < yesterday)
   ↓
5. Live Fetch Loop (fills gaps):
   - Fetch from Visa/Mastercard APIs via CORS proxy
   - Save each record to IndexedDB immediately
   - Stop on HTTP 500 (end of history) or HTTP 429/403 (rate limit)
   ↓
6. Return merged records sorted by date ASC
```

**Cache Staleness (`js/storage-manager.js`):**
*   Each source currency has its own refresh timestamp (localStorage)
*   Data is stale if last refresh was before most recent UTC 12:00
*   Staleness check: `lastRefreshDate < getLastUTC12pm()`

### 4.3 CSV Reader (`js/csv-reader.js`)

*   Discovers available years by probing `db/{FROM_CURR}/{YEAR}.csv`
*   Fetches only year files that overlap with requested date range
*   Returns records split by provider for independent series display

### 4.4 Browser API Clients

Both `js/visa-client.js` and `js/mastercard-client.js` use a CORS proxy (`https://api.allorigins.win/raw?url=`) to bypass browser restrictions.

---

## 5. Frontend UI

### 5.1 Layout (HTML/Tailwind)
*   **Header:** Animated radar logo + dark/light theme toggle
*   **Hero Section:** Radar-inspired design with currency symbol blips
*   **Currency Selectors:** Two dropdowns (From, To) with top 10 currencies prioritized
*   **Time Range Selector:** 1M, 3M, 6M, 1Y, 5Y, All buttons
*   **Series Toggles:** Checkboxes for Visa Rate, Mastercard Rate, ECB Rate, Visa Markup
*   **Stats Bar:** Current rate, High, Low, Markup (dynamically filtered by visible date range)
*   **Chart Container:** ApexCharts multi-series line chart
*   **Notifications:** Toast system for progress/error feedback

### 5.2 Chart Configuration (ApexCharts)
**Type:** Multi-series Line Chart with dual Y-axes

**Series:**
| Series | Y-Axis | Color | Style |
|--------|--------|-------|-------|
| Visa Rate | Left | Emerald (#10b981) | Solid |
| Mastercard Rate | Left | Red (#ef4444) | Solid |
| ECB Rate | Left | Blue (#3b82f6) | Solid |
| Visa Markup (%) | Right | Amber (#f59e0b) | Dotted |

**Features:**
*   Shared tooltip with crosshairs
*   Smooth curves (bezier interpolation)
*   Zoom/pan with date range preservation
*   Series visibility toggles (show/hide individual series)
*   Stats recalculation on zoom (filters to visible range)

### 5.3 Event Handling
*   Currency dropdown `change` → Debounced (300ms) → `DataManager.fetchRates()` → Update chart
*   Time range button click → Filter data → Update chart + stats
*   Series toggle checkbox → `ChartManager.setSeriesVisibility()` → Show/hide series

---

## 6. Operational Guide

### 6.1 Adding New Currency Pairs

1.  Add pair to `backend/watchlist.json`:
    ```json
    { "from": "USD", "to": "JPY" }
    ```
2.  Run backfill: `bun run backfill --provider=all`
3.  Commit and push CSV files
4.  Daily Action will maintain it going forward

### 6.2 Adding New ECB Currencies

1.  Add currency code to `backend/ecb-watchlist.json`
2.  Run: `bun run ecb-backfill`
3.  Commit and push

### 6.3 CLI Commands
```bash
bun run daily              # GitHub Actions entry point
bun run backfill           # Backfill with gap analysis (--days=N --provider=visa|mastercard|all)
bun run ecb-backfill       # Full ECB historical backfill
bun run validate           # Validate CSV data integrity
bun run typecheck          # TypeScript type checking (JSDoc-based)
```

---

## 7. Coding Standards

1.  **Runtime:** Bun for backend, vanilla ES modules for frontend
2.  **Type Safety:** JSDoc typedefs in `shared/types.js`. Import with:
    ```javascript
    /** @typedef {import('../shared/types.js').RateRecord} RateRecord */
    ```
3.  **Module Pattern:** Each file has `@module` JSDoc tag. ES modules with explicit `.js` extensions.
4.  **Separation of Concerns:**
    *   Clients → API interaction only
    *   StorageManager → IndexedDB operations only
    *   CSVStore/CSVReader → CSV file operations only
    *   DataManager → Orchestration logic
    *   ChartManager → ApexCharts configuration
    *   App → UI event handling
5.  **Date Handling:** Always use `parseDate()`/`formatDate()` from `shared/utils.js` (avoids timezone issues)
6.  **Notifications:** Custom toast system (no `alert()`)
7.  **Debouncing:** Dropdown changes debounced at 300ms