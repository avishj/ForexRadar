# ForexRadar Agents

## Agent Skills

**Always use the `git-committing` skill** after completing logical blocks of work, unless explicitly asked not to. This ensures all changes are committed and pushed incrementally.

## Agent Rules

- **Do not downgrade action versions** - When editing GitHub Actions workflows, keep existing action versions unless explicitly asked to upgrade. The current versions are intentionally pinned.
- **Combine git commit and push** - Use `git commit ... && git push` in a single command, not separate calls.
- **Avoid duplicate CI runs** - CI is the single source of truth for tests. Deploy triggers via `workflow_run` after CI/daily succeed—do not add test jobs to deploy.yml.
- **db-only changes skip tests** - CI detects when only `db/**` files changed and skips test jobs to save runner minutes.

## Overview

ForexRadar is a web application that tracks and visualizes historical exchange rates from three providers:
- **Visa** - Card network exchange rates with markup data
- **Mastercard** - Card network exchange rates (requires bot evasion)
- **ECB** - European Central Bank reference rates

The project uses **Bun** for the backend runtime and **GitHub Pages** for the static frontend. Data is scraped using **Playwright** (headful browsers for bot evasion) and stored as CSV files in the `db/` directory.

## Build and Test Commands

### Setup
```bash
bun install                # Install dependencies
bun run postinstall        # Install Playwright browsers (Firefox + Chromium)
```

### Core Scripts
| Command | Description |
|---------|-------------|
| `bun run daily` | Fetch latest rates for watchlist (Visa + ECB) |
| `bun run backfill` | Populate historical data for all pairs |
| `bun run ecb-backfill` | Backfill ECB historical rates |
| `bun run validate` | Validate CSV data integrity |
| `bun run check` | Run TypeScript type checking |
| `bun run lint` | Run ESLint on js/, shared/, backend/ |
| `bun run lint:fix` | Auto-fix ESLint issues |

### Test Scripts
| Command | Description |
|---------|-------------|
| `bun run test` | Run all tests |
| `bun run test:unit` | Run unit tests (shared utilities) |
| `bun run test:integration` | Run integration tests (CSVStore, ECB client) |
| `bun run test:contract` | Run API contract tests (Visa, ECB, Mastercard) |
| `bun run test:contract:action` | Run API contract tests (Visa, ECB) |
| `bun run test:contract:mc` | Run Mastercard contract tests only |
| `bun run test:e2e` | Run end-to-end flow tests |
| `bun run test:smoke` | Run UI smoke tests |
| `bun run test:perf` | Run perf tests (bun + browser) |
| `bun run test:all` | Run all tests |

### Verification After Changes
Always run these commands after making changes:
```bash
bun run check      # Typecheck
bun run lint       # Lint
bun run validate   # Data integrity (if db/ modified)
```

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                            │
│  daily.yml (2x daily) ──► daily-update.js ──► db/{CURR}/{YEAR}.csv │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Rate Providers                               │
│  ┌───────────┐   ┌───────────────┐   ┌─────────────┐            │
│  │   Visa    │   │  Mastercard   │   │    ECB      │            │
│  │ (16 par.) │   │ (sequential)  │   │  (bulk API) │            │
│  └───────────┘   └───────────────┘   └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (SPA)                             │
│  csv-reader.js ──► data-manager.js ──► chart-manager.js         │
│       │                                      │                   │
│  IndexedDB ◄────── storage-manager.js ───────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Characteristics

| Provider | Parallelism | Rate Limiting | Notes |
|----------|-------------|---------------|-------|
| Visa | 16 concurrent | 100ms batch delay | Fast, reliable |
| Mastercard | Sequential (1) | Session refresh every 6 req, browser restart every 18 | Akamai bot detection |
| ECB | Bulk | None | Historical XML feed |

## Directory Structure

```
ForexRadar/
├── backend/                    # Data ingestion scripts (Bun)
│   ├── daily-update.js        # Main entry for scheduled updates
│   ├── backfill-orchestrator.js # Long-running backfill jobs
│   ├── cli.js                 # Shared CLI utilities (watchlist loading, arg parsing)
│   ├── visa-client-batch.js   # Visa rate fetcher (parallel)
│   ├── mastercard-client-batch-v2.js # Mastercard fetcher (bot evasion)
│   ├── mastercard-client-batch.js # Legacy MC client
│   ├── ecb-client.js          # ECB XML feed parser
│   ├── ecb-backfill.js        # ECB historical data backfill
│   ├── csv-store.js           # CSV read/write operations
│   ├── validate-data.js       # Data integrity checks
│   ├── watchlist.json         # Visa/MC currency pairs (~330 pairs)
│   └── ecb-watchlist.json     # ECB currencies (30 currencies)
│
├── js/                        # Frontend modules (browser)
│   ├── app.js                 # Main application entry, UI logic
│   ├── chart-manager.js       # ApexCharts wrapper
│   ├── data-manager.js        # Data loading orchestration
│   ├── csv-reader.js          # CSV parsing
│   ├── storage-manager.js     # IndexedDB caching
│   ├── currencies.js          # Currency metadata
│   ├── theme.js               # Dark/light mode
│   ├── animations.js          # UI transitions
│   ├── visa-client.js         # Browser-side Visa client
│   ├── mastercard-client.js   # Browser-side Mastercard client
│   └── globals.d.ts           # Global type declarations
│
├── shared/                    # Isomorphic utilities
│   ├── constants.js           # Provider configs (rate limits, etc.)
│   ├── utils.js               # Date formatting, cache staleness
│   ├── csv-utils.js           # CSV parsing helpers
│   ├── browser-utils.js       # Browser environment utilities
│   ├── logger.js              # Logging utilities
│   └── types.js               # JSDoc type definitions
│
├── css/                       # Stylesheets
├── db/                        # CSV data storage
│   └── {CURRENCY}/            # e.g., USD/, EUR/, INR/
│       └── {YEAR}.csv         # e.g., 2024.csv, 2025.csv
│
├── tests/                     # Test suites
│   ├── unit/                  # Unit tests (constants, csv-utils, utils)
│   ├── integration/           # Integration tests (CSVStore, ECB client)
│   ├── contract/              # API response contract tests
│   ├── smoke/                 # UI smoke tests (Playwright)
│   ├── e2e/                   # End-to-end flow tests
│   ├── perf/                  # Performance benchmarks
│   ├── fixtures/              # Test fixtures
│   ├── helpers/               # Test helper utilities
│   ├── playwright.smoke.config.js   # Smoke test configuration
│   ├── playwright.e2e.config.js # E2E test configuration
│   ├── playwright.perf.config.js # Perf test configuration
│   └── server.js              # Local test server
│
├── scripts/                   # Automation scripts
│   ├── ralph/                 # Ralph autonomous agent
│   │   ├── ralph.sh           # Ralph runner script
│   │   └── prompt.md          # Ralph prompt template
│   ├── backfill_watchdog.py   # Backfill monitoring script
│   ├── install-backfill-automation.sh
│   └── run_backfill_mastercard.sh
│
├── .github/workflows/         # CI/CD
│   ├── ci.yml                 # Lint + typecheck + tests on PR
│   ├── daily.yml              # Scheduled data updates (2x daily)
│   ├── deploy.yml             # GitHub Pages deployment
│   ├── contract.yml           # Weekly API contract tests
│   ├── perf.yml               # Weekly performance benchmarks
│   └── _*.yml                 # Reusable workflow jobs
│
└── docs/                      # Documentation
    ├── ARCHITECTURE.md        # System architecture docs
    ├── SPEC.md                # Project specification
    └── qa.md                  # QA documentation
```

## Key Files Reference

### Backend Entry Points
- **`backend/daily-update.js`** - Called by GitHub Actions, fetches today's rates
- **`backend/backfill-orchestrator.js`** - CLI for batch historical data fetching
- **`backend/cli.js`** - Shared CLI utilities (watchlist loading, arg parsing)

### Data Clients
- **`backend/visa-client-batch.js`** - Uses Playwright to fetch Visa rates (supports parallel requests)
- **`backend/mastercard-client-batch-v2.js`** - Optimized MC client with session management and 403 recovery
- **`backend/ecb-client.js`** - Parses ECB XML feed, returns bidirectional rates (EUR↔X)

### Storage
- **`backend/csv-store.js`** - CRUD operations for CSV files in `db/`
- **`js/storage-manager.js`** - IndexedDB wrapper for frontend caching

### Shared Utilities
- **`shared/constants.js`** - `PROVIDER_CONFIG` with rate limits per provider
- **`shared/utils.js`** - Date utilities, cache staleness checks (UTC 12:00 boundary)
- **`shared/types.js`** - All JSDoc typedefs (`RateRecord`, `Provider`, `CurrencyCode`, etc.)

## Code Style & Conventions

- **Runtime**: Bun >= 1.3.5
- **Module System**: ES Modules (`"type": "module"`)
- **Language**: ES2022 JavaScript with JSDoc types
- **TypeScript**: Type checking only (`noEmit: true`, `checkJs: true`, `strict: false`)
- **Linting**: ESLint 9 with flat config
- **No path aliases**: Use relative imports

### JSDoc Typing Pattern
```javascript
/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

/**
 * Fetch rate for a currency pair
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @returns {Promise<RateRecord|null>}
 */
async function fetchRate(from, to) { ... }
```

## CSV Data Format

Each CSV file (`db/{CURRENCY}/{YEAR}.csv`) has the format:
```csv
date,from_curr,to_curr,provider,rate,markup
2025-01-22,USD,INR,VISA,86.123456,0.0
2025-01-22,USD,INR,ECB,85.987654,
```

- `date`: YYYY-MM-DD
- `from_curr`: Source currency (3-letter ISO code)
- `to_curr`: Target currency
- `provider`: VISA | MASTERCARD | ECB
- `rate`: Exchange rate (up to 6 decimals)
- `markup`: Visa markup % (null for MC/ECB)

## GitHub Actions Workflows

### `daily.yml` - Scheduled Data Updates
- **Schedule**: 17:00 and 23:00 UTC
- **Requirements**: Uses `xvfb-run` for headful Playwright
- **Outputs**: Commits new data to `db/`, creates issues on failures

### `deploy.yml` - Frontend Deployment
- **Triggers**: `workflow_run` after CI or daily.yml succeeds, or `workflow_dispatch`
- **Action**: Deploys static files to GitHub Pages (no tests—CI is the gate)

### `ci.yml` - Continuous Integration
- **Triggers**: Push/PR to main
- **Jobs**: Lint + typecheck, unit + integration tests, smoke tests, e2e tests
- **Note**: Skips test jobs when only `db/**` files changed (db-only detection)

### `contract.yml` - API Contract Tests
- **Schedule**: Weekly (Sundays at 00:00 UTC)
- **Purpose**: Validates that Visa and ECB APIs return expected response structures

### `perf.yml` - Performance Benchmarks
- **Schedule**: Weekly (Sundays at 00:00 UTC)
- **Purpose**: Backend + browser performance regression tests

## Development Guidelines

### Adding a New Currency Pair
1. Add to `backend/watchlist.json` (for Visa/MC)
2. Run `bun run daily` to verify fetching works
3. Check data with `bun run validate`

### Adding ECB Currency
1. Add to `backend/ecb-watchlist.json`
2. Run `bun run ecb-backfill` to populate history
3. Run `bun run validate`

### Modifying Rate Clients
1. Test locally with `bun run daily`
2. Check for 403 errors (Mastercard is flaky)
3. Verify CSV output with `bun run validate`

### Frontend Changes
1. Open `index.html` in browser
2. Check browser console for errors
3. Test with different currency pairs and date ranges

## Commit Conventions

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructure
- `docs:` - Documentation
- `chore:` - Maintenance
- `data:` - Data updates (automated)
- `ci:` - CI/CD changes

## Important Gotchas

### Data Availability Timing
- **Visa**: Data available after 12pm ET (Eastern Time) for today's rates
- **ECB**: Updates at UTC 12:00 (cache invalidation boundary)
- `getLatestAvailableDate()` in `shared/utils.js` handles ET timezone logic

### Mastercard Bot Evasion
- **Must run headful** - `headless: false` in `BROWSER_CONFIG.MASTERCARD`
- Uses Chrome via Playwright's chromium with `channel: "chrome"`
- Simulates UI clicks on the currency converter page, not direct API calls
- Intercepts background network responses for rate data
- Only one user agent is active (commented list in `shared/constants.js`)

### CSV Storage Structure
- Files organized as `db/{FROM_CURRENCY}/{YEAR}.csv` (e.g., `db/USD/2025.csv`)
- CSVStore maintains in-memory uniqueness index: `Map<fromCurr, Set<"date|to_curr|provider">>`
- Deduplication happens on write - duplicate records are silently skipped

### Frontend Caching
- IndexedDB stores rates; localStorage tracks refresh timestamps per currency
- Cache key prefix: `forexRadar_serverRefresh_{CURRENCY}`
- Stale check: has UTC 12:00 passed since last refresh?

### Browser Launch Config
- **Visa**: Firefox, headless, minimal config
- **Mastercard**: Chromium+Chrome channel, headful, extensive anti-detection args

## Troubleshooting

### Mastercard 403 Errors
The Mastercard API uses Akamai bot detection. The client handles this by:
1. Using a single user agent per session (rotated on restart)
2. Simulating real UI interactions (clicks, form fills)
3. Pausing 10 minutes on 403 errors (`pauseOnForbiddenMs`)
4. Restarting browser on critical errors (timeouts, target closed)

### Missing Data
1. Run `bun run validate` to identify gaps
2. Use `bun run backfill` to fill missing dates
3. Check GitHub Actions logs for fetch failures

### Cache Staleness
Frontend uses UTC 12:00 as cache boundary. Data refreshes automatically after this time via `shared/utils.js#isCacheStale()`.

For more details on the AGENTS.md format, visit [agents.md](https://agents.md/).
