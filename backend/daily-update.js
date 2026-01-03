#!/usr/bin/env node

/**
 * Daily Update Script
 * 
 * Entry point for GitHub Actions. Iterates through the watchlist
 * and fetches yesterday's rates for each currency pair from
 * Visa, Mastercard, and ECB providers.
 * 
 * Creates GitHub issues automatically on Visa or ECB failures.
 * 
 * @module daily-update
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDatabase,
  insertRate,
  insertRates,
  rateExists,
  closeDatabase
} from './db-handler.js';
import { loadEcbWatchlist } from './cli.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import * as EcbClient from './ecb-client.js';
import { formatDate, getLatestAvailableDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').DailyUpdateFailure} DailyUpdateFailure */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Loads the watchlist configuration
 * @returns {Array<{from: string, to: string}>} Array of currency pairs
 */
function loadWatchlist() {
  const watchlistPath = join(__dirname, 'watchlist.json');
  const content = readFileSync(watchlistPath, 'utf-8');
  const config = JSON.parse(content);
  return config.pairs || [];
}

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
    const { spawn } = await import('node:child_process');
    
    const gh = spawn('gh', ['issue', 'create', '--title', title, '--body', body], {
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      gh.on('close', (code) => {
        if (code === 0) {
          console.log(`\n✓ Created GitHub issue for ${failures.length} failure(s)`);
          resolve();
        } else {
          console.warn(`\n⚠ Failed to create GitHub issue (exit code: ${code})`);
          resolve(); // Don't fail the whole script
        }
      });
      gh.on('error', (err) => {
        console.warn(`\n⚠ GitHub CLI not available: ${err.message}`);
        resolve();
      });
    });
  } catch (error) {
    console.warn(`\n⚠ Could not create GitHub issue: ${error.message}`);
  }
}

/**
 * Updates rate for a single currency pair and provider
 * @param {{from: string, to: string}} pair 
 * @param {Date} date 
 * @param {Provider} provider
 * @param {typeof VisaClient | typeof MastercardClient} client
 * @returns {Promise<boolean>} True if updated, false if skipped/failed
 */
async function updatePairForProvider(pair, date, provider, client) {
  const { from, to } = pair;
  const dateStr = formatDate(date);
  
  const db = openDatabase(from);
  
  try {
    // Check if already exists to avoid unnecessary API calls
    if (rateExists(db, dateStr, from, to, provider)) {
      console.log(`  [${provider}] ${from}/${to}: Already exists for ${dateStr}, skipping`);
      return false;
    }
    
    const record = await client.fetchRate(date, from, to);
    
    if (record === null) {
      console.log(`  [${provider}] ${from}/${to}: No data available for ${dateStr}`);
      return false;
    }
    
    // insertRate returns true if inserted, false if duplicate was skipped by UNIQUE constraint
    // This is a safety net in case of race conditions
    const inserted = insertRate(db, record);
    
    if (!inserted) {
      console.log(`  [${provider}] ${from}/${to}: Race condition detected, already inserted`);
      return false;
    }
    
    // Format output based on provider (MC doesn't have markup)
    if (provider === 'VISA' && record.markup !== null) {
      console.log(`  [${provider}] ${from}/${to}: ${record.rate.toFixed(4)} (markup: ${record.markup.toFixed(2)}%)`);
    } else {
      console.log(`  [${provider}] ${from}/${to}: ${record.rate.toFixed(4)}`);
    }
    return true;
    
  } catch (error) {
    console.error(`  [${provider}] ${from}/${to}: Error - ${error.message}`);
    return false;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Updates rates for a single currency pair from all providers
 * @param {{from: string, to: string}} pair 
 * @param {Date} date 
 * @param {DailyUpdateFailure[]} failures
 * @returns {Promise<{visa: boolean, mastercard: boolean}>}
 */
async function updatePair(pair, date, failures) {
  let visaUpdated = false;
  let mcUpdated = false;
  
  try {
    visaUpdated = await updatePairForProvider(pair, date, 'VISA', VisaClient);
  } catch (error) {
    failures.push({ pair: `${pair.from}/${pair.to}`, provider: 'VISA', error: error.message });
  }
  
  try {
    mcUpdated = await updatePairForProvider(pair, date, 'MASTERCARD', MastercardClient);
  } catch {
    // Ignore Mastercard failures
  }
  
  return { visa: visaUpdated, mastercard: mcUpdated };
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
      const data = await EcbClient.fetchAllRates(currency);
      
      if (!data) {
        failures.push({
          pair: `EUR/${currency}`,
          provider: 'ECB',
          error: `No data returned from ECB fetchAllRates for EUR/${currency}`
        });
        failed++;
        continue;
      }
      
      const eurDb = openDatabase('EUR');
      const eurInserted = insertRates(eurDb, data.eurTo);
      closeDatabase(eurDb);
      
      const currDb = openDatabase(currency);
      const currInserted = insertRates(currDb, data.toEur);
      closeDatabase(currDb);
      
      if (eurInserted > 0 || currInserted > 0) {
        console.log(`  [ECB] EUR↔${currency}: +${eurInserted} EUR→${currency}, +${currInserted} ${currency}→EUR`);
        updated++;
      } else {
        console.log(`  [ECB] EUR↔${currency}: No new data`);
      }
    } catch (error) {
      console.error(`  [ECB] EUR↔${currency}: Error - ${error.message}`);
      failures.push({ pair: `EUR/${currency}`, provider: 'ECB', error: error.message });
      failed++;
    }
  }
  
  return { updated, failed };
}

/**
 * Main function
 */
async function main() {
  console.log('=== ForexRadar Daily Update ===\n');
  
  const watchlist = loadWatchlist();
  const ecbCurrencies = loadEcbWatchlist();
  
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
  
  let visaUpdatedCount = 0;
  let mcUpdatedCount = 0;
  
  // Visa/Mastercard updates
  console.log('--- Visa/Mastercard Updates ---');
  for (const pair of watchlist) {
    console.log(`Processing ${pair.from}/${pair.to}...`);
    const result = await updatePair(pair, latestAvailableDate, failures);
    if (result.visa) visaUpdatedCount++;
    if (result.mastercard) mcUpdatedCount++;
  }
  
  // ECB updates
  const ecbResult = await updateEcbRates(ecbCurrencies, failures);
  
  console.log(`\n=== Summary ===`);
  console.log(`Visa: ${visaUpdatedCount}/${watchlist.length} pairs updated`);
  console.log(`Mastercard: ${mcUpdatedCount}/${watchlist.length} pairs updated`);
  console.log(`ECB: ${ecbResult.updated}/${ecbCurrencies.length} currencies updated`);
  
  // Create GitHub issue for failures (excluding Mastercard)
  const reportableFailures = failures.filter(f => f.provider !== 'MASTERCARD');
  if (reportableFailures.length > 0) {
    console.log(`\n⚠ ${reportableFailures.length} failure(s) detected`);
    await createGitHubIssue(reportableFailures, dateStr);
  }
  
  // Close browser instances
  await VisaClient.closeBrowser();
  await MastercardClient.closeBrowser();
}

main().catch(async (error) => {
  console.error('Daily update failed:', error.message);
  // Ensure browsers are closed on error
  try {
    await VisaClient.closeBrowser();
    await MastercardClient.closeBrowser();
  } catch (e) {
    // Ignore cleanup errors
  }
  process.exit(1);
});
