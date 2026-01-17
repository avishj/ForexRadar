/**
 * Visa Exchange Rate Client - Batch Mode
 *
 * Fetches exchange rate data from Visa's public FX API in batches.
 * Optimized for bulk backfill operations with parallel request handling.
 *
 * @module backend/visa
 */

import { firefox } from "playwright";
import { formatDateForApi, parseDate } from "../shared/utils.js";
import { PROVIDER_CONFIG } from "../shared/constants.js";
import { store } from "./csv-store.js";

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */
/** @typedef {import('playwright').Browser} PlaywrightBrowser */
/** @typedef {import('playwright').BrowserContext} PlaywrightBrowserContext */

const VISA_API_BASE = "https://www.visa.co.in/cmsapi/fx/rates";
/** @type {Provider} */
const PROVIDER_NAME = "VISA";

const config = PROVIDER_CONFIG.VISA;

// Reusable browser instance
let browserInstance = null;
let browserContext = null;
let browserInitPromise = null;

/**
 * Gets or creates a shared browser instance (race-condition safe)
 * @returns {Promise<{browser: PlaywrightBrowser, context: PlaywrightBrowserContext}>}
 */
async function getBrowser() {
	if (browserInstance) {
		return { browser: browserInstance, context: browserContext };
	}

	if (browserInitPromise) {
		return browserInitPromise;
	}

	browserInitPromise = (async () => {
		console.log("[VISA] Launching headless Firefox browser...");
		browserInstance = await firefox.launch({ headless: true });
		browserContext = await browserInstance.newContext({
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
			extraHTTPHeaders: {
				"Accept-Language": "en-US,en;q=0.9"
			}
		});
		return { browser: browserInstance, context: browserContext };
	})();

	return browserInitPromise;
}

/**
 * Closes the shared browser instance
 */
async function closeBrowser() {
	if (browserInstance) {
		console.log("[VISA] Closing browser...");
		await browserInstance.close();
		browserInstance = null;
		browserContext = null;
		browserInitPromise = null;
	}
}

/**
 * Fetches exchange rates for multiple date/pair combinations.
 * Processes in parallel batches according to PROVIDER_CONFIG.
 * Writes results directly to csv-store.
 *
 * @param {BatchRequest[]} requests - Array of {date, from, to} objects
 * @returns {Promise<void>}
 */
export async function fetchBatch(requests) {
	if (requests.length === 0) {
		console.log("[VISA] No requests to process");
		return;
	}

	console.log(`\n[VISA] Starting: ${requests.length} requests (${config.maxParallelRequests} parallel)`);

	try {
		const { context } = await getBrowser();
		let processed = 0;

		// Process in chunks
		for (let i = 0; i < requests.length; i += config.maxParallelRequests) {
			const batch = requests.slice(i, i + config.maxParallelRequests);

			// Fetch all in parallel
			const results = await Promise.allSettled(
				batch.map(async (req) => {
					const { date, from, to } = req;
					const formattedDate = formatDateForApi(parseDate(date));
					const url = new URL(VISA_API_BASE);
					url.searchParams.set("amount", "1");
					url.searchParams.set("fee", "0");
					url.searchParams.set("utcConvertedDate", formattedDate);
					url.searchParams.set("exchangedate", formattedDate);
					url.searchParams.set("fromCurr", to);
					url.searchParams.set("toCurr", from);

					const page = await context.newPage();
					let apiResponse = null;
					let apiStatus = null;

					page.on("response", async (response) => {
						if (response.url().includes("/cmsapi/fx/rates")) {
							apiStatus = response.status();
							try {
								apiResponse = await response.text();
							} catch { /* Response body unavailable */ }
						}
					});

					await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
					if (!apiResponse) await page.waitForTimeout(3000);
					await page.close();

					if (apiStatus === 500 || apiStatus === 400) return { req, record: null };
					if (apiStatus === 429 || apiStatus === 403) throw new Error(`Rate limited: ${apiStatus}`);
					if (apiStatus !== 200) throw new Error(`HTTP ${apiStatus}`);

					const data = JSON.parse(apiResponse);
					const rate = data.originalValues?.fxRateVisa;
					const markup = data.benchMarkAmount || 0;

					if (!rate) throw new Error("Missing fxRateVisa");

					return {
						req,
						record: {
							date,
							from_curr: from,
							to_curr: to,
							provider: PROVIDER_NAME,
							rate: parseFloat(rate),
							markup: parseFloat(markup)
						}
					};
				})
			);

			// Process results
			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				const req = batch[j];

				if (result.status === "rejected") {
					console.error(`[VISA] FAILED ${req.date} ${req.from}/${req.to}: ${result.reason?.message}`);
					continue;
				}

				const { record } = result.value;
				if (!record) {
					console.log(`[VISA] UNAVAILABLE ${req.date} ${req.from}/${req.to}`);
					continue;
				}

				const inserted = store.add(record);
				if (inserted > 0) {
					const markup = record.markup ? ` (${record.markup}%)` : "";
					console.log(`[VISA] SAVED ${record.date} ${record.from_curr}/${record.to_curr}: ${record.rate}${markup}`);
				}
			}

			processed += batch.length;
			console.log(`[VISA] Progress: ${processed}/${requests.length} (${Math.round((processed / requests.length) * 100)}%)`);

			if (i + config.maxParallelRequests < requests.length) {
				await new Promise((r) => setTimeout(r, config.batchDelayMs));
			}
		}

		console.log(`\n[VISA] Complete: ${processed} processed`);
	} catch (error) {
		console.error(`[VISA] Fatal error: ${error.message}`);
		throw error;
	} finally {
		await closeBrowser();
	}
}

export { PROVIDER_NAME };
