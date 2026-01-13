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
		sessionRefreshDelayMs: 200,
		// Small delay between batches to avoid overwhelming the API
		batchDelayMs: 1000
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

/**
 * User agents for Mastercard client (rotated randomly per session)
 * @type {string[]}
 */
export const USER_AGENTS = [
	// Chrome 142 - Windows 10/11
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7499.40 Safari/537.36",
	// Chrome 142 - macOS Sequoia (15) and Sonoma (14)
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
	// Chrome 142 - Linux
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
	// Edge 142 - Windows
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7499.40 Safari/537.36 Edg/142.0.3351.18",
	// Edge 142 - macOS
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
	// Opera 124 - Windows and macOS (Chromium-based)
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 OPR/124.0.0.0",
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 OPR/124.0.0.0",
	// Brave (Chromium-based, reports as Chrome)
	// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
	// "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
];
