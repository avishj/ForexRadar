/**
 * Shared Browser Utilities
 *
 * Common utilities for Playwright-based batch clients.
 *
 * @module shared/browser-utils
 */

/**
 * Sleep utility for rate limiting and delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random delay to simulate human behavior
 * @param {number} min - Minimum ms
 * @param {number} max - Maximum ms
 * @returns {Promise<void>}
 */
export function randomDelay(min, max) {
	return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Close browser with timeout protection
 * @param {import('playwright').Browser | null} browser - Browser instance
 * @param {number} [timeoutMs=3000] - Close timeout in ms
 * @returns {Promise<boolean>} - True if closed successfully
 */
export async function closeBrowserWithTimeout(browser, timeoutMs = 3000) {
	if (!browser) return true;
	try {
		await Promise.race([
			browser.close(),
			new Promise((_, reject) => setTimeout(() => reject(new Error("Close timeout")), timeoutMs))
		]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Format batch progress message
 * @param {number} processed - Number processed
 * @param {number} total - Total count
 * @returns {string}
 */
export function formatProgress(processed, total) {
	const pct = Math.round((processed / total) * 100);
	return `Progress: ${processed}/${total} (${pct}%)`;
}
