#!/usr/bin/env node

/**
 * Data Validation Script
 * 
 * Queries the SQLite database to verify archived data.
 * 
 * Usage: node scripts/validate-data.js --from=USD --to=INR [--limit=10]
 */

import { parseArgs } from 'node:util';
import { openDatabase, closeDatabase } from './lib/db-handler.js';

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      limit: { type: 'string' }
    }
  });

  if (!values.from || !values.to) {
    console.error('Usage: node scripts/validate-data.js --from=USD --to=INR [--limit=10]');
    process.exit(1);
  }

  return {
    from: values.from.toUpperCase(),
    to: values.to.toUpperCase(),
    limit: values.limit ? parseInt(values.limit) : 10
  };
}

function main() {
  const { from, to, limit } = parseCliArgs();

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

  console.log(`Date range: ${earliest} to ${latest}\n`);

  // Get sample records
  console.log(`Sample records (first ${limit}):`);
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
