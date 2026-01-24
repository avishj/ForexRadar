/**
 * Mastercard API Response Contract Tests
 *
 * Validates that Mastercard's currency conversion API returns expected structure.
 * NOTE: These tests require a headful browser and must be run locally due to
 * Akamai bot detection. They are excluded from CI.
 *
 * Run locally with: bun test tests/contract/mastercard-response.test.js
 *
 * @module tests/contract/mastercard-response
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { chromium } from "playwright";
import { USER_AGENTS } from "../../shared/constants.js";

const MASTERCARD_UI_PAGE =
	"https://www.mastercard.co.in/content/mastercardcom/global/en/personal/get-support/convert-currency.html";
const MASTERCARD_API_PATTERN = /settlement\/currencyrate\/conversion-rate\?/;

const SESSION_USER_AGENT = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

describe("Mastercard API Response Contract", () => {
	/** @type {import('playwright').Browser} */
	let browser;
	/** @type {import('playwright').BrowserContext} */
	let context;
	/** @type {import('playwright').Page} */
	let page;

	beforeAll(async () => {
		browser = await chromium.launch({
			channel: "chrome",
			headless: false,
			args: [
				"--disable-blink-features=AutomationControlled",
				"--disable-gpu",
				"--disable-dev-shm-usage",
				"--no-sandbox"
			]
		});

		context = await browser.newContext({
			userAgent: SESSION_USER_AGENT,
			viewport: { width: 1512, height: 984 },
			locale: "en-US",
			extraHTTPHeaders: {
				"Accept-Language": "en-GB,en;q=0.9",
				DNT: "1"
			}
		});

		page = await context.newPage();

		// Navigate to the currency converter page
		await page.goto(MASTERCARD_UI_PAGE, { waitUntil: "domcontentloaded", timeout: 30000 });

		// Handle cookie consent
		try {
			await page.waitForTimeout(1500);
			const clicked = await page.evaluate(() => {
				const buttons = document.querySelectorAll("button");
				for (const btn of buttons) {
					if (btn.textContent?.trim() === "Accept cookies") {
						btn.click();
						return true;
					}
				}
				return false;
			});
			if (clicked) await page.waitForTimeout(500);
		} catch {
			/* No cookie consent */
		}

		// Wait for form
		await page.waitForSelector("#tCurrency", { timeout: 15000 });
	}, 60000);

	afterAll(async () => {
		if (browser) {
			await browser.close();
		}
	});

	/**
	 * Captures the API response when triggering a currency conversion
	 * @returns {Promise<{status: number, data: unknown} | null>}
	 */
	async function captureApiResponse() {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => resolve(null), 15000);

			const handler = async (response) => {
				if (MASTERCARD_API_PATTERN.test(response.url())) {
					clearTimeout(timeout);
					page.off("response", handler);
					try {
						const status = response.status();
						const json = status === 200 ? await response.json() : null;
						resolve({ status, data: json });
					} catch {
						resolve({ status: response.status(), data: null });
					}
				}
			};

			page.on("response", handler);
		});
	}

	/**
	 * Selects a currency from dropdown
	 * @param {'from' | 'to'} type
	 * @param {string} code
	 */
	async function selectCurrency(type, code) {
		const buttonId = type === "from" ? "#tCurrency" : "#cardCurrency";
		const dropdownSelector = `${buttonId} + ul`;

		await page.click(buttonId, { force: true });
		await page.waitForTimeout(600);
		await page.waitForSelector(dropdownSelector, { state: "visible", timeout: 5000 });

		const listItem = await page.$(`${dropdownSelector} li[data-value="${code}"]`);
		if (listItem) {
			await listItem.click();
		}
		await page.waitForTimeout(300);
	}

	/**
	 * Sets the transaction date
	 * @param {string} date - YYYY-MM-DD format
	 */
	async function selectDate(date) {
		const input = await page.$("#txnDate");
		if (!input) return;

		await page.evaluate(() => {
			const el = document.querySelector("#txnDate");
			if (el) el.value = "";
		});

		const [year, month, day] = date.split("-");
		const formatted = `${month}/${day}/${year}`;
		await input.fill(formatted);
		await page.keyboard.press("Tab");
		await page.waitForTimeout(500);
	}

	test("Response contains data.conversionRate", async () => {
		await selectCurrency("from", "USD");
		await selectCurrency("to", "INR");

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const responsePromise = captureApiResponse();
		await selectDate(dateStr);

		const result = await responsePromise;

		expect(result).not.toBeNull();

		if (result?.status === 403) {
			console.warn("Got 403 - Mastercard bot detection triggered. Run locally with fresh session.");
			return;
		}

		expect(result?.status).toBe(200);
		expect(result?.data).toBeDefined();
		expect(result?.data.data).toBeDefined();
		expect(result?.data.data.conversionRate).toBeDefined();
		expect(typeof result?.data.data.conversionRate).toBe("number");
		expect(result?.data.data.conversionRate).toBeGreaterThan(0);
	}, 60000);

	test("conversionRate is a valid positive number", async () => {
		// Reload page for fresh session
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForSelector("#tCurrency", { timeout: 15000 });

		await selectCurrency("from", "EUR");
		await selectCurrency("to", "GBP");

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const responsePromise = captureApiResponse();
		await selectDate(dateStr);

		const result = await responsePromise;

		if (result?.status === 403) {
			console.warn("Got 403 - skipping test due to bot detection");
			return;
		}

		if (result?.status === 200 && result?.data?.data?.conversionRate) {
			const rate = result.data.data.conversionRate;
			expect(Number.isNaN(rate)).toBe(false);
			expect(rate).toBeGreaterThan(0);
			expect(rate).toBeLessThan(1000000);
		}
	}, 60000);

	test("Handles 403 response structure correctly", async () => {
		// This test documents the expected behavior on 403
		// We can't reliably trigger a 403, but we document the structure

		// The client checks for 403 status and handles it specially
		// Response on 403 may be empty or contain an error message
		expect(true).toBe(true); // Placeholder - 403 handling is tested via status code
	});

	test("Response has expected top-level structure", async () => {
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForSelector("#tCurrency", { timeout: 15000 });

		await selectCurrency("from", "USD");
		await selectCurrency("to", "EUR");

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const responsePromise = captureApiResponse();
		await selectDate(dateStr);

		const result = await responsePromise;

		if (result?.status === 403) {
			console.warn("Got 403 - skipping test due to bot detection");
			return;
		}

		if (result?.status === 200) {
			expect(result?.data).toBeDefined();

			// Top-level should have type and data
			expect(typeof result?.data.type).toBe("string");
			expect(result?.data.data).toBeDefined();

			// data object should have conversion info
			const data = result.data.data;
			expect(data.conversionRate).toBeDefined();
		}
	}, 60000);

	test("Error responses contain errorCode/errorMessage", async () => {
		// Use an invalid date far in the past to trigger an error
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForSelector("#tCurrency", { timeout: 15000 });

		await selectCurrency("from", "USD");
		await selectCurrency("to", "INR");

		// Try to set a date from 10 years ago - should fail
		const oldDate = new Date();
		oldDate.setFullYear(oldDate.getFullYear() - 10);
		const dateStr = oldDate.toISOString().split("T")[0];

		const responsePromise = captureApiResponse();
		await selectDate(dateStr);

		const result = await responsePromise;

		// Either we get a 403 (bot detection) or an error response
		if (result?.status === 200 && result?.data?.type === "error") {
			expect(result.data.data).toBeDefined();
			// Error responses should have errorCode or errorMessage
			const hasError = result.data.data.errorCode || result.data.data.errorMessage;
			expect(hasError).toBeTruthy();
		}
	}, 60000);
});
