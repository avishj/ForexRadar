#!/usr/bin/env node

/**
 * Daily Update Script
 * 
 * Entry point for GitHub Actions. Iterates through the watchlist
 * and fetches yesterday's rates for each currency pair.
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
import { fetchRate, closeBrowser } from './visa-client.js';
import { formatDate, getLatestAvailableDate, getYesterday } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

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
 * Updates rates for a single currency pair
 * @param {{from: string, to: string}} pair 
 * @param {Date} date 
 * @returns {Promise<boolean>} True if updated, false if skipped/failed
 */
async function updatePair(pair, date) {
  const { from, to } = pair;
  const dateStr = formatDate(date);
  
  const db = openDatabase(from);
  
  try {
    // Skip if already exists
    if (rateExists(db, dateStr, from, to)) {
      console.log(`  ${from}/${to}: Already exists for ${dateStr}, skipping`);
      return false;
    }
    
    const record = await fetchRate(date, from, to);
    
    if (record === null) {
      console.log(`  ${from}/${to}: No data available for ${dateStr}`);
      return false;
    }
    
    insertRate(db, record);
    console.log(`  ${from}/${to}: ${record.rate.toFixed(4)} (markup: ${(record.markup).toFixed(2)}%)`);
    return true;
    
  } catch (error) {
    console.error(`  ${from}/${to}: Error - ${error.message}`);
    return false;
  } finally {
    closeDatabase(db);
  }
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
  
  const latestAvailableDate = getLatestAvailableDate();
  console.log(`Fetching rates for: ${formatDate(latestAvailableDate)}\n`);
  
  let updatedCount = 0;
  
  for (const pair of watchlist) {
    const updated = await updatePair(pair, latestAvailableDate);
    if (updated) updatedCount++;
  }
  
  console.log(`\n=== Complete: ${updatedCount}/${watchlist.length} pairs updated ===`);
  
  // Close the browser instance to allow script to exit
  await closeBrowser();
}

main().catch((error) => {
  console.error('Daily update failed:', error.message);
  process.exit(1);
});
