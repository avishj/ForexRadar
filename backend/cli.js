/**
 * CLI Utilities
 * @module backend/cli
 */

import { parseArgs } from 'util';
import { BACKFILL_DEFAULTS } from '../shared/constants.js';

/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').ProviderOption} ProviderOption */

/**
 * Parse backfill orchestrator CLI arguments
 * @returns {{ days: number, provider: ProviderOption }}
 */
export function parseOrchestratorArgs() {
  const { values } = parseArgs({
    options: {
      days: { type: 'string', default: String(BACKFILL_DEFAULTS.days) },
      provider: { type: 'string', default: BACKFILL_DEFAULTS.provider }
    }
  });

  const days = parseInt(values.days, 10);
  if (!Number.isInteger(days) || days < 1) {
    console.error('Invalid --days value. Must be a positive integer.');
    process.exit(1);
  }

  const provider = /** @type {ProviderOption} */ (values.provider.toLowerCase());
  if (!['all', 'visa', 'mastercard'].includes(provider)) {
    console.error('Invalid --provider. Use: all, visa, or mastercard');
    process.exit(1);
  }

  return { days, provider };
}

/**
 * Load currency pairs from watchlist.json
 * @returns {Promise<CurrencyPair[]>}
 */
export async function loadWatchlist() {
	const watchlistPath = `${import.meta.dir}/watchlist.json`;
	const data = await Bun.file(watchlistPath).json();
	return data.pairs || [];
}

/** @returns {Promise<string[]>} */
export async function loadEcbWatchlist() {
  const path = `${import.meta.dir}/ecb-watchlist.json`;
  try {
    const data = await Bun.file(path).json();
    return data.currencies ?? [];
  } catch (error) {
    console.error(`Failed to load ECB watchlist: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Format provider option for display
 * @param {ProviderOption} provider
 * @returns {string}
 */
export function formatProvider(provider) {
  if (provider === 'all') return 'VISA + MASTERCARD';
  return provider.toUpperCase();
}
