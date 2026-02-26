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
import { createLogger } from '../shared/logger.js';

const log = createLogger('DAILY');

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').DailyUpdateFailure} DailyUpdateFailure */
/** @typedef {import('../shared/types.js').BatchRequest} BatchRequest */

const ISSUE_TITLE = 'Daily Update Failures';
const ISSUE_LABEL = 'daily-update-failure';

/**
 * Run a gh CLI command and return stdout
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function gh(args) {
  const proc = Bun.spawn(['gh', ...args], {
    stdout: 'pipe',
    stderr: 'inherit'
  });
  const text = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`gh exited with ${exitCode}`);
  return text.trim();
}

/**
 * Find an existing open daily-update-failure issue
 * @returns {Promise<{number: number} | null>}
 */
async function findOpenIssue() {
  try {
    const output = await gh([
      'issue', 'list', '--state', 'open', '--label', ISSUE_LABEL, '--json', 'number,title'
    ]);
    const issues = /** @type {{number: number, title: string}[]} */ (JSON.parse(output));
    return issues.find(i => i.title !== undefined && i.title === ISSUE_TITLE) ?? null;
  } catch (error) {
    log.warn(`Failed to find open issue: ${error.message}`);
    return null;
  }
}

/**
 * Ensure the daily-update-failure label exists
 * @returns {Promise<void>}
 */
async function ensureLabel() {
  try {
    await gh(['label', 'create', ISSUE_LABEL, '--color', 'D93F0B', '--description', 'Automated daily update failure alerts', '--force']);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return;
    }
    log.warn(`Failed to create label: ${error.message}`);
  }
}

/**
 * Reports daily update failures by commenting on an existing issue or creating one
 * Uses GitHub CLI (gh) which is available in GitHub Actions
 * @param {DailyUpdateFailure[]} failures
 * @param {string} dateStr
 */
async function createGitHubIssue(failures, dateStr) {
  if (failures.length === 0) return;
  
  const body = [
    `## Daily Update Failed for ${failures.length} pair(s) — ${dateStr}`,
    '',
    '| Pair | Provider | Error |',
    '|------|----------|-------|',
    ...failures.map(f => `| ${f.pair} | ${f.provider} | ${f.error} |`),
    '',
    `*Auto-generated on ${new Date().toISOString()}*`
  ].join('\n');
  
  try {
    const existingIssue = await findOpenIssue();

    if (existingIssue) {
      await gh(['issue', 'comment', String(existingIssue.number), '--body', body]);
      log.success(`Commented on issue #${existingIssue.number} with ${failures.length} failure(s)`);
    } else {
      await ensureLabel();
      await gh(['issue', 'create', '--title', ISSUE_TITLE, '--body', body, '--label', ISSUE_LABEL]);
      log.success(`Created GitHub issue for ${failures.length} failure(s)`);
    }
  } catch (error) {
    log.warn(`Could not create/update GitHub issue: ${error.message}`);
  }
}

/**
 * Updates ECB rates for all currencies
 * @param {string[]} currencies
 * @param {DailyUpdateFailure[]} failures
 * @returns {Promise<{updated: number, failed: number}>}
 */
async function updateEcbRates(currencies, failures) {
  log.info('--- ECB Updates ---');
  
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
        log.success(`EUR↔${currency}: +${eurInserted} EUR→${currency}, +${currInserted} ${currency}→EUR`);
        updated++;
      } else {
        log.info(`EUR↔${currency}: No new data`);
      }
    } catch (error) {
      log.error(`EUR↔${currency}: Error - ${error.message}`);
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
  log.info('=== ForexRadar Daily Update ===');
  
  const watchlist = await loadWatchlist();
  const ecbCurrencies = await loadEcbWatchlist();
  
  if (watchlist.length === 0 && ecbCurrencies.length === 0) {
    log.warn('No pairs in watchlists. Exiting.');
    return;
  }
  
  log.info(`Visa/MC Watchlist: ${watchlist.length} pair(s)`);
  log.info(`ECB Watchlist: ${ecbCurrencies.length} currencies`);
  log.info('Providers: Visa, ECB');
  
  const latestAvailableDate = getLatestAvailableDate();
  const dateStr = formatDate(latestAvailableDate);
  log.info(`Fetching rates for: ${dateStr}`);
  
  /** @type {DailyUpdateFailure[]} */
  const failures = [];
  
  // Step 1: Find missing data for today (reuse orchestrator logic)
  const providers = ['VISA'];
  const missingBefore = analyzeGaps(watchlist, dateStr, dateStr, providers, { silent: true });
  const groupedBefore = groupByProvider(missingBefore);
  
  const visaNeeded = groupedBefore.VISA.length;
  
  log.info(`Missing data: ${visaNeeded} Visa`);
  
  // Step 2: Execute batch fetches (batch clients handle their own browser lifecycle)
  if (visaNeeded > 0) {
    log.info('--- Visa Updates ---');
    try {
      await executeProviderBatch('VISA', groupedBefore.VISA, { silent: true });
    } catch (error) {
      log.error(`Visa batch failed: ${error.message}`);
    }
  }
  
  // Step 3: Check what's still missing after batch (these are failures)
  const missingAfter = analyzeGaps(watchlist, dateStr, dateStr, providers, { silent: true });
  const groupedAfter = groupByProvider(missingAfter);
  
  const visaUpdated = visaNeeded - groupedAfter.VISA.length;
  
  // Convert Visa failures to reportable format
  const visaFailures = convertMissingToFailures(missingAfter);
  failures.push(...visaFailures);
  
  // Step 4: ECB updates (uses its own client, not batch)
  const ecbResult = await updateEcbRates(ecbCurrencies, failures);
  
  // Summary
  log.info('=== Summary ===');
  log.info(`Visa: ${visaUpdated}/${visaNeeded} pairs updated`);
  log.info(`ECB: ${ecbResult.updated}/${ecbCurrencies.length} currencies updated`);
  
  // Create GitHub issue for failures
  if (failures.length > 0) {
    log.warn(`${failures.length} failure(s) detected`);
    await createGitHubIssue(failures, dateStr);
  }
}

main().catch(async (error) => {
  console.error('Daily update failed:', error.message);
  process.exit(1);
});
