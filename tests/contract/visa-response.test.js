/**
 * Visa API Response Contract Tests
 *
 * Validates that Visa's FX API returns the expected response shape.
 * Runs against the live API to catch API changes early.
 *
 * @module tests/contract/visa-response
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { firefox } from "playwright";

const VISA_API_BASE = "https://www.visa.co.in/cmsapi/fx/rates";

describe("Visa API Response Contract", () => {
	/** @type {import('playwright').Browser} */
	let browser;
	/** @type {import('playwright').BrowserContext} */
	let context;

	beforeAll(async () => {
		browser = await firefox.launch({ headless: true });
		context = await browser.newContext({
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
			extraHTTPHeaders: {
				"Accept-Language": "en-US,en;q=0.9"
			}
		});
	});

	afterAll(async () => {
		if (browser) {
			await browser.close();
		}
	});

	/**
	 * Fetches a rate from Visa API and returns the response
	 * @param {string} from - Source currency
	 * @param {string} to - Target currency
	 * @returns {Promise<{status: number, data: unknown}>}
	 */
	async function fetchVisaRate(from, to) {
		const today = new Date();
		const formattedDate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

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
				} catch {
					/* Response body unavailable */
				}
			}
		});

		await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
		if (!apiResponse) await page.waitForTimeout(3000);
		await page.close();

		return {
			status: apiStatus,
			data: apiResponse ? JSON.parse(apiResponse) : null
		};
	}

	test("Response contains originalValues.fxRateVisa", async () => {
		const { status, data } = await fetchVisaRate("USD", "INR");

		expect(status).toBe(200);
		expect(data).toBeDefined();
		expect(data.originalValues).toBeDefined();
		expect(data.originalValues.fxRateVisa).toBeDefined();
		expect(typeof data.originalValues.fxRateVisa).toBe("string");
		expect(parseFloat(data.originalValues.fxRateVisa)).toBeGreaterThan(0);
	}, 60000);

	test("Response contains conversionAmountValue for fallback calculation", async () => {
		const { status, data } = await fetchVisaRate("USD", "EUR");

		expect(status).toBe(200);
		expect(data).toBeDefined();
		expect(data.conversionAmountValue).toBeDefined();
		expect(typeof data.conversionAmountValue).toBe("string");
	}, 60000);

	test("Response includes benchmarkRates markup data", async () => {
		const { status, data } = await fetchVisaRate("USD", "GBP");

		expect(status).toBe(200);
		expect(data).toBeDefined();
		// benchMarkAmount contains the markup percentage
		expect(data.benchMarkAmount).toBeDefined();
		expect(typeof data.benchMarkAmount).toBe("string");
	}, 60000);

	test("Response has expected top-level structure", async () => {
		const { status, data } = await fetchVisaRate("EUR", "JPY");

		expect(status).toBe(200);
		expect(data).toBeDefined();

		// Core fields required for rate extraction
		expect(data.originalValues).toBeDefined();
		expect(data.conversionAmountValue).toBeDefined();
	}, 60000);

	test("fxRateVisa is a valid positive number string", async () => {
		const { status, data } = await fetchVisaRate("GBP", "INR");

		expect(status).toBe(200);

		const rate = parseFloat(data.originalValues.fxRateVisa);
		expect(Number.isNaN(rate)).toBe(false);
		expect(rate).toBeGreaterThan(0);
		expect(rate).toBeLessThan(1000000); // Sanity check
	}, 60000);
});
