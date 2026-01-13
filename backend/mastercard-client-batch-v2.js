/**
 * Mastercard Exchange Rate Client - Batch Mode V2
 *
 * Fetches exchange rate data from Mastercard by simulating UI interactions
 * and intercepting network requests. This approach is more resilient to
 * bot detection as it mimics real user behavior.
 *
 * Key differences from V1:
 * - Simulates actual UI clicks instead of direct API calls
 * - Intercepts background network requests for data
 * - Uses Chrome browser (Playwright's chromium with Chrome channel)
 * - More human-like interaction patterns
 *
 * @module backend/mastercard-v2
 */

import { chromium } from "playwright";
import { PROVIDER_CONFIG, USER_AGENTS } from "../shared/constants.js";
import { store } from "./csv-store.js";

// Select a random user agent at script startup (stays consistent for session)
const SESSION_USER_AGENT = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
console.log(`[MASTERCARD-V2] Using User-Agent: ${SESSION_USER_AGENT}`);

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */
/** @typedef {import('playwright').Browser} PlaywrightBrowser */
/** @typedef {import('playwright').BrowserContext} PlaywrightBrowserContext */
/** @typedef {import('playwright').Page} PlaywrightPage */

const MASTERCARD_UI_PAGE = "https://www.mastercard.co.in/content/mastercardcom/global/en/personal/get-support/convert-currency.html";
// Only match the specific conversion-rate endpoint (not conversion-rate-issued)
const MASTERCARD_API_PATTERN = /settlement\/currencyrate\/conversion-rate\?/;

/** @type {Provider} */
const PROVIDER_NAME = "MASTERCARD";

const config = PROVIDER_CONFIG.MASTERCARD;

// Browser state
let browserInstance = null;
let browserContext = null;
let browserInitPromise = null;
let mainPage = null;

// ============================================================================
// BROWSER LIFECYCLE
// ============================================================================

/**
 * Resets all browser state (called on unexpected disconnect)
 */
function resetBrowserState() {
	browserInstance = null;
	browserContext = null;
	browserInitPromise = null;
	mainPage = null;
}

/**
 * Gets or creates a shared browser instance (race-condition safe)
 * Uses Chrome channel for better compatibility with anti-bot systems.
 */
async function getBrowser() {
	if (browserInstance && browserInstance.isConnected()) {
		return { browser: browserInstance, context: browserContext };
	}

	if (browserInstance && !browserInstance.isConnected()) {
		console.warn("[MASTERCARD-V2] Browser disconnected unexpectedly, resetting state");
		resetBrowserState();
	}

	if (browserInitPromise) {
		return browserInitPromise;
	}

	browserInitPromise = (async () => {
		console.log("[MASTERCARD-V2] Launching Chrome browser...");
		browserInstance = await chromium.launch({
			channel: "chrome", // Use installed Chrome instead of Chromium
			headless: false, // Akamai bot detection blocks headless mode
			args: [
				"--disable-blink-features=AutomationControlled",
				"--disable-gpu",
				"--disable-dev-shm-usage",
				"--disable-background-timer-throttling",
				"--disable-backgrounding-occluded-windows",
				"--disable-renderer-backgrounding",
				"--no-sandbox",
				"--disable-web-security",
				"--disable-extensions",
				"--disable-plugins",
				"--disable-default-apps",
				"--disable-sync",
				"--disable-translate",
				"--max_old_space_size=2048",
				"--js-flags=--max-old-space-size=2048"
			]
		});
		browserContext = await browserInstance.newContext({
			userAgent: SESSION_USER_AGENT,
			viewport: { width: 1512, height: 984 },
			locale: "en-US",
			extraHTTPHeaders: {
				"Accept-Language": "en-GB,en;q=0.9",
				DNT: "1",
				"Sec-GPC": "1"
			}
		});

		browserInstance.on("disconnected", () => {
			console.warn("[MASTERCARD-V2] Browser disconnected event fired, resetting state");
			resetBrowserState();
		});

		return { browser: browserInstance, context: browserContext };
	})();

	return browserInitPromise;
}

/**
 * Closes the shared browser instance with timeout protection
 */
async function closeBrowser() {
	if (browserInstance) {
		console.log("[MASTERCARD-V2] Closing browser...");
		const browser = browserInstance;
		resetBrowserState();
		try {
			await Promise.race([
				browser.close(),
				new Promise((_, reject) => setTimeout(() => reject(new Error("Close timeout")), 3000))
			]);
			console.log("[MASTERCARD-V2] Browser closed");
		} catch (error) {
			console.warn("[MASTERCARD-V2] Browser close timed out, continuing");
		}
	}
}

/**
 * Sleep utility for rate limiting and human-like delays
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random delay to simulate human behavior
 * @param {number} min - Minimum ms
 * @param {number} max - Maximum ms
 */
function randomDelay(min, max) {
	return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

// ============================================================================
// PAGE MANAGEMENT
// ============================================================================

/**
 * Gets or creates the main page for UI interactions
 * @returns {Promise<PlaywrightPage>}
 */
async function getMainPage() {
	if (mainPage && browserInstance?.isConnected() && !mainPage.isClosed()) {
		return mainPage;
	}

	const { context } = await getBrowser();
	mainPage = await context.newPage();

	// Navigate to the currency converter page
	await mainPage.goto(MASTERCARD_UI_PAGE, { waitUntil: "domcontentloaded", timeout: 30000 });

	// Handle cookie consent if present
	await handleCookieConsent(mainPage);

	// Wait for the form to be ready (from currency dropdown)
	await mainPage.waitForSelector("#tCurrency", { timeout: 15000 });

	console.log("[MASTERCARD-V2] Page loaded and ready");
	return mainPage;
}

/**
 * Handles cookie consent dialog if present
 * @param {PlaywrightPage} page
 */
async function handleCookieConsent(page) {
	try {
		// Wait for cookie banner to potentially appear
		await sleep(1500);
		
		// Use JavaScript to click "Accept cookies" - more reliable than Playwright click
		// when there are overlay timing issues
		const clicked = await page.evaluate(() => {
			// Find the accept cookies button by its text content
			const buttons = document.querySelectorAll("button");
			for (const btn of buttons) {
				if (btn.textContent?.trim() === "Accept cookies") {
					btn.click();
					return true;
				}
			}
			return false;
		});
		
		if (clicked) {
			await sleep(500);
			console.log("[MASTERCARD-V2] Cookie consent accepted");
		}
		
		// Also remove any lingering overlay that might block clicks
		await page.evaluate(() => {
			const darkFilter = document.querySelector(".onetrust-pc-dark-filter");
			if (darkFilter) darkFilter.remove();
		});
	} catch {
		// Cookie consent not present or already handled
	}
}

// ============================================================================
// UI INTERACTION HELPERS
// ============================================================================

/**
 * Selects a currency from a dropdown by searching and clicking
 * @param {PlaywrightPage} page
 * @param {'from' | 'to'} dropdownType - Which dropdown to interact with
 * @param {CurrencyCode} currencyCode - Currency code to select
 */
async function selectCurrency(page, dropdownType, currencyCode) {
	// Button IDs: #tCurrency (from), #cardCurrency (to)
	const buttonId = dropdownType === "from" ? "#tCurrency" : "#cardCurrency";
	const dropdownSelector = `${buttonId} + ul`;

	// Click dropdown button with force option to bypass any overlay checks
	await page.click(buttonId, { force: true });
	await randomDelay(500, 600);

	// Wait for the dropdown to appear
	await page.waitForSelector(dropdownSelector, { state: "visible", timeout: 5000 });
	
	// Find the search input WITHIN this specific dropdown using JS and fill it
	await page.evaluate(({ selector, code }) => {
		const dropdown = document.querySelector(selector);
		if (!dropdown) throw new Error("Dropdown not found");
		
		// Find the search input in this dropdown
		const searchInput = dropdown.querySelector("input[type='text'], input[placeholder='Search']");
		if (!searchInput) throw new Error("Search input not found in dropdown");
		
		// Focus and fill the search input
		searchInput.focus();
		searchInput.value = code;
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));
	}, { selector: dropdownSelector, code: currencyCode });
	
	await randomDelay(500, 600); // Wait for filtering to complete

	// Click the matching currency option
	const clicked = await page.evaluate(({ selector, code }) => {
		const dropdown = document.querySelector(selector);
		if (!dropdown) {
			return { success: false, error: "Dropdown container not found" };
		}
		
		// Find all anchor links in the dropdown
		const links = dropdown.querySelectorAll("a");
		for (const link of links) {
			// Normalize whitespace in text for matching
			const text = (link.textContent || "").replace(/\s+/g, " ").trim();
			if (text.includes(`- ${code}`)) {
				link.click();
				return { success: true, found: text };
			}
		}
		
		// Debug: return what we found
		const allLinks = Array.from(links).map(l => (l.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
		return { success: false, found: null, available: allLinks.slice(0, 5) };
	}, { selector: dropdownSelector, code: currencyCode });
	
	if (!clicked.success) {
		console.error(`[MASTERCARD-V2] Currency ${currencyCode} not found. Debug:`, clicked);
		throw new Error(`Currency ${currencyCode} not found in dropdown`);
	}
	
	await randomDelay(200, 300);
}

/**
 * Fills the amount field using JavaScript to ensure proper event triggering
 * @param {PlaywrightPage} page
 * @param {string} amount
 */
async function fillAmount(page, amount) {
	await page.evaluate((val) => {
		const input = document.querySelector("#txtTAmt");
		if (!input) throw new Error("Amount input #txtTAmt not found");
		input.focus();
		input.value = val;
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, amount);
	await randomDelay(50, 100);
}

/**
 * Fills the bank fee field using JavaScript to ensure proper event triggering
 * for the underlying data binding framework
 * @param {PlaywrightPage} page
 * @param {string} fee
 */
async function fillBankFee(page, fee) {
	await page.evaluate((val) => {
		const input = document.querySelector("#BankFee");
		if (!input) throw new Error("Bank fee input #BankFee not found");
		input.focus();
		input.value = val;
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, fee);
	await randomDelay(50, 100);
}

/**
 * Converts a YYYY-MM-DD date to the format needed for the date picker
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {{ day: number, month: string, monthValue: string, year: number }}
 */
function parseDate(date) {
	const [year, month, day] = date.split("-").map(Number);
	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];
	return {
		day,
		month: months[month - 1],
		monthValue: String(month - 1), // jQuery UI uses 0-indexed month values
		year
	};
}

/**
 * Selects a date using the jQuery UI date picker.
 * IMPORTANT: Both currencies must be selected BEFORE calling this function,
 * otherwise the date picker may not trigger the API request correctly.
 * 
 * The jQuery UI datepicker uses td[data-handler="selectDay"] elements as the
 * click targets - clicking the inner <a> element does NOT trigger the handler.
 * 
 * @param {PlaywrightPage} page
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function selectDate(page, date) {
	const { day, monthValue, year } = parseDate(date);

	// Click the date input to open picker using Playwright click (simulates real mouse)
	// The date input ID is "getDate"
	await page.click("#getDate", { force: true });
	await randomDelay(400, 500);

	// Wait for the datepicker calendar table to become visible
	// Use the calendar table itself which is cleaner than checking the container div
	await page.waitForSelector("table.ui-datepicker-calendar", { 
		state: "visible", 
		timeout: 5000 
	});
	await randomDelay(200, 300);

	// Select year first using JavaScript - triggers calendar re-render
	const yearChanged = await page.evaluate((targetYear) => {
		const yearSelect = document.querySelector(".ui-datepicker-year");
		if (!yearSelect) return { success: false, error: "Year select not found" };
		const option = yearSelect.querySelector(`option[value="${targetYear}"]`);
		if (!option) return { success: false, error: `Year ${targetYear} not in options` };
		yearSelect.value = targetYear.toString();
		yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
		return { success: true };
	}, year);
	
	if (!yearChanged.success) {
		throw new Error(`Year ${year} not available in datepicker: ${yearChanged.error}`);
	}
	await randomDelay(300, 400); // Calendar re-renders after year change

	// Select month using JavaScript - triggers calendar re-render
	const monthChanged = await page.evaluate((targetMonth) => {
		const monthSelect = document.querySelector(".ui-datepicker-month");
		if (!monthSelect) return { success: false, error: "Month select not found" };
		const option = monthSelect.querySelector(`option[value="${targetMonth}"]`);
		if (!option) return { success: false, error: `Month ${targetMonth} not in options` };
		monthSelect.value = targetMonth;
		monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
		return { success: true };
	}, monthValue);
	
	if (!monthChanged.success) {
		throw new Error(`Month not available in datepicker: ${monthChanged.error}`);
	}
	await randomDelay(300, 400); // Calendar re-renders after month change

	// Click the day by clicking the TD element (NOT the inner <a> link!)
	// jQuery UI datepicker binds the click handler to td[data-handler="selectDay"]
	const dayClicked = await page.evaluate((targetDay) => {
		const calendarTable = document.querySelector("table.ui-datepicker-calendar");
		if (!calendarTable) return { success: false, error: "Calendar table not found" };
		
		// Find all TDs with the selectDay handler
		const tds = calendarTable.querySelectorAll('td[data-handler="selectDay"]');
		
		for (const td of tds) {
			const link = td.querySelector("a");
			if (link && link.textContent.trim() === String(targetDay)) {
				// Click the TD element - this triggers jQuery UI's handler
				td.click();
				return { success: true, clickedDay: targetDay };
			}
		}
		
		// Day not found - it might be disabled (future date or out of range)
		const availableDays = Array.from(tds).map(td => {
			const link = td.querySelector("a");
			return link ? link.textContent.trim() : null;
		}).filter(Boolean);
		
		return { 
			success: false, 
			error: `Day ${targetDay} not clickable`,
			availableDays: availableDays.slice(0, 10)
		};
	}, day);

	if (!dayClicked.success) {
		throw new Error(`Date ${date} not clickable: ${dayClicked.error}`);
	}

	await randomDelay(200, 300);
	
	// Verify the date was actually set by checking the input value
	const actualValue = await page.evaluate(() => {
		const dateInput = document.querySelector("#getDate");
		return dateInput ? dateInput.value : null;
	});
	
	if (!actualValue || !actualValue.includes(String(day))) {
		console.warn(`[MASTERCARD-V2] Date selection verification: expected day ${day}, got "${actualValue}"`);
	}
}

// ============================================================================
// RATE FETCHING
// ============================================================================

/**
 * @typedef {Object} ConversionResult
 * @property {number | null} rate - The conversion rate, or null if unavailable
 * @property {string | null} error - Error message if any
 */

/**
 * Fetches exchange rate for a single date/currency pair by:
 * 1. Setting up a network request interceptor
 * 2. Filling the form with currencies, amount, bank fee, and date
 * 3. Capturing the API response from the background request
 *
 * The form auto-calculates when all required fields are valid.
 * The API request is triggered once the form is complete.
 *
 * @param {PlaywrightPage} page
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {CurrencyCode} from - Source currency code
 * @param {CurrencyCode} to - Target currency code
 * @returns {Promise<ConversionResult>}
 */
async function fetchSingleRate(page, date, from, to) {
	/** @type {ConversionResult} */
	const result = { rate: null, error: null };

	// Set up promise to capture the API response
	let resolveApiResponse;
	let apiResolved = false;
	const apiResponsePromise = new Promise((resolve) => {
		resolveApiResponse = (value) => {
			if (!apiResolved) {
				apiResolved = true;
				resolve(value);
			}
		};
	});

	// Response handler to capture the conversion rate API call
	const responseHandler = async (response) => {
		const url = response.url();
		// Only match responses that contain our target date (to avoid capturing fxDate=0000-00-00 calls)
		if (MASTERCARD_API_PATTERN.test(url) && url.includes(`fxDate=${date}`)) {
			try {
				const status = response.status();
				
				// Handle HTTP errors
				if (status === 403) {
					resolveApiResponse({ error: "HTTP 403 Forbidden - session may have expired" });
					return;
				}
				
				if (status !== 200) {
					resolveApiResponse({ error: `HTTP ${status}` });
					return;
				}

				const json = await response.json();

				// Check for API errors
				if (json.type === "error" || json.data?.errorCode) {
					const errorMsg = json.data?.errorMessage || "Unknown API error";
					resolveApiResponse({ error: errorMsg });
					return;
				}

				const rate = json.data?.conversionRate;
				if (rate) {
					resolveApiResponse({ rate: parseFloat(rate) });
				} else {
					resolveApiResponse({ error: "Missing conversionRate in response" });
				}
			} catch (err) {
				resolveApiResponse({ error: `Failed to parse response: ${err.message}` });
			}
		}
	};

	// Register response handler BEFORE filling the form
	page.on("response", responseHandler);

	try {
		// Fill all fields - API is triggered once form is valid
		
		// 1. Select "From" currency
		await selectCurrency(page, "from", from);

		// 2. Fill amount (always 1 for rate calculation)
		await fillAmount(page, "1");

		// 3. Select "To" currency  
		await selectCurrency(page, "to", to);

		// 4. Fill bank fee (always 0 for pure rate)
		await fillBankFee(page, "0");

		// 5. Select date - typically the last field to trigger calculation
		await selectDate(page, date);

		// Give the form a moment to trigger the API
		await sleep(500);

		// Wait for API response with timeout
		const apiResult = await Promise.race([
			apiResponsePromise,
			sleep(10000).then(() => ({ error: "Timeout waiting for API response" }))
		]);

		if (apiResult.error) {
			result.error = apiResult.error;
		} else if (apiResult.rate) {
			result.rate = apiResult.rate;
		}
	} catch (err) {
		result.error = err.message;
	} finally {
		// Remove response handler
		page.off("response", responseHandler);
	}

	return result;
}

/**
 * Resets the form for the next query by clearing selections
 * @param {PlaywrightPage} page
 */
async function resetForm(page) {
	// Reload page to reset form state - simpler than clearing individual fields
	await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
	await handleCookieConsent(page);
	await page.waitForSelector("#tCurrency", { timeout: 10000 });
	await randomDelay(200, 400);
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Fetches exchange rates for multiple date/pair combinations.
 * Processes sequentially with session management, simulating UI interactions.
 * Writes results directly to csv-store.
 *
 * @param {BatchRequest[]} requests - Array of {date, from, to} objects
 * @returns {Promise<void>}
 */
export async function fetchBatch(requests) {
	if (requests.length === 0) {
		console.log("[MASTERCARD-V2] No requests to process");
		return;
	}

	console.log(`\n[MASTERCARD-V2] Starting: ${requests.length} requests (UI simulation mode)`);
	console.log(`[MASTERCARD-V2] Browser restart: every ${config.browserRestartInterval} requests`);

	let successCount = 0;
	let failCount = 0;
	let unavailableCount = 0;

	try {
		let requestCounter = 0;

		for (let i = 0; i < requests.length; i++) {
			const { date, from, to } = requests[i];

			// Browser restart check - prevents session staleness
			if (requestCounter % config.browserRestartInterval === 0 && requestCounter > 0) {
				console.log(`[MASTERCARD-V2] Restarting browser after ${requestCounter} requests`);
				await closeBrowser();
				await sleep(config.sessionRefreshDelayMs * 2);
			}

			try {
				const page = await getMainPage();
				
				// Reset form before each request to ensure clean state
				// This prevents stale data from previous requests
				if (requestCounter > 0) {
					await resetForm(page);
				}
				
				const result = await fetchSingleRate(page, date, from, to);

				if (result.rate !== null) {
					// Save successful result
					const record = {
						date,
						from_curr: from,
						to_curr: to,
						provider: PROVIDER_NAME,
						rate: result.rate,
						markup: null
					};

					const inserted = store.add(record);
					if (inserted > 0) {
						console.log(`[MASTERCARD-V2] SAVED ${date} ${from}/${to}: ${result.rate}`);
						successCount++;
					} else {
						console.log(`[MASTERCARD-V2] SKIPPED ${date} ${from}/${to}: ${result.rate} (duplicate)`);
						successCount++; // Still count as success since we got the rate
					}
				} else if (result.error) {
					// Handle specific error cases
					const errorLower = result.error.toLowerCase();
					if (
						errorLower.includes("outside of approved historical rate range") ||
						errorLower.includes("not selectable") ||
						errorLower.includes("out of range") ||
						errorLower.includes("not found in picker")
					) {
						console.log(`[MASTERCARD-V2] UNAVAILABLE ${date} ${from}/${to}: ${result.error}`);
						unavailableCount++;
					} else if (errorLower.includes("403") || errorLower.includes("forbidden")) {
						// HTTP 403 - need to restart browser and pause
						console.error(`[MASTERCARD-V2] 403 Forbidden - pausing ${config.pauseOnForbiddenMs / 1000}s`);
						failCount++;
						await closeBrowser();
						await sleep(config.pauseOnForbiddenMs);
						console.log("[MASTERCARD-V2] Resuming after 403 pause");
					} else {
						console.error(`[MASTERCARD-V2] FAILED ${date} ${from}/${to}: ${result.error}`);
						failCount++;
					}
				}

				// Delay between requests
				await sleep(config.batchDelayMs);
			} catch (error) {
				console.error(`[MASTERCARD-V2] FAILED ${date} ${from}/${to}: ${error.message}`);
				failCount++;

				// On timeout or critical errors, restart browser
				if (error.message.includes("Timeout") || error.message.includes("Target closed")) {
					console.log("[MASTERCARD-V2] Critical error - restarting browser");
					await closeBrowser();
					await sleep(config.sessionRefreshDelayMs * 2);
				}
			}

			requestCounter++;

			// Progress reporting
			if ((i + 1) % 10 === 0 || i === requests.length - 1) {
				const pct = Math.round(((i + 1) / requests.length) * 100);
				console.log(`[MASTERCARD-V2] Progress: ${i + 1}/${requests.length} (${pct}%)`);
			}
		}

		console.log(`\n[MASTERCARD-V2] Complete:`);
		console.log(`  - Success: ${successCount}`);
		console.log(`  - Failed: ${failCount}`);
		console.log(`  - Unavailable: ${unavailableCount}`);
	} catch (error) {
		console.error(`[MASTERCARD-V2] Fatal error: ${error.message}`);
		throw error;
	} finally {
		await closeBrowser();
	}
}

export { PROVIDER_NAME };
