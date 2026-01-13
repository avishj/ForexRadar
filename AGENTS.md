# ForexRadar Agents

## Overview
ForexRadar tracks historical exchange rates for Visa, Mastercard, and ECB. The project uses **Bun** for the backend runtime and **GitHub Pages** for the frontend. Data is scraped/fetched using **Playwright** and stored as CSV files in the `db/` directory.

## Build and Test Commands

### Setup
- **Install dependencies:** `bun install`
- **Install browsers:** `bun run postinstall` (runs `bunx playwright install firefox chromium`)

### Core Scripts
- **Daily Update:** `bun run daily`
  - Runs `backend/daily-update.js`
  - Fetches latest rates for watchlist currencies.
- **Backfill History:** `bun run backfill`
  - Runs `backend/backfill-orchestrator.js`
  - Used for populating historical data.
- **ECB Backfill:** `bun run ecb-backfill`
  - Runs `backend/ecb-backfill.js`
- **Validate Data:** `bun run validate`
  - Runs `backend/validate-data.js`
  - Checks integrity of CSV files in `db/`.
- **Typecheck:** `bun run check`
  - Runs TypeScript checks (`checkJs: true` in `tsconfig.json`).

## Agent Responsibilities

### Backend Agents (`backend/`)
- **Data Ingestion**:
  - `visa-client-batch.js`: Fetches Visa rates.
  - `mastercard-client-batch-v2.js`: **NEW** optimized client for Mastercard rates.
  - `ecb-client.js`: Fetches ECB rates.
- **Orchestration**:
  - `daily-update.js`: Main entry point for scheduled updates.
  - `backfill-orchestrator.js`: Manages long-running backfill jobs.
- **Configuration**:
  - `watchlist.json`: Currency pairs for Visa/Mastercard.
  - `ecb-watchlist.json`: Currencies for ECB.

### Frontend Agents (`js/`, `css/`)
- **Visualization**: `chart-manager.js` renders charts using ApexCharts.
- **Data Loading**: `data-manager.js` and `csv-reader.js` handle fetching and parsing CSVs.
- **State**: `storage-manager.js` manages IndexedDB caching.

### Automation Agents (`.github/workflows/`)
- **Update Data (`daily.yml`)**:
  - Runs 4 times daily (17:00, 19:00, 21:00, 23:00 UTC).
  - Uses `xvfb` for Playwright headful execution.
  - Commits new data to `db/`.
  - Permissions: `contents: write`, `issues: write` (for reporting failures).
- **Deploy Frontend (`deploy.yml`)**:
  - Deploys `index.html` and assets to GitHub Pages.
  - Triggered on push to `main` or after `Update Data` completes.

## Code Style & Conventions
- **Runtime**: [Bun](https://bun.sh) (Engine >= 1.3.5)
- **Module System**: ES Modules (`"type": "module"`)
- **Language Level**: ES2022
- **TypeScript**: Used for type checking only (`noEmit: true`, `checkJs: true`).
  - **Strictness**: Non-strict (`"strict": false`).
- **Path Aliases**: None currently configured; use relative paths.

## Directory Structure
- `backend/`: Node.js/Bun scripts for data fetching.
- `db/`: Data storage. Structure: `db/{CURRENCY}/{YEAR}.csv`.
- `js/`, `css/`: Frontend source code.
- `shared/`: Shared utilities (constants, helpers) used by both backend and frontend.

## PR Instructions
- **Data Changes**: If modifying clients, run `bun run daily` locally to verify fetching works.
- **Frontend Changes**: Ensure changes work with `index.html` locally.
- **Validation**: Always run `bun run validate` before submitting DB changes.
- **Commits**: Use conventional commits (e.g., `feat:`, `fix:`, `chore:`, `data:`).

For more details on the AGENTS.md format, visit [agents.md](https://agents.md/).