#!/usr/bin/env node

/**
 * Backfill Script
 * 
 * Fetches historical exchange rate data from Visa and/or Mastercard APIs
 * and stores in SQLite. Iterates backwards from today until hitting the
 * end of provider history or the stop date.
 * 
 * Usage:
 *   node backfill.js --from=USD --to=INR
 *   node backfill.js --from=USD --to=INR --provider=visa
 *   node backfill.js --from=USD --to=INR --provider=mastercard --parallel=5
 * 
 * @module backfill
 */

import { parseBackfillArgs, formatProvider } from './cli.js';
import { openDatabase, insertRate, rateExists, closeDatabase, getRecordCount } from './db-handler.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate, getLatestAvailableDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').ProviderBackfillResult} ProviderBackfillResult */

const MAX_HISTORY_DAYS = 146;
const BATCH_DELAY_MS = 100;

/** @type {Record<Provider, typeof VisaClient>} */
const CLIENTS = {
  VISA: VisaClient,
  MASTERCARD: MastercardClient
};

/**
 * Logs a rate fetch result.
 */
function logRateResult(provider, date, record, inserted) {
  if (!record) return;
  
  if (!inserted) {
    console.log(`[${provider}] ${date}: ⊘ Already exists`);
    return;
  }

  const rateStr = record.rate.toFixed(4);
  if (provider === 'VISA' && record.markup !== null) {
    console.log(`[${provider}] ${date}: ✓ ${rateStr} (markup: ${record.markup.toFixed(2)}%)`);
  } else {
    console.log(`[${provider}] ${date}: ✓ ${rateStr}`);
  }
}

/**
 * Fetches and stores rates for one provider, iterating backwards through dates.
 * @returns {Promise<ProviderBackfillResult>}
 */
async function backfillProvider(from, to, provider, startDate, stopDate, batchSize) {
  console.log(`\n--- Backfilling ${provider} ---`);
  
  const client = CLIENTS[provider];
  const db = openDatabase(from);
  
  let inserted = 0;
  let skipped = 0;
  let currentDate = new Date(startDate);

  while (currentDate >= stopDate) {
    const batch = [];
    const tempDate = new Date(currentDate);
    
    for (let i = 0; i < batchSize && tempDate >= stopDate; i++) {
      const dateStr = formatDate(tempDate);
      if (rateExists(db, dateStr, from, to, provider)) {
        skipped++;
      } else {
        batch.push(new Date(tempDate));
      }
      tempDate.setDate(tempDate.getDate() - 1);
    }
    
    currentDate = tempDate;
    
    if (batch.length === 0) continue;

    console.log(`[${provider}] Fetching ${batch.length} dates...`);
    
    const results = await Promise.allSettled(
      batch.map(async (date) => {
        const record = await client.fetchRate(date, from, to);
        return { date: formatDate(date), record };
      })
    );

    let endOfHistory = false;
    
    for (const result of results) {
      if (result.status === 'rejected') {
        console.log(`[${provider}] Error: ${result.reason?.message || result.reason}`);
        continue;
      }
      
      const { date, record } = result.value;
      
      if (record === null) {
        console.log(`[${provider}] ${date}: End of history`);
        endOfHistory = true;
        break;
      }

      const wasInserted = insertRate(db, record);
      if (wasInserted) {
        inserted++;
      } else {
        skipped++;
      }
      logRateResult(provider, date, record, wasInserted);
    }

    if (endOfHistory) break;
    
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  closeDatabase(db);
  return { inserted, skipped };
}

async function safeCloseBrowser(client) {
  try {
    await client.closeBrowser();
  } catch {
    // Ignore cleanup errors
  }
}

async function main() {
  const config = parseBackfillArgs();
  const { from, to, provider, parallel } = config;
  
  console.log(`=== ForexRadar Backfill ===`);
  console.log(`Pair: ${from}/${to}`);
  console.log(`Provider(s): ${formatProvider(provider)}`);
  console.log(`Parallel: ${parallel}`);
  
  const startDate = getLatestAvailableDate();
  const stopDate = new Date(startDate);
  stopDate.setDate(stopDate.getDate() - MAX_HISTORY_DAYS);
  
  console.log(`Date range: ${formatDate(stopDate)} → ${formatDate(startDate)}`);
  
  /** @type {Partial<Record<Provider, ProviderBackfillResult>>} */
  const results = {};

  if (provider === 'all' || provider === 'visa') {
    results.VISA = await backfillProvider(from, to, 'VISA', startDate, stopDate, parallel);
    await safeCloseBrowser(VisaClient);
  }

  if (provider === 'all' || provider === 'mastercard') {
    results.MASTERCARD = await backfillProvider(from, to, 'MASTERCARD', startDate, stopDate, parallel);
    await safeCloseBrowser(MastercardClient);
  }

  const db = openDatabase(from);
  const totalRecords = getRecordCount(db, from, to);
  closeDatabase(db);

  console.log('\n=== Summary ===');
  for (const [name, res] of Object.entries(results)) {
    console.log(`${name}: ${res.inserted} inserted, ${res.skipped} skipped`);
  }
  console.log(`Total records: ${totalRecords}`);

  process.exit(0);
}

main().catch(async (error) => {
  console.error(`Backfill failed: ${error.message}`);
  await safeCloseBrowser(VisaClient);
  await safeCloseBrowser(MastercardClient);
  process.exit(1);
});
