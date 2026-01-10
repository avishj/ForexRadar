#!/usr/bin/env bun

/**
 * Data Validation Script
 * 
 * Queries the CSV store to verify archived data.
 * 
 * Usage: bun validate-data.js --from=USD --to=INR [--limit=10]
 */

import { parseArgs } from 'util';
import { store } from './csv-store.js';
import { parseDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

/**
 * @returns {{ from: CurrencyCode, to: CurrencyCode, limit: number }}
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      limit: { type: 'string' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: bun validate-data.js --from=USD --to=INR [--limit=10]');
    process.exit(1);
  }

  return {
    from: /** @type {CurrencyCode} */ (values.from.toUpperCase()),
    to: /** @type {CurrencyCode} */ (values.to.toUpperCase()),
    limit: values.limit ? parseInt(values.limit) : 10
  };
}

/**
 * Find duplicate records (same date + provider appearing multiple times)
 * @param {RateRecord[]} records
 * @returns {Array<{date: string, provider: string, count: number}>}
 */
function findDuplicates(records) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  
  for (const record of records) {
    const key = `${record.date}|${record.provider}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  
  /** @type {Array<{date: string, provider: string, count: number}>} */
  const duplicates = [];
  
  for (const [key, count] of counts) {
    if (count > 1) {
      const [date, provider] = key.split('|');
      duplicates.push({ date, provider, count });
    }
  }
  
  return duplicates.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Find missing dates in a range
 * @param {string[]} dates - Sorted date strings (YYYY-MM-DD)
 * @returns {string[]}
 */
function findMissingDates(dates) {
  if (dates.length < 2) return [];
  
  const dateSet = new Set(dates);
  const missingDates = [];
  const start = parseDate(dates[0]);
  const end = parseDate(dates[dates.length - 1]);

  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!dateSet.has(dateStr)) {
      missingDates.push(dateStr);
    }
  }
  
  return missingDates;
}

function main() {
  const { from, to, limit } = parseCliArgs();

  console.log(`Validating data for ${from}/${to}...\n`);

  // Get all records for the pair
  const records = store.getAll(from, to);
  const count = records.length;

  console.log(`Total records: ${count}`);

  if (count === 0) {
    console.log('No data found!');
    return;
  }

  // Get date range
  const earliest = store.oldestDate(from, to);
  const latest = store.latestDate(from, to);

  console.log(`Oldest archived date: ${earliest}`);
  console.log(`Latest archived date: ${latest}\n`);

  // Check for duplicates (same date + provider appearing multiple times)
  const duplicates = findDuplicates(records);

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate records (same date + provider):`);
    console.table(duplicates);
    console.log('');
    console.log('Note: CSV storage prevents duplicates on write. These indicate data integrity issues.');
    console.log('');
  } else {
    console.log('✓ No duplicate dates found\n');
  }

  // Check for missing dates in range
  const uniqueDates = [...new Set(records.map(r => r.date))].sort();
  const missingDates = findMissingDates(uniqueDates);

  if (missingDates.length > 0) {
    console.log(`Found ${missingDates.length} missing dates in range:`);
    if (missingDates.length <= 20) {
      console.log(missingDates.join(', '));
    } else {
      console.log(missingDates.slice(0, 20).join(', ') + ` ... and ${missingDates.length - 20} more`);
    }
    console.log('');
  } else {
    console.log('✓ No missing dates in range\n');
  }

  // Summary
  const expectedDays = earliest && latest
    ? Math.floor((parseDate(latest).getTime() - parseDate(earliest).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const coverage = expectedDays > 0 ? ((uniqueDates.length / expectedDays) * 100).toFixed(1) : '0.0';

  console.log('=== SUMMARY ===');
  console.log(`Expected days in range: ${expectedDays}`);
  console.log(`Unique dates with data: ${uniqueDates.length}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Total records: ${count}`);
  console.log(`Duplicate records: ${duplicates.length} (same date+provider)`);
  console.log(`Missing dates: ${missingDates.length}\n`);
  // Get provider breakdown
  const providerCounts = store.countByProvider(from, to);
  console.log('Records by provider:');
  for (const [provider, providerCount] of Object.entries(providerCounts)) {
    if (providerCount > 0) {
      console.log(`  ${provider}: ${providerCount}`);
    }
  }
  console.log('');

  // Get sample records (most recent)
  console.log(`Sample records (${limit} most recent):`);
  const sample = records.slice(-limit).reverse().map(r => ({
    date: r.date,
    rate: r.rate,
    markup: r.markup,
    provider: r.provider
  }));

  console.table(sample);
}

main();
