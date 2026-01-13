#!/usr/bin/env bun
/**
 * Test script for Mastercard V2 batch client
 * 
 * Tests the UI simulation approach by fetching a few sample rates.
 * 
 * Usage: bun run backend/test-mc-v2.js
 */

import { fetchBatch } from "./mastercard-client-batch-v2.js";

// Test with a few sample requests - using recent dates that should work
// Note: The store will deduplicate, so if data already exists, it will report SKIPPED
const testRequests = [
	// Recent date - should work
	{ date: "2026-01-10", from: "USD", to: "EUR" },
	{ date: "2026-01-09", from: "EUR", to: "USD" },
	// Different currency pair
	{ date: "2026-01-08", from: "GBP", to: "JPY" },
];

console.log("=== Mastercard V2 Client Test ===\n");
console.log(`Testing with ${testRequests.length} requests...\n`);

try {
	await fetchBatch(testRequests);
	console.log("\n=== Test Complete ===");
} catch (error) {
	console.error("\n=== Test Failed ===");
	console.error(error);
	process.exit(1);
}
