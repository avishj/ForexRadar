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
import { fetchRate, closeBrowser } from './lib/visa-client.js';
import { formatDate } from '../../shared/utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

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
  const BATCH_SIZE = 8;
  
  // Loop backwards through dates in batches
  while (currentDate >= stopDate) {
    // Collect batch of dates to fetch
    const batch = [];
    const tempDate = new Date(currentDate);
    
    for (let i = 0; i < BATCH_SIZE && tempDate >= stopDate; i++) {
      const dateStr = formatDate(tempDate);
      
      // Skip if already exists in DB
      if (rateExists(db, dateStr, from, to)) {
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
    
    console.log(`Fetching batch of ${batch.length} dates...`);
    
    // Fetch all dates in parallel
    const results = await Promise.allSettled(
      batch.map(date => 
        fetchRate(date, from, to)
          .then(record => ({ date: formatDate(date), record, error: null }))
          .catch(error => ({ date: formatDate(date), record: null, error }))
      )
    );
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { date, record, error } = result.value;
        
        if (error) {
          console.log(`${date}: ✗ ${error.message}`);
        } else if (record === null) {
          console.log(`${date}: End of history reached (HTTP 500)`);
          // Set currentDate to stopDate to exit loop
          currentDate.setTime(stopDate.getTime() - 1);
          break;
        } else {
          insertRate(db, record);
          insertedCount++;
          console.log(`${date}: ✓ Rate: ${record.rate.toFixed(4)}`);
        }
      } else {
        console.log(`Batch error: ${result.reason}`);
      }
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Close database
  closeDatabase(db);
  
  // Close browser
  await closeBrowser();
  
  // Summary
  const dbForCount = openDatabase(from);
  const totalRecords = getRecordCount(dbForCount, from, to);
  closeDatabase(dbForCount);
  
  console.log('\n--- Summary ---');
  console.log(`Inserted: ${insertedCount} days`);
  console.log(`Skipped (existing): ${skippedCount} days`);
  console.log(`Total records for ${from}/${to}: ${totalRecords}`);
  
  // Force exit to ensure browser resources are freed
  process.exit(0);
}

main().catch(async (error) => {
  await closeBrowser();
  console.error('Backfill failed:', error.message);
  process.exit(1);
});
