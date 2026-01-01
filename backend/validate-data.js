#!/usr/bin/env node

/**
 * Data Validation Script
 * 
 * Queries the SQLite database to verify archived data.
 * 
 * Usage: node validate-data.js --from=USD --to=INR [--limit=10]
 */

import { parseArgs } from 'node:util';
import { openDatabase, closeDatabase } from './db-handler.js';

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      limit: { type: 'string' },
      cleanup: { type: 'boolean' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node validate-data.js --from=USD --to=INR [--limit=10] [--cleanup]');
    process.exit(1);
  }

  return {
    from: values.from.toUpperCase(),
    to: values.to.toUpperCase(),
    limit: values.limit ? parseInt(values.limit) : 10,
    cleanup: values.cleanup || false
  };
}

function main() {
  const { from, to, limit, cleanup } = parseCliArgs();

  console.log(`Validating data for ${from}/${to}...\n`);

  const db = openDatabase(from);

  // Get total count
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
  `);
  const { count } = countStmt.get(from, to);

  console.log(`Total records: ${count}`);

  if (count === 0) {
    console.log('No data found!');
    closeDatabase(db);
    return;
  }

  // Get date range
  const rangeStmt = db.prepare(`
    SELECT MIN(date) as earliest, MAX(date) as latest
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
  `);
  const { earliest, latest } = rangeStmt.get(from, to);

  console.log(`Oldest archived date: ${earliest}`);
  console.log(`Latest archived date: ${latest}\n`);

  // Check for duplicates
  const dupeStmt = db.prepare(`
    SELECT date, COUNT(*) as dupe_count
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
    GROUP BY date
    HAVING COUNT(*) > 1
    ORDER BY date DESC
  `);
  const duplicates = dupeStmt.all(from, to);

  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} dates with duplicate records:`);
    console.table(duplicates);
    console.log('');

    if (cleanup) {
      console.log('🧹 Cleaning up duplicates...');
      
      // For each duplicate date, keep only the first record (by rowid) and delete the rest
      const cleanupStmt = db.prepare(`
        DELETE FROM rates
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM rates
          WHERE from_curr = ? AND to_curr = ? AND date = ?
        )
        AND from_curr = ? AND to_curr = ? AND date = ?
      `);

      let totalDeleted = 0;
      for (const { date } of duplicates) {
        const result = cleanupStmt.run(from, to, date, from, to, date);
        totalDeleted += result.changes;
      }

      console.log(`✓ Deleted ${totalDeleted} duplicate records\n`);
      
      // Recount after cleanup
      const newCount = countStmt.get(from, to).count;
      console.log(`Records after cleanup: ${newCount}\n`);
    }
  } else {
    console.log('✓ No duplicate dates found\n');
  }

  // Check for missing dates in range
  const allDatesStmt = db.prepare(`
    SELECT DISTINCT date
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
    ORDER BY date ASC
  `);
  const allDates = allDatesStmt.all(from, to).map(row => row.date);

  const missingDates = [];
  if (allDates.length > 1) {
    const start = new Date(earliest);
    const end = new Date(latest);
    const dateSet = new Set(allDates);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!dateSet.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }
  }

  if (missingDates.length > 0) {
    console.log(`⚠️  Found ${missingDates.length} missing dates in range:`);
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
  const expectedDays = Math.floor((new Date(latest) - new Date(earliest)) / (1000 * 60 * 60 * 24)) + 1;
  const uniqueDates = allDates.length;
  const coverage = ((uniqueDates / expectedDays) * 100).toFixed(1);

  console.log('=== SUMMARY ===');
  console.log(`Expected days in range: ${expectedDays}`);
  console.log(`Unique dates with data: ${uniqueDates}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Total records: ${count}`);
  console.log(`Duplicates: ${duplicates.length} dates`);
  console.log(`Missing dates: ${missingDates.length}\n`);

  // Get sample records (properly sorted)
  console.log(`Sample records (${limit} most recent):`);
  const sampleStmt = db.prepare(`
    SELECT date, rate, markup, provider
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
    ORDER BY date DESC
    LIMIT ?
  `);
  const records = sampleStmt.all(from, to, limit);

  console.table(records);

  closeDatabase(db);
}

main();
