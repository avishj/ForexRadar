/**
 * Mastercard Exchange Rate Client - Batch Mode
 *
 * Fetches exchange rate data from Mastercard's public settlement rate API in batches.
 * Optimized for bulk backfill with sequential processing and session management.
 *
 * @module backend/mastercard
 */

import { chromium } from "playwright";
import { PROVIDER_CONFIG, USER_AGENTS, BROWSER_CONFIG } from "../shared/constants.js";
import { store } from "./csv-store.js";

// Select a random user agent at script startup (stays consistent for session)
const SESSION_USER_AGENT = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
console.log(`[MASTERCARD] Using User-Agent: ${SESSION_USER_AGENT}.`);

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */
/** @typedef {import('../shared/types.js').MastercardApiResponse} MastercardApiResponse */
/** @typedef {import('../shared/types.js').MastercardFetchRateResult} MastercardFetchRateResult */
/** @typedef {import('playwright').Browser} PlaywrightBrowser */
/** @typedef {import('playwright').BrowserContext} PlaywrightBrowserContext */

const MASTERCARD_API_BASE = "https://www.mastercard.co.in/settlement/currencyrate/conversion-rate";
const MASTERCARD_UI_PAGE = "https://www.mastercard.co.in/content/mastercardcom/global/en/personal/get-support/convert-currency.html";
/** @type {Provider} */
const PROVIDER_NAME = "MASTERCARD";

const config = PROVIDER_CONFIG.MASTERCARD;

// Reusable browser instance
/** @type {PlaywrightBrowser | null} */
let browserInstance = null;
/** @type {PlaywrightBrowserContext | null} */
let browserContext = null;
/** @type {Promise<{browser: PlaywrightBrowser, context: PlaywrightBrowserContext}> | null} */
let browserInitPromise = null;
/** @type {import('playwright').Page | null} */
let apiPage = null;

/**
 * Resets all browser state (called on unexpected disconnect)
 */
function resetBrowserState() {
	browserInstance = null;
	browserContext = null;
	browserInitPromise = null;
	apiPage = null;
}

/**
 * Gets or creates a shared browser instance (race-condition safe)
 */
async function getBrowser() {
	// Check if existing browser is still alive
	if (browserInstance && browserInstance.isConnected()) {
		return { browser: browserInstance, context: browserContext };
	}

	// Browser died unexpectedly - reset state
	if (browserInstance && !browserInstance.isConnected()) {
		console.warn("[MASTERCARD] Browser disconnected unexpectedly, resetting state");
		resetBrowserState();
	}

	if (browserInitPromise) {
		return browserInitPromise;
	}

	browserInitPromise = (async () => {
		const mcConfig = BROWSER_CONFIG.MASTERCARD;
		console.log("[MASTERCARD] Launching Chromium browser...");
		browserInstance = await chromium.launch({
			headless: mcConfig.headless,
			channel: mcConfig.channel,
			args: mcConfig.args
		});
		browserContext = await browserInstance.newContext({
			userAgent: SESSION_USER_AGENT,
			viewport: mcConfig.viewport,
			locale: mcConfig.locale,
			extraHTTPHeaders: mcConfig.extraHTTPHeaders
		});

		// Auto-reset state if browser crashes unexpectedly
		browserInstance.on("disconnected", () => {
			console.warn("[MASTERCARD] Browser disconnected event fired, resetting state");
			resetBrowserState();
		});

		return { browser: browserInstance, context: browserContext };
	})();

	return browserInitPromise;
}

/**
 * Closes the shared browser instance with timeout protection
 * @returns {Promise<void>}
 */
async function closeBrowser() {
	if (browserInstance) {
		console.log("[MASTERCARD] Closing browser...");
		const browser = browserInstance;
		// Reset state immediately so we don't try to reuse a closing browser
		resetBrowserState();
		try {
			// Try graceful close with 3 second timeout
			await Promise.race([browser.close(), new Promise((_, reject) => setTimeout(() => reject(new Error("Close timeout")), 3000))]);
			console.log("[MASTERCARD] Browser closed");
		} catch (_error) {
			console.warn("[MASTERCARD] Browser close timed out, force-killing process");
			try {
				/** @type {any} */ (browser).process()?.kill("SIGKILL");
			} catch { /* already dead */ }
		}
	}
}

/**
 * Sleep utility for rate limiting
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets or creates a reusable page for API requests
 */
async function getApiPage() {
	// Must check browser connection FIRST - page.isClosed() returns false when browser crashed
	if (apiPage && browserInstance?.isConnected() && !apiPage.isClosed()) {
		return apiPage;
	}
	const { context } = await getBrowser();
	apiPage = await context.newPage();
	return apiPage;
}

/**
 * Refreshes the session by visiting the UI page
 * @returns {Promise<void>}
 */
async function refreshSession() {
	console.log("[MASTERCARD] Refreshing session");
	const page = await getApiPage();
	try {
		// Use domcontentloaded - we just need cookies, not full page render
		await page.goto(MASTERCARD_UI_PAGE, { timeout: 15000, waitUntil: "domcontentloaded" });
		await sleep(config.sessionRefreshDelayMs);
	} catch (error) {
		console.warn("[MASTERCARD] Session refresh failed:", error.message);
		// Page is likely in a broken state - close it so a fresh one is created
		await page.close();
		apiPage = null;
	}
}

/**
 * Fetches a single exchange rate from Mastercard API.
 * Returns raw API response for contract testing.
 *
 * @param {string} from - Source currency code
 * @param {string} to - Target currency code
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<MastercardFetchRateResult>}
 */
export async function fetchRate(from, to, date) {
	const page = await getApiPage();
	const url = new URL(MASTERCARD_API_BASE);
	url.searchParams.set("fxDate", date);
	url.searchParams.set("transCurr", from);
	url.searchParams.set("crdhldBillCurr", to);
	url.searchParams.set("bankFee", "0");
	url.searchParams.set("transAmt", "1");

	const response = await page.goto(url.toString(), { timeout: 10000, waitUntil: "domcontentloaded" });
	if (!response) {
		return { status: 0, data: null };
	}
	const apiStatus = response.status();

	if (apiStatus !== 200) {
		return { status: apiStatus, data: null };
	}

	const apiResponse = await page.content();

	// Parse JSON from page content
	let jsonText = apiResponse;
	const preMatch = apiResponse.match(/<pre[^>]*>(.*?)<\/pre>/is);
	if (preMatch) {
		jsonText = preMatch[1].trim();
	} else {
		const bodyMatch = apiResponse.match(/<body[^>]*>(.*?)<\/body>/is);
		if (bodyMatch) jsonText = bodyMatch[1].trim();
	}

	try {
		const data = JSON.parse(jsonText);
		return { status: apiStatus, data };
	} catch {
		return { status: apiStatus, data: null };
	}
}

/**
 * Fetches exchange rates for multiple date/pair combinations.
 * Processes sequentially with session management.
 * Writes results directly to csv-store.
 *
 * @param {BatchRequest[]} requests - Array of {date, from, to} objects
 * @returns {Promise<void>}
 */
export async function fetchBatch(requests) {
	if (requests.length === 0) {
		console.log("[MASTERCARD] No requests to process");
		return;
	}

	console.log(`\n[MASTERCARD] Starting: ${requests.length} requests (sequential)`);
	console.log(`[MASTERCARD] Session refresh: every ${config.sessionRefreshInterval}, Browser restart: every ${config.browserRestartInterval}`);

	try {
		let requestCounter = 0;

		for (let i = 0; i < requests.length; i++) {
			const { date, from, to } = requests[i];

			// Session management: check before request, increment after
			if (requestCounter % config.browserRestartInterval === 0 && requestCounter > 0) {
				console.log(`[MASTERCARD] Restarting browser after ${requestCounter} requests`);
				await closeBrowser();
				await sleep(3000);
			}
			if (requestCounter % config.sessionRefreshInterval === 0) {
				await refreshSession();
			}

			// Fetch
			try {
				const { status: apiStatus, data } = await fetchRate(from, to, date);

				// Handle errors
				if (apiStatus === 403) {
					console.error(`[MASTERCARD] 403 Forbidden - Pausing ${config.pauseOnForbiddenMs / 1000}s`);
					await closeBrowser();
					await sleep(config.pauseOnForbiddenMs);
					console.log("[MASTERCARD] Resuming");
					await refreshSession();
					continue;
				}

				if (apiStatus !== 200 || !data) {
					console.error(`[MASTERCARD] FAILED ${date} ${from}/${to}: HTTP ${apiStatus}`);
					continue;
				}

				// Check for API errors
				if (data.type === "error" || data.data?.errorCode) {
					const errorMsg = data.data?.errorMessage || "Unknown error";
					if (errorMsg.toLowerCase().includes("outside of approved historical rate range")) {
						console.log(`[MASTERCARD] UNAVAILABLE ${date} ${from}/${to}`);
					} else {
						console.error(`[MASTERCARD] FAILED ${date} ${from}/${to}: ${errorMsg}`);
					}
					continue;
				}

				const conversionRate = data.data?.conversionRate;
				if (!conversionRate) {
					console.error(`[MASTERCARD] FAILED ${date} ${from}/${to}: Missing conversionRate`);
					continue;
				}

				// Save
				/** @type {RateRecord} */
				const record = {
					date,
					from_curr: from,
					to_curr: to,
					provider: PROVIDER_NAME,
					rate: conversionRate,
					markup: /** @type {null} */ (null)
				};

				const inserted = store.add(record);
				if (inserted > 0) {
					console.log(`[MASTERCARD] SAVED ${date} ${from}/${to}: ${conversionRate}`);
				}
				await sleep(config.batchDelayMs);
			} catch (error) {
				console.error(`[MASTERCARD] FAILED ${date} ${from}/${to}: ${error.message}`);
				// On timeout errors, restart the browser - session is likely dead
				if (error.message.includes("Timeout")) {
					console.log("[MASTERCARD] Timeout detected - restarting browser");
					await closeBrowser();
					await sleep(config.sessionRefreshDelayMs);
					await refreshSession();
				}
			}

			requestCounter++;

			// Progress
			if (i % 10 === 0 || i === requests.length - 1) {
				const pct = Math.round(((i + 1) / requests.length) * 100);
				console.log(`[MASTERCARD] Progress: ${i + 1}/${requests.length} (${pct}%)`);
			}
		}

		console.log(`\n[MASTERCARD] Complete: ${requestCounter} processed`);
	} catch (error) {
		console.error(`[MASTERCARD] Fatal error: ${error.message}`);
		throw error;
	} finally {
		await closeBrowser();
	}
}

export { PROVIDER_NAME, refreshSession, closeBrowser };
