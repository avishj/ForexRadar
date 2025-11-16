#!/usr/bin/env node

/**
 * Backfill Script
 * 
 * Fetches historical exchange rate data from Visa API and stores in SQLite.
 * 
 * Usage: node scripts/backfill.js --from=USD --to=INR
 * 
 * Logic:
 * 1. Opens SQLite DB for the source currency
 * 2. Determines start date (today or yesterday based on ET time)
 * 3. Loops backwards, fetching rates until:
 *    - HTTP 500 (end of Visa history, ~365 days)
 *    - Or existing data in DB is reached
 * 4. Inserts new records into DB
 * 
 * @module backfill
 */

import { parseArgs } from 'node:util';
import {
  openDatabase,
  insertRate,
  getLatestDate,
  rateExists,
  closeDatabase,
  getRecordCount
} from './lib/db-handler.js';
import { fetchRate } from './lib/visa-client.js';

/**
 * Parses command line arguments
 * @returns {{from: string, to: string}} Currency pair
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node scripts/backfill.js --from=USD --to=INR');
    process.exit(1);
  }

  return {
    from: values.from.toUpperCase(),
    to: values.to.toUpperCase()
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
 * Formats a Date to YYYY-MM-DD string
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Main backfill function
 */
async function main() {
  const { from, to } = parseCliArgs();
  
  console.log(`Backfilling ${from}/${to}...`);
  
  // Open database for source currency
  const db = openDatabase(from);
  
  // Get latest date in DB for this pair
  const latestInDb = getLatestDate(db, from, to);
  if (latestInDb) {
    console.log(`Latest date in DB: ${latestInDb}`);
  } else {
    console.log('No existing data in DB for this pair');
  }
  
  // Determine start date
  const startDate = getStartDate();
  console.log(`Starting from: ${formatDate(startDate)}`);
  
  // Calculate stop date (365 days ago - Visa API limit)
  const stopDate = new Date(startDate);
  stopDate.setDate(stopDate.getDate() - 365);
  
  const currentDate = new Date(startDate);
  let insertedCount = 0;
  let skippedCount = 0;
  
  // Loop backwards through dates
  while (currentDate >= stopDate) {
    const dateStr = formatDate(currentDate);
    
    // Skip if already exists in DB
    if (rateExists(db, dateStr, from, to)) {
      skippedCount++;
      currentDate.setDate(currentDate.getDate() - 1);
      continue;
    }
    
    try {
      process.stdout.write(`Fetching ${dateStr}... `);
      
      const record = await fetchRate(currentDate, from, to);
      
      if (record === null) {
        // HTTP 500 - end of history
        console.log('End of history reached (HTTP 500)');
        break;
      }
      
      insertRate(db, record);
      insertedCount++;
      console.log(`✓ Rate: ${record.rate.toFixed(4)}`);
      
    } catch (error) {
      console.log(`✗ ${error.message}`);
      // Continue with next date on error
    }
    
    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);
    
    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Close database
  closeDatabase(db);
  
  // Summary
  const totalRecords = getRecordCount(openDatabase(from), from, to);
  closeDatabase(openDatabase(from));
  
  console.log('\n--- Summary ---');
  console.log(`Inserted: ${insertedCount} days`);
  console.log(`Skipped (existing): ${skippedCount} days`);
  console.log(`Total records for ${from}/${to}: ${totalRecords}`);
}

main().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exit(1);
});
