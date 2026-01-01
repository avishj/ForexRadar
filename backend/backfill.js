#!/usr/bin/env node

/**
 * Backfill Script
 * 
 * Fetches historical exchange rate data from Visa and/or Mastercard APIs
 * and stores in SQLite.
 * 
 * Usage: 
 *   node backfill.js --from=USD --to=INR                    # Both providers (default)
 *   node backfill.js --from=USD --to=INR --provider=visa    # Visa only
 *   node backfill.js --from=USD --to=INR --provider=mastercard  # Mastercard only
 *   node backfill.js --from=USD --to=INR --provider=all     # Both (explicit)
 * 
 * Logic:
 * 1. Opens SQLite DB for the source currency
 * 2. Determines start date (today or yesterday based on ET time)
 * 3. For each provider, loops backwards fetching rates until:
 *    - End of history response
 *    - Or 730 days reached (in case APIs support more than advertised 365)
 * 4. Inserts new records into DB
 * 
 * @module backfill
 */

import { parseArgs } from 'node:util';
import {
  openDatabase,
  insertRate,
  rateExists,
  closeDatabase,
  getRecordCount
} from './db-handler.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */

/**
 * Parses command line arguments
 * @returns {{from: string, to: string, provider: 'visa' | 'mastercard' | 'all'}} Config
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      provider: { type: 'string', default: 'all' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node backfill.js --from=USD --to=INR [--provider=visa|mastercard|all]');
    process.exit(1);
  }

  const providerArg = (values.provider || 'all').toLowerCase();
  if (!['visa', 'mastercard', 'all'].includes(providerArg)) {
    console.error('Invalid provider. Use: visa, mastercard, or all');
    process.exit(1);
  }

  return {
    from: values.from.toUpperCase(),
    to: values.to.toUpperCase(),
    provider: /** @type {'visa' | 'mastercard' | 'all'} */ (providerArg)
  };
}

/**
 * Gets the appropriate start date for backfilling.
 * Returns today if ET time is past 12pm, otherwise yesterday.
 * @returns {Date} Start date
 */
function getStartDate() {
  const now = new Date();
  
  // Convert to Eastern Time
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const etHour = etTime.getHours();
  
  // If past 12pm ET, use today; otherwise use yesterday
  if (etHour >= 12) {
    return now;
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
}

/**
 * Backfills data for a single provider
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @param {Provider} providerName - Provider name
 * @param {typeof VisaClient | typeof MastercardClient} client - Provider client
 * @param {Date} startDate - Start date
 * @param {Date} stopDate - Stop date
 * @returns {Promise<{inserted: number, skipped: number}>} Counts
 */
async function backfillProvider(from, to, providerName, client, startDate, stopDate) {
  console.log(`\n--- Backfilling ${providerName} ---`);
  
  const db = openDatabase(from);
  
  const currentDate = new Date(startDate);
  let insertedCount = 0;
  let skippedCount = 0;
  const BATCH_SIZE = 4;
  
  // Loop backwards through dates in batches
  while (currentDate >= stopDate) {
    // Collect batch of dates to fetch
    const batch = [];
    const tempDate = new Date(currentDate);
    
    for (let i = 0; i < BATCH_SIZE && tempDate >= stopDate; i++) {
      const dateStr = formatDate(tempDate);
      
      // Skip if already exists in DB for this provider
      if (rateExists(db, dateStr, from, to, providerName)) {
        skippedCount++;
      } else {
        batch.push(new Date(tempDate));
      }
      
      tempDate.setDate(tempDate.getDate() - 1);
    }
    
    // Update currentDate for next batch
    currentDate.setTime(tempDate.getTime());
    
    // Skip if no dates to fetch
    if (batch.length === 0) {
      continue;
    }
    
    console.log(`[${providerName}] Fetching batch of ${batch.length} dates...`);
    
    // Fetch all dates in parallel
    const results = await Promise.allSettled(
      batch.map(date => 
        client.fetchRate(date, from, to)
          .then(record => ({ date: formatDate(date), record, error: null }))
          .catch(error => ({ date: formatDate(date), record: null, error }))
      )
    );
    
    // Process results
    let endOfHistoryReached = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { date, record, error } = result.value;
        
        if (error) {
          console.log(`[${providerName}] ${date}: ✗ ${error.message}`);
        } else if (record === null) {
          console.log(`[${providerName}] ${date}: End of history reached`);
          endOfHistoryReached = true;
          break;
        } else {
          insertRate(db, record);
          insertedCount++;
          if (providerName === 'VISA' && record.markup !== null) {
            console.log(`[${providerName}] ${date}: ✓ Rate: ${record.rate.toFixed(4)} (markup: ${record.markup.toFixed(2)}%)`);
          } else {
            console.log(`[${providerName}] ${date}: ✓ Rate: ${record.rate.toFixed(4)}`);
          }
        }
      } else {
        console.log(`[${providerName}] Batch error: ${result.reason}`);
      }
    }
    
    if (endOfHistoryReached) {
      break;
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  closeDatabase(db);
  
  return { inserted: insertedCount, skipped: skippedCount };
}

/**
 * Main backfill function
 */
async function main() {
  const { from, to, provider } = parseCliArgs();
  
  console.log(`=== ForexRadar Backfill ===`);
  console.log(`Pair: ${from}/${to}`);
  console.log(`Provider(s): ${provider === 'all' ? 'Visa + Mastercard' : provider.toUpperCase()}`);
  
  // Determine start date
  const startDate = getStartDate();
  console.log(`Starting from: ${formatDate(startDate)}`);
  
  // Calculate stop date (730 days ago - in case APIs support more than 365)
  const stopDate = new Date(startDate);
  stopDate.setDate(stopDate.getDate() - 730);
  console.log(`Stop date: ${formatDate(stopDate)}`);
  
  /** @type {{visa?: {inserted: number, skipped: number}, mastercard?: {inserted: number, skipped: number}}} */
  const results = {};
  
  // Backfill Visa
  if (provider === 'all' || provider === 'visa') {
    results.visa = await backfillProvider(from, to, 'VISA', VisaClient, startDate, stopDate);
    await VisaClient.closeBrowser();
  }
  
  // Backfill Mastercard
  if (provider === 'all' || provider === 'mastercard') {
    results.mastercard = await backfillProvider(from, to, 'MASTERCARD', MastercardClient, startDate, stopDate);
    await MastercardClient.closeBrowser();
  }
  
  // Summary
  const db = openDatabase(from);
  const totalRecords = getRecordCount(db, from, to);
  closeDatabase(db);
  
  console.log('\n=== Summary ===');
  if (results.visa) {
    console.log(`Visa: ${results.visa.inserted} inserted, ${results.visa.skipped} skipped`);
  }
  if (results.mastercard) {
    console.log(`Mastercard: ${results.mastercard.inserted} inserted, ${results.mastercard.skipped} skipped`);
  }
  console.log(`Total records for ${from}/${to}: ${totalRecords}`);
  
  // Force exit to ensure browser resources are freed
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Backfill failed:', error.message);
  // Ensure browsers are closed on error
  try {
    await VisaClient.closeBrowser();
    await MastercardClient.closeBrowser();
  } catch (e) {
    // Ignore cleanup errors
  }
  process.exit(1);
});
