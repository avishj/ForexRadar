#!/usr/bin/env bun
/**
 * Test script for Mastercard V2 batch client
 * 
 * Tests the UI simulation approach by fetching a few sample rates.
 * 
 * Usage: bun run backend/test-mc-v2.js
 */

import { fetchBatch } from "./mastercard-client-batch-v2.js";

/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */

// Test with requests that demonstrate grouping optimization
// Same currency pairs with multiple dates will be processed together
/** @type {BatchRequest[]} */
const testRequests = [
	// VND/USD - 3 dates (will be grouped)
	{ date: "2026-01-13", from: /** @type {const} */ ("VND"), to: /** @type {const} */ ("USD") },
	{ date: "2026-01-12", from: /** @type {const} */ ("VND"), to: /** @type {const} */ ("USD") },
	{ date: "2026-01-11", from: /** @type {const} */ ("VND"), to: /** @type {const} */ ("USD") },
	// USD/EUR - 2 dates (will be grouped)
	{ date: "2026-01-13", from: /** @type {const} */ ("USD"), to: /** @type {const} */ ("EUR") },
	{ date: "2026-01-12", from: /** @type {const} */ ("USD"), to: /** @type {const} */ ("EUR") },
	// GBP/JPY - 1 date
	{ date: "2026-01-11", from: /** @type {const} */ ("GBP"), to: /** @type {const} */ ("JPY") },
];

console.log("=== Mastercard V2 Client Test ===\n");
console.log(`Testing with ${testRequests.length} requests...\n`);

try {
	await fetchBatch(testRequests);
    console.log("\n=== Test Complete ===");
    process.exit(0);
} catch (error) {
	console.error("\n=== Test Failed ===");
	console.error(error);
	process.exit(1);
}
