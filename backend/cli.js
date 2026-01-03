/**
 * CLI Utilities
 * 
 * Shared command-line parsing and validation for backend scripts.
 * 
 * @module backend/cli
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {import('../shared/types.js').ProviderOption} ProviderOption */
/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').BackfillConfig} BackfillConfig */
/** @typedef {import('../shared/types.js').MassBackfillConfig} MassBackfillConfig */

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALID_PROVIDERS = ['visa', 'mastercard', 'all'];

/**
 * Validates and normalizes provider option.
 * @param {string} value
 * @returns {ProviderOption}
 */
function parseProvider(value) {
  const normalized = value.toLowerCase();
  if (!VALID_PROVIDERS.includes(normalized)) {
    console.error(`Invalid provider "${value}". Use: ${VALID_PROVIDERS.join(', ')}`);
    process.exit(1);
  }
  return /** @type {ProviderOption} */ (normalized);
}

/**
 * Validates and parses parallel count.
 * @param {string} value
 * @returns {number}
 */
function parseParallel(value) {
  const num = parseInt(value, 10);
  if (!Number.isInteger(num) || num < 1) {
    console.error('Invalid --parallel value. Must be a positive integer.');
    process.exit(1);
  }
  return num;
}

/**
 * Parses CLI args for backfill.js (requires --from and --to).
 * @returns {BackfillConfig}
 */
export function parseBackfillArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      provider: { type: 'string', default: 'all' },
      parallel: { type: 'string', default: '1' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node backfill.js --from=USD --to=INR [--provider=visa|mastercard|all] [--parallel=N]');
    process.exit(1);
  }

  return {
    from: values.from.toUpperCase(),
    to: values.to.toUpperCase(),
    provider: parseProvider(values.provider ?? 'all'),
    parallel: parseParallel(values.parallel ?? '1')
  };
}

/**
 * Parses CLI args for mass-backfill.js.
 * @returns {MassBackfillConfig}
 */
export function parseMassBackfillArgs() {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string', default: 'all' },
      parallel: { type: 'string', default: '1' }
    }
  });

  return {
    provider: parseProvider(values.provider ?? 'all'),
    parallel: parseParallel(values.parallel ?? '1')
  };
}

/**
 * Loads currency pairs from watchlist.json.
 * @returns {CurrencyPair[]}
 */
export function loadWatchlist() {
  const path = join(__dirname, 'watchlist.json');
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data.pairs ?? [];
  } catch (error) {
    console.error(`Failed to load watchlist: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Formats provider for display.
 * @param {ProviderOption} provider
 * @returns {string}
 */
export function formatProvider(provider) {
  return provider === 'all' ? 'Visa + Mastercard' : provider.toUpperCase();
}
