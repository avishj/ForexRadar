/**
 * CLI Utilities
 * @module backend/cli
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').BackfillConfig} BackfillConfig */
/** @typedef {import('../shared/types.js').MassBackfillConfig} MassBackfillConfig */
/** @typedef {import('../shared/types.js').ProviderOption} ProviderOption */

const __dirname = dirname(fileURLToPath(import.meta.url));

// Defaults
const VALID_PROVIDERS = ['visa', 'mastercard', 'all'];
const DEFAULT_PROVIDER = 'all';
const DEFAULT_PARALLEL = 1;
const DEFAULT_DAYS = 365;

/**
 * Parses a positive integer from string, exits on invalid input.
 * @param {string} value
 * @param {string} name - Parameter name for error message
 * @returns {number}
 */
function parsePositiveInt(value, name) {
  const num = parseInt(value, 10);
  if (!Number.isInteger(num) || num < 1) {
    console.error(`Invalid --${name} value. Must be a positive integer.`);
    process.exit(1);
  }
  return num;
}

/**
 * Validates and normalizes provider option.
 * @param {string} value
 * @returns {ProviderOption}
 */
function parseProvider(value) {
  const normalized = value.toLowerCase();
  if (!VALID_PROVIDERS.includes(normalized)) {
    console.error(`Invalid --provider "${value}". Use: ${VALID_PROVIDERS.join(', ')}`);
    process.exit(1);
  }
  return /** @type {ProviderOption} */ (normalized);
}

/** @returns {BackfillConfig} */
export function parseBackfillArgs() {
  const { values } = parseArgs({
    options: {
      from: { /** @typedef {CurrencyCode} */ type: 'string' },
      to: { /** @typedef {CurrencyCode} */ type: 'string' },
      provider: { type: 'string', default: DEFAULT_PROVIDER },
      parallel: { type: 'string', default: String(DEFAULT_PARALLEL) },
      days: { type: 'string', default: String(DEFAULT_DAYS) }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node backfill.js --from=USD --to=INR [--provider=visa|mastercard|all] [--parallel=N] [--days=N]');
    process.exit(1);
  }

  return {
    from: /** @type {CurrencyCode} */ (values.from.toUpperCase()),
    to: /** @type {CurrencyCode} */ (values.to.toUpperCase()),
    provider: parseProvider(values.provider),
    parallel: parsePositiveInt(values.parallel, 'parallel'),
    days: parsePositiveInt(values.days, 'days')
  };
}

/** @returns {MassBackfillConfig} */
export function parseMassBackfillArgs() {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string', default: DEFAULT_PROVIDER },
      parallel: { type: 'string', default: String(DEFAULT_PARALLEL) },
      days: { type: 'string', default: String(DEFAULT_DAYS) }
    }
  });

  return {
    provider: parseProvider(values.provider),
    parallel: parsePositiveInt(values.parallel, 'parallel'),
    days: parsePositiveInt(values.days, 'days')
  };
}

/** @returns {CurrencyPair[]} */
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

/** @returns {string[]} */
export function loadEcbWatchlist() {
  const path = join(__dirname, 'ecb-watchlist.json');
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data.currencies ?? [];
  } catch (error) {
    console.error(`Failed to load ECB watchlist: ${error.message}`);
    process.exit(1);
  }
}

/** @param {ProviderOption} provider */
export function formatProvider(provider) {
  return provider === 'all' ? 'Visa + Mastercard' : provider.toUpperCase();
}
