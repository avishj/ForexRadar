#!/usr/bin/env node

/**
 * ECB Backfill Script
 * 
 * Fetches complete historical exchange rate data from ECB for all currencies
 * in ecb-watchlist.json. 
 * 
 * Usage:
 *   node ecb-backfill.js
 *   node ecb-backfill.js --currency=USD  (single currency only)
 * 
 * @module ecb-backfill
 */

import { parseArgs } from 'node:util';
import { loadEcbWatchlist } from './cli.js';
import { openDatabase, insertRates, closeDatabase } from './db-handler.js';
import * as EcbClient from './ecb-client.js';

/** @typedef {import('../shared/types.js').ECBBackfillResult} ECBBackfillResult */

const SEPARATOR = '='.repeat(60);

/**
 * Parses CLI arguments for ECB backfill
 * @returns {{ currency: string | null }}
 */
function parseEcbBackfillArgs() {
  const { values } = parseArgs({
    options: {
      currency: { type: 'string' }
    }
  });
  
  return {
    currency: values.currency?.toUpperCase() ?? null
  };
}

/**
 * Backfills ECB data for a single currency
 * @param {string} currency
 * @returns {Promise<ECBBackfillResult>}
 */
async function backfillCurrency(currency) {
  console.log(`\n--- Backfilling ECB: EUR ↔ ${currency} ---`);
  
  const data = await EcbClient.fetchAllRates(currency);
  
  if (!data) {
    console.error(`[ECB] Failed to fetch data for ${currency}`);
    return { currency, eurToInserted: 0, toEurInserted: 0, skipped: 0 };
  }
  
  // Insert EUR→Currency rates into EUR.db
  const eurDb = openDatabase('EUR');
  const eurToInserted = insertRates(eurDb, data.eurTo);
  const eurToSkipped = data.eurTo.length - eurToInserted;
  closeDatabase(eurDb);
  
  console.log(`[ECB] EUR→${currency}: ${eurToInserted} inserted, ${eurToSkipped} skipped`);
  
  // Insert Currency→EUR rates into {Currency}.db
  const currDb = openDatabase(currency);
  const toEurInserted = insertRates(currDb, data.toEur);
  const toEurSkipped = data.toEur.length - toEurInserted;
  closeDatabase(currDb);
  
  console.log(`[ECB] ${currency}→EUR: ${toEurInserted} inserted, ${toEurSkipped} skipped`);
  
  return {
    currency,
    eurToInserted,
    toEurInserted,
    skipped: eurToSkipped + toEurSkipped
  };
}

async function main() {
  const { currency } = parseEcbBackfillArgs();
  const currencies = currency ? [currency] : loadEcbWatchlist();
  
  console.log(SEPARATOR);
  console.log('  ForexRadar ECB Backfill');
  console.log(SEPARATOR);
  console.log(`  Currencies: ${currencies.length}`);
  console.log(`  Provider:   ECB (European Central Bank)`);
  console.log(SEPARATOR);
  
  /** @type {ECBBackfillResult[]} */
  const results = [];
  
  for (const curr of currencies) {
    const result = await backfillCurrency(curr);
    results.push(result);
  }
  
  // Summary
  console.log(`\n${SEPARATOR}`);
  console.log('  Summary');
  console.log(SEPARATOR);
  
  let totalEurTo = 0;
  let totalToEur = 0;
  let totalSkipped = 0;
  
  for (const r of results) {
    console.log(`  ${r.currency}: EUR→${r.currency} +${r.eurToInserted}, ${r.currency}→EUR +${r.toEurInserted}`);
    totalEurTo += r.eurToInserted;
    totalToEur += r.toEurInserted;
    totalSkipped += r.skipped;
  }
  
  console.log(SEPARATOR);
  console.log(`  Total inserted: ${totalEurTo + totalToEur}`);
  console.log(`  Total skipped:  ${totalSkipped}`);
  console.log(SEPARATOR);
}

main().catch((error) => {
  console.error(`ECB backfill failed: ${error.message}`);
  process.exit(1);
});
