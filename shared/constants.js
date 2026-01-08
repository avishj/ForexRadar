/**
 * Shared Constants
 *
 * Configuration constants for providers and general app settings.
 *
 * @module shared/constants
 */

/** @typedef {import('./types.js').Provider} Provider */

/**
 * Provider-specific configuration for rate limiting and browser lifecycle.
 *
 * @type {Record<Provider, {
 *   maxParallelRequests?: number,
 *   batchDelayMs?: number,
 *   sessionRefreshInterval?: number,
 *   browserRestartInterval?: number,
 *   pauseOnForbiddenMs?: number,
 *   sessionRefreshDelayMs?: number
 * }>}
 */
export const PROVIDER_CONFIG = {
	VISA: {
		// Visa can handle multiple parallel requests efficiently
		maxParallelRequests: 16,
		// Small delay between batches to avoid overwhelming the API
		batchDelayMs: 100
	},

	MASTERCARD: {
		// Mastercard must be sequential due to Akamai bot detection
		maxParallelRequests: 1,
		// Refresh session by visiting UI page every N requests
		sessionRefreshInterval: 6,
		// Completely restart browser every N requests to prevent 403s
		browserRestartInterval: 18,
		// How long to pause after receiving HTTP 403
		pauseOnForbiddenMs: 2 * 60 * 1000, // 2 minutes
		// Small delay after session refresh
		sessionRefreshDelayMs: 200
	},
	ECB: {}
};

/**
 * Default backfill configuration
 */
export const BACKFILL_DEFAULTS = {
	days: 365,
	provider: "all" // 'all' | 'visa' | 'mastercard'
};
