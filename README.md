# ForexRadar

[![CI](https://github.com/avishj/ForexRadar/actions/workflows/ci.yml/badge.svg)](https://github.com/avishj/ForexRadar/actions/workflows/ci.yml)
[![Data Update](https://github.com/avishj/ForexRadar/actions/workflows/daily.yml/badge.svg)](https://github.com/avishj/ForexRadar/actions/workflows/daily.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

Track historical Visa, Mastercard, and ECB exchange rates with real markup data.

**[Live Demo](https://avishj.github.io/ForexRadar)**

## About

When you use your credit card abroad, Visa and Mastercard apply their own exchange rates, often with hidden markups over the interbank rate. ForexRadar shows you exactly what those rates are, how they compare to the ECB reference rate, and how they've changed over time.

## Features

- Compare Visa, Mastercard, and ECB rates side-by-side on interactive charts
- View up to 365+ days of historical data for archived currency pairs
- See Visa's actual markup percentage over ECB mid-market rates
- Offline-first with local caching for fast repeat visits
- Share specific currency pairs via URL
- Dark and light themes

## How It Works

Exchange rates are fetched twice daily (at 17:00 and 23:00 UTC) and stored as CSV files. The frontend loads data progressively: first from local cache, then from the server archive, and finally from live APIs for the most recent rates.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.5

### Installation

```bash
git clone https://github.com/avishj/ForexRadar.git
cd ForexRadar
bun install
```

### Usage

Fetch the latest exchange rates:

```bash
bun run daily
```

Then open `index.html` in your browser.

### Backfilling Historical Data

To populate historical data for all currency pairs:

```bash
bun run backfill        # Visa and Mastercard
bun run ecb-backfill    # ECB rates
```

## Development

### Commands

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `bun run daily`       | Fetch latest rates                       |
| `bun run backfill`    | Populate historical data                 |
| `bun run validate`    | Validate CSV data integrity              |
| `bun run check`       | TypeScript type checking                 |
| `bun run lint`        | Run ESLint                               |
| `bun run test`        | Run smoke tests                          |
| `bun run test:unit`   | Run unit tests                           |
| `bun run test:e2e`    | Run end-to-end tests                     |
| `bun run test:all`    | Run all tests                            |

### Project Structure

```text
ForexRadar/
├── backend/          # Data fetching scripts
├── js/               # Frontend modules
├── shared/           # Shared utilities
├── tests/            # Test suites
├── db/               # CSV data storage
└── css/              # Stylesheets
```

## Data Sources

- **Visa** - Card network exchange rates with markup percentages
- **Mastercard** - Card network exchange rates
- **ECB** - European Central Bank daily reference rates

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run `bun run check && bun run lint && bun run test:all` to verify
5. Commit with a conventional commit message (`feat: add amazing feature`)
6. Push and open a Pull Request

## License

[AGPL-3.0-only](LICENSE)
