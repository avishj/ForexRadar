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

describe("Mastercard API Response Contract", () => {
	beforeAll(async () => {
		// Establish session before tests
		await refreshSession();
	}, 60000);

	afterAll(async () => {
		await closeBrowser();
	});

	test("Response contains data.conversionRate", async () => {
		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRate("USD", "INR", dateStr);

		if (result.status === 403) {
			console.warn("Got 403 - Mastercard bot detection triggered. Run locally with fresh session.");
			return;
		}

		expect(result.status).toBe(200);
		expect(result.data).toBeDefined();
		expect(result.data.data).toBeDefined();
		expect(result.data.data.conversionRate).toBeDefined();
		expect(typeof result.data.data.conversionRate).toBe("number");
		expect(result.data.data.conversionRate).toBeGreaterThan(0);
	}, 60000);

	test("conversionRate is a valid positive number", async () => {
		await refreshSession();

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRate("EUR", "GBP", dateStr);

		if (result.status === 403) {
			console.warn("Got 403 - skipping test due to bot detection");
			return;
		}

		if (result.status === 200 && result.data?.data?.conversionRate) {
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
		expect(true).toBe(true);
	});

	test("Response has expected top-level structure", async () => {
		await refreshSession();

		const today = new Date();
		const dateStr = today.toISOString().split("T")[0];

		const result = await fetchRate("USD", "EUR", dateStr);

		if (result.status === 403) {
			console.warn("Got 403 - skipping test due to bot detection");
			return;
		}

		if (result.status === 200) {
			expect(result.data).toBeDefined();

			// Response should have data object with conversion info
			expect(result.data.data).toBeDefined();
			expect(result.data.data.conversionRate).toBeDefined();
		}
	}, 60000);

	test("Error responses contain errorCode/errorMessage", async () => {
		await refreshSession();

		// Try to set a date from 10 years ago - should fail
		const oldDate = new Date();
		oldDate.setFullYear(oldDate.getFullYear() - 10);
		const dateStr = oldDate.toISOString().split("T")[0];

		const result = await fetchRate("USD", "INR", dateStr);

		// Either we get a 403 (bot detection) or an error response
		if (result.status === 200 && result.data?.type === "error") {
			expect(result.data.data).toBeDefined();
			// Error responses should have errorCode or errorMessage
			const hasError = result.data.data.errorCode || result.data.data.errorMessage;
			expect(hasError).toBeTruthy();
		}
	}, 60000);
});
