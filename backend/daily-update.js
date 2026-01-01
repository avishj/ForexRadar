#!/usr/bin/env node

/**
 * Daily Update Script
 * 
 * Entry point for GitHub Actions. Iterates through the watchlist
 * and fetches yesterday's rates for each currency pair from both
 * Visa and Mastercard providers.
 * 
 * @module daily-update
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDatabase,
  insertRate,
  rateExists,
  closeDatabase
} from './db-handler.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate, getLatestAvailableDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */

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
 * @returns {Promise<{visa: boolean, mastercard: boolean}>} Update status per provider
 */
async function updatePair(pair, date) {
  const visaUpdated = await updatePairForProvider(pair, date, 'VISA', VisaClient);
  const mcUpdated = await updatePairForProvider(pair, date, 'MASTERCARD', MastercardClient);
  
  return { visa: visaUpdated, mastercard: mcUpdated };
}

/**
 * Main function
 */
async function main() {
  console.log('=== ForexRadar Daily Update ===\n');
  
  const watchlist = loadWatchlist();
  
  if (watchlist.length === 0) {
    console.log('No pairs in watchlist. Exiting.');
    return;
  }
  
  console.log(`Watchlist: ${watchlist.length} pair(s)`);
  console.log('Providers: Visa, Mastercard\n');
  
  const latestAvailableDate = getLatestAvailableDate();
  console.log(`Fetching rates for: ${formatDate(latestAvailableDate)}\n`);
  
  let visaUpdatedCount = 0;
  let mcUpdatedCount = 0;
  
  for (const pair of watchlist) {
    console.log(`Processing ${pair.from}/${pair.to}...`);
    const result = await updatePair(pair, latestAvailableDate);
    if (result.visa) visaUpdatedCount++;
    if (result.mastercard) mcUpdatedCount++;
  }
  
  console.log(`\n=== Complete ===`);
  console.log(`Visa: ${visaUpdatedCount}/${watchlist.length} pairs updated`);
  console.log(`Mastercard: ${mcUpdatedCount}/${watchlist.length} pairs updated`);
  
  // Close both browser instances to allow script to exit
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
