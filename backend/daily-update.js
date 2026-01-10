#!/usr/bin/env bun

/**
 * Daily Update Script
 * 
 * Entry point for GitHub Actions. Fetches yesterday's rates for all
 * currency pairs in the watchlist from Visa, Mastercard, and ECB providers.
 * 
 * Reuses batch processing logic from the orchestrator. After batch execution,
 * checks for still-missing data to detect failures.
 * 
 * Creates GitHub issues automatically on Visa or ECB failures.
 * 
 * @module daily-update
 */

import { store } from './csv-store.js';
import { loadWatchlist, loadEcbWatchlist } from './cli.js';
import { analyzeGaps, groupByProvider, executeProviderBatch } from './backfill-orchestrator.js';
import * as EcbClient from './ecb-client.js';
import { formatDate, getLatestAvailableDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').DailyUpdateFailure} DailyUpdateFailure */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */

/**
 * Creates a GitHub issue for daily update failures
 * Uses GitHub CLI (gh) which is available in GitHub Actions
 * @param {DailyUpdateFailure[]} failures
 * @param {string} dateStr
 */
async function createGitHubIssue(failures, dateStr) {
  if (failures.length === 0) return;
  
  const title = `Daily Update Failures: ${dateStr}`;
  const body = [
    `## Daily Update Failed for ${failures.length} pair(s)`,
    '',
    '| Pair | Provider | Error |',
    '|------|----------|-------|',
    ...failures.map(f => `| ${f.pair} | ${f.provider} | ${f.error} |`),
    '',
    `*Auto-generated on ${new Date().toISOString()}*`
  ].join('\n');
  
  try {
    const proc = Bun.spawn(['gh', 'issue', 'create', '--title', title, '--body', body], {
      stdio: ['inherit', 'inherit', 'inherit']
    });
    
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      console.log(`\n✓ Created GitHub issue for ${failures.length} failure(s)`);
    } else {
      console.warn(`\n⚠ Failed to create GitHub issue (exit code: ${exitCode})`);
    }
  } catch (error) {
    console.warn(`\n⚠ Could not create GitHub issue: ${error.message}`);
  }
}

/**
 * Updates ECB rates for all currencies
 * @param {string[]} currencies
 * @param {DailyUpdateFailure[]} failures
 * @returns {Promise<{updated: number, failed: number}>}
 */
async function updateEcbRates(currencies, failures) {
  console.log('\n--- ECB Updates ---');
  
  let updated = 0;
  let failed = 0;
  
  for (const currency of currencies) {
    try {
      const data = await EcbClient.fetchAllRates(/** @type {CurrencyCode} */ (currency));
      
      if (!data) {
        failures.push({
          pair: `EUR/${currency}`,
          provider: 'ECB',
          error: `No data returned from ECB fetchAllRates for EUR/${currency}`
        });
        failed++;
        continue;
      }
      
      // Insert EUR → Currency records
      const eurInserted = store.add(data.eurTo);
      
      // Insert Currency → EUR records
      const currInserted = store.add(data.toEur);
      
      if (eurInserted > 0 || currInserted > 0) {
        console.log(`[ECB] EUR↔${currency}: +${eurInserted} EUR→${currency}, +${currInserted} ${currency}→EUR`);
        updated++;
      } else {
        console.log(`[ECB] EUR↔${currency}: No new data`);
      }
    } catch (error) {
      console.error(`[ECB] EUR↔${currency}: Error - ${error.message}`);
      failures.push({ pair: `EUR/${currency}`, provider: 'ECB', error: error.message });
      failed++;
    }
  }
  
  return { updated, failed };
}

/**
 * Convert still-missing data points to failure records for reporting
 * @param {ReturnType<typeof analyzeGaps>} missingData
 * @returns {DailyUpdateFailure[]}
 */
function convertMissingToFailures(missingData) {
  return missingData
    .filter(m => m.provider === 'VISA') // Only report Visa failures (MC is flaky)
    .map(m => ({
      pair: `${m.from}/${m.to}`,
      provider: /** @type {Provider} */ (m.provider),
      error: 'No data after batch fetch (API unavailable or rate limited)'
    }));
}

/**
 * Main function
 */
async function main() {
  console.log('=== ForexRadar Daily Update ===\n');
  
  const watchlist = await loadWatchlist();
  const ecbCurrencies = await loadEcbWatchlist();
  
  if (watchlist.length === 0 && ecbCurrencies.length === 0) {
    console.log('No pairs in watchlists. Exiting.');
    return;
  }
  
  console.log(`Visa/MC Watchlist: ${watchlist.length} pair(s)`);
  console.log(`ECB Watchlist: ${ecbCurrencies.length} currencies`);
  console.log('Providers: Visa, Mastercard, ECB\n');
  
  const latestAvailableDate = getLatestAvailableDate();
  const dateStr = formatDate(latestAvailableDate);
  console.log(`Fetching rates for: ${dateStr}\n`);
  
  /** @type {DailyUpdateFailure[]} */
  const failures = [];
  
  // Step 1: Find missing data for today (reuse orchestrator logic)
  const providers = ['VISA', 'MASTERCARD'];
  const missingBefore = analyzeGaps(watchlist, dateStr, dateStr, providers, { silent: true });
  const groupedBefore = groupByProvider(missingBefore);
  
  const visaNeeded = groupedBefore.VISA.length;
  const mcNeeded = groupedBefore.MASTERCARD.length;
  
  console.log(`Missing data: ${visaNeeded} Visa, ${mcNeeded} Mastercard`);
  
  // Step 2: Execute batch fetches (batch clients handle their own browser lifecycle)
  if (visaNeeded > 0) {
    console.log('\n--- Visa Updates ---');
    try {
      await executeProviderBatch('VISA', groupedBefore.VISA, { silent: true });
    } catch (error) {
      console.error(`[VISA] Batch failed: ${error.message}`);
    }
  }
  
  if (mcNeeded > 0) {
    console.log('\n--- Mastercard Updates ---');
    try {
      await executeProviderBatch('MASTERCARD', groupedBefore.MASTERCARD, { silent: true });
    } catch (error) {
      // Mastercard failures are expected due to bot detection, don't report
      console.log(`[MASTERCARD] Batch completed with errors (expected)`);
    }
  }
  
  // Step 3: Check what's still missing after batch (these are failures)
  const missingAfter = analyzeGaps(watchlist, dateStr, dateStr, providers, { silent: true });
  const groupedAfter = groupByProvider(missingAfter);
  
  const visaUpdated = visaNeeded - groupedAfter.VISA.length;
  const mcUpdated = mcNeeded - groupedAfter.MASTERCARD.length;
  
  // Convert Visa failures to reportable format (ignore MC failures)
  const visaFailures = convertMissingToFailures(missingAfter);
  failures.push(...visaFailures);
  
  // Step 4: ECB updates (uses its own client, not batch)
  const ecbResult = await updateEcbRates(ecbCurrencies, failures);
  
  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Visa: ${visaUpdated}/${visaNeeded} pairs updated`);
  console.log(`Mastercard: ${mcUpdated}/${mcNeeded} pairs updated`);
  console.log(`ECB: ${ecbResult.updated}/${ecbCurrencies.length} currencies updated`);
  
  // Create GitHub issue for failures (Visa + ECB only)
  if (failures.length > 0) {
    console.log(`\n⚠ ${failures.length} failure(s) detected`);
    await createGitHubIssue(failures, dateStr);
  }
}

main().catch(async (error) => {
  console.error('Daily update failed:', error.message);
  process.exit(1);
});
