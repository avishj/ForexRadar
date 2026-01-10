# ForexRadar Copilot Instructions

## Project Overview
ForexRadar is a zero-cost, statically-hosted currency tracking app that displays historical Visa, Mastercard, and ECB exchange rates with dual-axis charting (Rate vs. Markup). The architecture uses a **Serverless Git Pattern** where GitHub Actions runs Node.js scripts to populate CSV data files that are committed to the repo and served via GitHub Pages.

## Architecture

### Data Flow
1. **Backend scripts** (Bun) fetch rates from provider APIs → write to `db/{CURRENCY}/{YEAR}.csv`
2. **GitHub Actions** commits CSV changes to repo → triggers GitHub Pages deploy
3. **Frontend** (vanilla JS) fetches CSVs via HTTP → caches in IndexedDB → renders with ApexCharts

### Directory Structure
- `backend/` - Bun scripts for data ingestion (backfill, daily updates)
- `js/` - Frontend modules (data-manager, chart-manager, clients)
- `shared/` - Isomorphic utilities shared between frontend/backend (types, csv-utils, utils)
- `db/{CURRENCY}/` - Sharded CSV files by source currency and year

### Key Files
- [shared/types.js](shared/types.js) - Central type definitions (JSDoc typedefs)
- [shared/csv-utils.js](shared/csv-utils.js) - CSV parsing/serialization shared by both sides
- [backend/watchlist.json](backend/watchlist.json) - Currency pairs to track
- [backend/ecb-watchlist.json](backend/ecb-watchlist.json) - Currencies for ECB data

## Commands
```bash
bun run daily              # Daily update (GitHub Actions entry point)
bun run backfill           # Manual backfill using orchestrator (--days=N --provider=visa|mastercard|all)
bun run ecb-backfill       # Backfill ECB historical data
bun run validate           # Validate CSV data integrity
bun run typecheck          # Run TypeScript type checking (JSDoc-based)
```

## Coding Conventions

### Type System
This project uses **JSDoc typedefs** for type safety (no TypeScript compilation). Import types with:
```javascript
/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
```

### Module Organization
- **Separation of Concerns**: Clients only talk to APIs, StorageManager handles persistence, DataManager orchestrates
- Each module starts with a JSDoc `@module` tag
- Frontend uses ES modules with explicit `.js` extensions

### CSV Format
Files in `db/{FROM_CURR}/{YEAR}.csv` use this format (from_curr is implicit from folder):
```csv
date,to_curr,provider,rate,markup
2024-01-01,USD,VISA,1.0892,0.45
2024-01-01,USD,ECB,1.0856,
```

### Provider-Specific Quirks
- **Visa**: Supports parallel requests (16 concurrent). Request params are **inverted** (`from=to&to=from`)
- **Mastercard**: Sequential only (Akamai bot detection). Requires `headless: false` and session refresh every 6 requests
- **ECB**: Official rates, no markup field

## Frontend Data Loading
The Progressive Enhancement pattern in [js/data-manager.js](js/data-manager.js):
1. Check IndexedDB cache (fastest)
2. Fetch server CSVs for historical data
3. Call live APIs to fill gaps between server data and yesterday

## Backend Batch Processing
See [shared/constants.js](shared/constants.js) for `PROVIDER_CONFIG` rate limiting settings. The batch clients in `backend/` use Playwright for browser automation:
- Visa: Firefox (headless)
- Mastercard: Chromium (headed, anti-bot evasion required)

## Adding New Currency Pairs
1. Add pair to `backend/watchlist.json`
2. Run `bun run backfill --provider=all` to populate history
3. The daily GitHub Action will maintain it going forward

## Common Pitfalls
- Always use `parseDate()`/`formatDate()` from shared/utils.js for date handling (avoids timezone issues)
- Markup values can be `null` (ECB has no markup data)
- The `store` singleton in csv-store.js maintains an in-memory index for deduplication
