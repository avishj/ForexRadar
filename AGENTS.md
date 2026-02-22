## Rules

1. Skip `bun run check && bun run lint` after changes unless asked for.
2. NEVER downgrade GitHub Actions versions. Versions are intentionally pinned. If using a new workflow, find its latest version and use it.
3. NEVER add test jobs to deploy.yml. CI is the single gate; deploy triggers via `workflow_run`.
4. NEVER use separate `git commit` and `git push` calls. ALWAYS combine: `git commit ... && git push`.
5. NEVER try to fix a major bug directly. MUST write a reproducing test first, then fix. Only for major bugs that deserve a test.
6. MUST use `git-committing` skill after each logical block of work.
7. MUST use bun and bun APIs. NEVER use npm/npx/yarn/pnpm/node.
8. MUST follow existing codebase patterns. ES2022 JS with JSDoc types, relative imports, no path aliases.

## Overview

ForexRadar tracks historical exchange rates from Visa, Mastercard (bot evasion via headful Playwright), and ECB. Bun backend scrapes rates into CSV files (`db/{CURRENCY}/{YEAR}.csv`). Astro static frontend deployed to GitHub Pages.

## Commands

| Command | Use |
|---------|-----|
| `bun run check` | Typecheck |
| `bun run lint` | Lint |
| `bun run validate` | CSV data integrity (if db/ modified) |
| `bun run test` | All tests |
| `bun run test:unit` | Unit tests |
| `bun run test:integration` | Integration tests |
| `bun run test:e2e` | E2E tests |
| `bun run test:smoke` | UI smoke tests |
| `bun run test:contract` | API contract tests |
| `bun run daily` | Fetch today's rates |
| `bun run backfill` | Backfill historical data |

## Gotchas

- **Mastercard MUST run headful** (`headless: false`). Simulates UI clicks, intercepts network responses. Akamai bot detection. Session refresh every 6 req, browser restart every 18.
- **Visa data** available after 12pm ET. `getLatestAvailableDate()` in `shared/utils.js` handles this.
- **ECB cache boundary** is UTC 12:00. `isCacheStale()` in `shared/utils.js`.
- **CI skips tests** for non-code changes (`db/`, `docs/`, `scripts/`, config files, `*.md`, etc.).
