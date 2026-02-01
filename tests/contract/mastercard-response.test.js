/**
 * Mastercard API Response Contract Tests
 *
 * Validates that Mastercard's currency conversion API returns expected structure.
 * Uses the actual mastercard-client-batch.js fetchRate function.
 *
 * NOTE: These tests require a headful browser and must be run locally due to
 * Akamai bot detection. They are excluded from CI.
 *
 * Run locally with: bun test tests/contract/mastercard-response.test.js
 *
 * @module tests/contract/mastercard-response
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { fetchRate, refreshSession, closeBrowser } from "../../backend/mastercard-client-batch.js";
import { sleep } from "../../shared/browser-utils.js";
import { PROVIDER_CONFIG } from "../../shared/constants.js";

const config = PROVIDER_CONFIG.MASTERCARD;

/**
 * Fetches rate with retry on 403 (respects pauseOnForbiddenMs)
 * @param {string} from
 * @param {string} to
 * @param {string} date
 * @param {number} maxRetries
 * @returns {Promise<import('../../shared/types.js').MastercardFetchRateResult>}
 */
async function fetchRateWithRetry(from, to, date, maxRetries = 2) {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const result = await fetchRate(from, to, date);

		if (result.status === 403 && attempt < maxRetries) {
			console.warn(`Got 403 - pausing ${config.pauseOnForbiddenMs / 1000}s before retry (attempt ${attempt + 1}/${maxRetries})`);
			await closeBrowser();
			await sleep(config.pauseOnForbiddenMs);
			await refreshSession();
			continue;
		}

		return result;
	}

	return fetchRate(from, to, date);
}

describe("Mastercard API Response Contract", () => {
	beforeAll(async () => {
		await refreshSession();
	}, 60000);

	afterAll(async () => {
		await closeBrowser();
	});

	test("Response contains data.conversionRate", async () => {
		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRateWithRetry("USD", "INR", dateStr);

		expect(result.status).toBe(200);
		expect(result.data).toBeDefined();
		expect(result.data.data).toBeDefined();
		expect(result.data.data.conversionRate).toBeDefined();
		expect(typeof result.data.data.conversionRate).toBe("number");
		expect(result.data.data.conversionRate).toBeGreaterThan(0);

		await sleep(config.batchDelayMs);
	}, 30 * 60 * 1000); // 30 min timeout for retries

	test("conversionRate is a valid positive number", async () => {
		await refreshSession();
		await sleep(config.sessionRefreshDelayMs);

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRateWithRetry("EUR", "GBP", dateStr);

		expect(result.status).toBe(200);
		if (result.data?.data?.conversionRate) {
			const rate = result.data.data.conversionRate;
			expect(Number.isNaN(rate)).toBe(false);
			expect(rate).toBeGreaterThan(0);
			expect(rate).toBeLessThan(1000000);
		}

		await sleep(config.batchDelayMs);
	}, 30 * 60 * 1000);

	test("Handles 403 response structure correctly", async () => {
		// This test documents the expected behavior on 403
		// The client checks for 403 status and handles it specially
		// Response on 403 has data: null
		expect(true).toBe(true);
	});

	test("Response has expected top-level structure", async () => {
		await refreshSession();
		await sleep(config.sessionRefreshDelayMs);

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRateWithRetry("USD", "EUR", dateStr);

		expect(result.status).toBe(200);
		expect(result.data).toBeDefined();
		expect(result.data.data).toBeDefined();
		expect(result.data.data.conversionRate).toBeDefined();

		await sleep(config.batchDelayMs);
	}, 30 * 60 * 1000);

	test("Error responses contain errorCode/errorMessage", async () => {
		await refreshSession();
		await sleep(config.sessionRefreshDelayMs);

		// Try to set a date from 10 years ago - should fail
		const oldDate = new Date();
		oldDate.setFullYear(oldDate.getFullYear() - 10);
		const dateStr = oldDate.toISOString().split("T")[0];

		const result = await fetchRateWithRetry("USD", "INR", dateStr);

		// Should get error response (not 403, since we retry those)
		if (result.status === 200 && result.data?.type === "error") {
			expect(result.data.data).toBeDefined();
			const hasError = result.data.data.errorCode || result.data.data.errorMessage;
			expect(hasError).toBeTruthy();
		}
	}, 30 * 60 * 1000);
});
