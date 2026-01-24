/**
 * ECB XML Response Contract Tests
 *
 * Validates that ECB's exchange rate HTML/JS feed returns expected structure.
 * Runs against the live feed to catch format changes early.
 *
 * @module tests/contract/ecb-response
 */

import { describe, test, expect } from "bun:test";

const ECB_BASE_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html";

/**
 * Extract rates from ECB HTML page using the same logic as ecb-client.js
 * @param {string} html
 * @param {string} varName - 'chartData' or 'chartDataInverse'
 * @returns {Array<{year: number, month: number, day: number, rate: number}>}
 */
function extractRates(html, varName) {
	const regex = new RegExp(
		`${varName}\\.push\\(\\{\\s*date:\\s*new\\s+Date\\((\\d+),(\\d+),(\\d+)\\),\\s*rate:\\s*([\\d.]+)\\s*\\}\\)`,
		"g"
	);

	const entries = [];
	let match;
	while ((match = regex.exec(html)) !== null) {
		const [, year, month, day, rate] = match;
		entries.push({
			year: parseInt(year),
			month: parseInt(month),
			day: parseInt(day),
			rate: parseFloat(rate)
		});
	}
	return entries;
}

describe("ECB Response Contract", () => {
	test("HTML contains chartData.push statements with rate data", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-usd.en.html`;
		const response = await fetch(url);

		expect(response.ok).toBe(true);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html.length).toBeGreaterThan(1000);

		// Should contain the chartData pattern
		expect(html).toContain("chartData.push");
	}, 30000);

	test("chartData entries have valid Date format", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-usd.en.html`;
		const response = await fetch(url);
		const html = await response.text();

		const rates = extractRates(html, "chartData");

		expect(rates.length).toBeGreaterThan(0);

		// Check first entry structure
		const first = rates[0];
		expect(typeof first.year).toBe("number");
		expect(typeof first.month).toBe("number");
		expect(typeof first.day).toBe("number");
		expect(first.year).toBeGreaterThanOrEqual(1999); // ECB data starts from 1999
		expect(first.month).toBeGreaterThanOrEqual(0);
		expect(first.month).toBeLessThanOrEqual(11);
		expect(first.day).toBeGreaterThanOrEqual(1);
		expect(first.day).toBeLessThanOrEqual(31);
	}, 30000);

	test("Rate values are positive numbers", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-gbp.en.html`;
		const response = await fetch(url);
		const html = await response.text();

		const rates = extractRates(html, "chartData");

		expect(rates.length).toBeGreaterThan(0);

		for (const entry of rates) {
			expect(Number.isNaN(entry.rate)).toBe(false);
			expect(entry.rate).toBeGreaterThan(0);
		}
	}, 30000);

	test("Currency codes are 3 uppercase letters in URL pattern", async () => {
		// Test several currencies to ensure URL pattern works
		const currencies = ["usd", "gbp", "jpy", "chf", "aud"];

		for (const currency of currencies) {
			const url = `${ECB_BASE_URL}/eurofxref-graph-${currency}.en.html`;
			const response = await fetch(url);

			expect(response.ok).toBe(true);

			const html = await response.text();
			const rates = extractRates(html, "chartData");

			expect(rates.length).toBeGreaterThan(0);
		}
	}, 60000);

	test("Inverse rates (chartDataInverse) are present for bidirectional conversion", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-usd.en.html`;
		const response = await fetch(url);
		const html = await response.text();

		// Should contain inverse rates (X→EUR)
		expect(html).toContain("chartDataInverse.push");

		const inverseRates = extractRates(html, "chartDataInverse");

		expect(inverseRates.length).toBeGreaterThan(0);

		// Inverse rate should be roughly 1/direct rate
		const directRates = extractRates(html, "chartData");
		if (directRates.length > 0 && inverseRates.length > 0) {
			const directRate = directRates[directRates.length - 1].rate;
			const inverseRate = inverseRates[inverseRates.length - 1].rate;

			// They should be approximate inverses (within 1% tolerance for rounding)
			const product = directRate * inverseRate;
			expect(product).toBeGreaterThan(0.99);
			expect(product).toBeLessThan(1.01);
		}
	}, 30000);

	test("Historical data spans multiple years", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-usd.en.html`;
		const response = await fetch(url);
		const html = await response.text();

		const rates = extractRates(html, "chartData");

		// Get unique years
		const years = [...new Set(rates.map((r) => r.year))];

		// ECB provides ~5 years of history
		expect(years.length).toBeGreaterThanOrEqual(3);
	}, 30000);

	test("Unsupported currency returns 404 or empty data", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-xyz.en.html`;
		const response = await fetch(url);

		// ECB returns 404 for unsupported currencies
		expect(response.status).toBe(404);
	}, 30000);

	test("Response content type is HTML", async () => {
		const url = `${ECB_BASE_URL}/eurofxref-graph-usd.en.html`;
		const response = await fetch(url);

		const contentType = response.headers.get("content-type");
		expect(contentType).toContain("text/html");
	}, 30000);
});
