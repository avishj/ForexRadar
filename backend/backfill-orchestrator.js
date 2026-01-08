#!/usr/bin/env bun

/**
 * Backfill Orchestrator
 *
 * Optimized backfill pipeline that:
 * 1. Analyzes all currency pairs from watchlist to find missing data
 * 2. Groups missing data by provider
 * 3. Executes batch clients in parallel (if provider=all)
 *
 * Usage:
 *   node backfill-orchestrator.js
 *   node backfill-orchestrator.js --days=180
 *   node backfill-orchestrator.js --provider=visa --days=30
 *
 * @module backfill-orchestrator
 */

import { store } from './csv-store.js';
import { parseOrchestratorArgs, loadWatchlist, formatProvider } from './cli.js';
import { formatDate, parseDate, getDateRange, getProvidersToCheck } from '../shared/utils.js';
import * as VisaClientBatch from './visa-client-batch.js';
import * as MastercardClientBatch from './mastercard-client-batch.js';

/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */
/** @typedef {{ date: string, from: CurrencyCode, to: CurrencyCode, provider: Provider }} MissingDataPoint */

const SEPARATOR = '='.repeat(60);

/**
 * Analyze all currency pairs to find missing data points.
 * Uses store.has() to check for existing data.
 * 
 * @param {CurrencyPair[]} pairs
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string[]} providers - Provider names in uppercase
 * @returns {MissingDataPoint[]}
 */
function analyzeGaps(pairs, startDate, endDate, providers) {
  console.log(`\n${SEPARATOR}`);
  console.log('Analyzing Data Gaps');
  console.log(SEPARATOR);
  console.log(`Pairs: ${pairs.length}`);
  console.log(`Date range: ${endDate} -> ${startDate}`);
  console.log(`Providers: ${providers.join(', ')}`);
  
	const missing = [];

	// Generate all dates in range (use parseDate to avoid timezone issues)
	const currentDate = parseDate(startDate);
	const stopDate = parseDate(endDate);
	const dates = [];

	while (currentDate >= stopDate) {
		dates.push(formatDate(currentDate));
		currentDate.setDate(currentDate.getDate() - 1);
	}
  
  console.log(`\nScanning ${dates.length} dates x ${pairs.length} pairs x ${providers.length} providers...`);
  
  let totalChecks = 0;
  let missingCount = 0;
  
  // Check each combination
  for (const pair of pairs) {
    for (const date of dates) {
		for (const provider of providers) {
			totalChecks++;

			if (!store.has(date, pair.from, pair.to, /** @type {Provider} */ (provider))) {
				missing.push({
					date,
					from: pair.from,
					to: pair.to,
					provider: /** @type {Provider} */ (provider),
				});
				missingCount++;
			}
		}
	}
  }
  
  const existingCount = totalChecks - missingCount;
  const existingPct = ((existingCount / totalChecks) * 100).toFixed(1);
  
  console.log(`\nAnalysis complete`);
  console.log(`  Total checks: ${totalChecks.toLocaleString()}`);
  console.log(`  Existing: ${existingCount.toLocaleString()} (${existingPct}%)`);
  console.log(`  Missing: ${missingCount.toLocaleString()}`);
  
  return missing;
}

/**
 * Group missing data points by provider
 */
function groupByProvider(missingData) {
  const grouped = {
    VISA: [],
    MASTERCARD: []
  };
  
  for (const item of missingData) {
    if (item.provider === 'VISA') {
      grouped.VISA.push({ date: item.date, from: item.from, to: item.to });
    } else if (item.provider === 'MASTERCARD') {
      grouped.MASTERCARD.push({ date: item.date, from: item.from, to: item.to });
    }
  }
  
  return grouped;
}

/**
 * Execute batch fetch for a provider
 */
async function executeProviderBatch(provider, requests) {
  if (requests.length === 0) {
    console.log(`[${provider}] No missing data to fetch`);
    return;
  }
  
  console.log(`\n${SEPARATOR}`);
  console.log(`Executing ${provider} Batch`);
  console.log(SEPARATOR);
  console.log(`Requests: ${requests.length.toLocaleString()}`);
  
  try {
    if (provider === 'VISA') {
      await VisaClientBatch.fetchBatch(requests);
    } else if (provider === 'MASTERCARD') {
      await MastercardClientBatch.fetchBatch(requests);
    }
  } catch (error) {
    console.error(`[${provider}] Batch execution failed: ${error.message}`);
    throw error;
  }
}

/**
 * Print final summary
 */
function printSummary(pairs, startDate, endDate, providers) {
  console.log(`\n${SEPARATOR}`);
  console.log('Final Summary');
  console.log(SEPARATOR);
  
  for (const provider of providers) {
    let totalRecords = 0;
    
    for (const pair of pairs) {
      const records = store.getAll(pair.from, pair.to).filter(r => r.provider === provider);
      totalRecords += records.length;
    }
    
    console.log(`${provider}: ${totalRecords.toLocaleString()} records`);
  }
  
  console.log(SEPARATOR);
}

async function main() {
	const { days, provider: providerOption } = parseOrchestratorArgs();
	const pairs = await loadWatchlist();

	if (pairs.length === 0) {
    console.log('No pairs in watchlist.');
    return;
  }
  
  const { startDate, endDate } = getDateRange(days);
  const providers = getProvidersToCheck(providerOption);
  
  console.log(SEPARATOR);
  console.log('ForexRadar Backfill Orchestrator');
  console.log(SEPARATOR);
  console.log(`Provider(s): ${formatProvider(providerOption)}`);
  console.log(`Days: ${days}`);
  console.log(`Pairs: ${pairs.length}`);
  console.log(SEPARATOR);
  
  // Step 1: Analyze gaps
  const missingData = analyzeGaps(pairs, startDate, endDate, providers);
  
  if (missingData.length === 0) {
    console.log('\nNo missing data. All pairs are up to date.');
    return;
  }
  
  // Step 2: Group by provider
  const grouped = groupByProvider(missingData);
  
  // Step 3: Execute batches in parallel (if multiple providers)
  const promises = [];
  
  if (providers.includes('VISA') && grouped.VISA.length > 0) {
    promises.push(executeProviderBatch('VISA', grouped.VISA));
  }
  
  if (providers.includes('MASTERCARD') && grouped.MASTERCARD.length > 0) {
    promises.push(executeProviderBatch('MASTERCARD', grouped.MASTERCARD));
  }
  
  // Execute in parallel
  const results = await Promise.allSettled(promises);
  
  // Check for failures
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`\n${failures.length} provider(s) failed`);
    for (const failure of failures) {
      console.error(`  ${failure.reason}`);
    }
  }
  
  // Step 4: Print summary
  printSummary(pairs, startDate, endDate, providers);
  
  const exitCode = failures.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(`\nFatal error: ${error.message}`);
  process.exit(1);
});
