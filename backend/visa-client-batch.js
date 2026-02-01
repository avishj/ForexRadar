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
import { PROVIDER_CONFIG, BROWSER_CONFIG } from "../shared/constants.js";
import { sleep, formatProgress } from "../shared/browser-utils.js";
import { store } from "./csv-store.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("VISA");

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
const browserConfig = BROWSER_CONFIG.VISA;

// Reusable browser instance
/** @type {PlaywrightBrowser | null} */
let browserInstance = null;
/** @type {PlaywrightBrowserContext | null} */
let browserContext = null;
/** @type {Promise<{browser: PlaywrightBrowser, context: PlaywrightBrowserContext}> | null} */
let browserInitPromise = null;

/**
 * Resets all browser state (called on unexpected disconnect)
 */
function resetBrowserState() {
	browserInstance = null;
	browserContext = null;
	browserInitPromise = null;
}

/**
 * Gets or creates a shared browser instance (race-condition safe)
 * @returns {Promise<{browser: PlaywrightBrowser, context: PlaywrightBrowserContext}>}
 */
async function getBrowser() {
	if (browserInstance && browserInstance.isConnected()) {
		return { browser: browserInstance, context: browserContext };
	}

	if (browserInstance && !browserInstance.isConnected()) {
		log.warn("Browser disconnected unexpectedly, resetting state");
		resetBrowserState();
	}

	if (browserInitPromise) {
		return browserInitPromise;
	}

	browserInitPromise = (async () => {
		log.info("Launching headless Firefox browser...");
		browserInstance = await firefox.launch({ headless: browserConfig.headless });
		browserContext = await browserInstance.newContext({
			userAgent: browserConfig.userAgent,
			extraHTTPHeaders: browserConfig.extraHTTPHeaders
		});

		browserInstance.on("disconnected", () => {
			log.warn("Browser disconnected event fired, resetting state");
			resetBrowserState();
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
		log.info("Closing browser...");
		const browser = browserInstance;
		resetBrowserState();
		await browser.close();
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
		log.info("No requests to process");
		return;
	}

	log.info(`Starting: ${requests.length} requests (${config.maxParallelRequests} parallel)`);

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
					let apiStatus = null;

					page.on("response", async (response) => {
						if (response.url().includes("/cmsapi/fx/rates")) {
							apiStatus = response.status();
						}
					});

					await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });

					if (apiStatus === 500 || apiStatus === 400) {
						await page.close();
						return { req, record: null };
					}
					if (apiStatus === 429 || apiStatus === 403) {
						await page.close();
						throw new Error(`Rate limited: ${apiStatus}`);
					}
					if (apiStatus !== 200) {
						await page.close();
						throw new Error(`HTTP ${apiStatus}`);
					}

					// Extract JSON from page body (Firefox renders JSON in a <pre> tag)
					// This avoids the NS_ERROR_FAILURE bug with response.text()
					const bodyText = await page.evaluate(() => document.body.innerText);
					await page.close();

					const data = JSON.parse(bodyText);
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
					log.error(`FAILED ${req.date} ${req.from}/${req.to}: ${result.reason?.message}`);
					continue;
				}

				const { record } = result.value;
				if (!record) {
					log.info(`UNAVAILABLE ${req.date} ${req.from}/${req.to}`);
					continue;
				}

				const inserted = store.add(record);
				if (inserted > 0) {
					const markup = record.markup ? ` (${record.markup}%)` : "";
					log.success(`SAVED ${record.date} ${record.from_curr}/${record.to_curr}: ${record.rate}${markup}`);
				}
			}

			// Check for rate-limit errors and abort if detected
			const rateLimited = results.some(r =>
				r.status === 'rejected' &&
				String(r.reason?.message || '').includes('Rate limited')
			);
			if (rateLimited) {
				log.error('Rate limited by Visa API, aborting batch');
				throw new Error('Rate limited; aborting batch');
			}

			processed += batch.length;
			log.info(formatProgress(processed, requests.length));

			if (i + config.maxParallelRequests < requests.length) {
				await sleep(config.batchDelayMs);
			}
		}

		log.success(`Complete: ${processed} processed`);
	} catch (error) {
		log.error(`Fatal error: ${error.message}`);
		throw error;
	} finally {
		await closeBrowser();
	}
}

export { PROVIDER_NAME };
