#!/usr/bin/env node

/**
 * Migration Script: SQLite to CSV
 * 
 * Exports all data from SQLite database files to sharded CSV files.
 * 
 * Usage:
 *   node migrate-to-csv.js              # Migrate all currencies
 *   node migrate-to-csv.js --currency=EUR  # Migrate single currency
 *   node migrate-to-csv.js --dry-run    # Show what would be migrated
 * 
 * Output Structure:
 *   db-csv/
 *     EUR/
 *       1999.csv
 *       2000.csv
 *       ...
 *     USD/
 *       2024.csv
 *       ...
 * 
 * @module backend/migrate-to-csv
 */

import Database from 'better-sqlite3';
import { existsSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { serializeCSV } from '../shared/csv-utils.js';
import { getYearFromDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'db');
const CSV_PATH = join(__dirname, '..', 'db-csv');

const SEPARATOR = '='.repeat(60);

// ============================================================================
// CLI Parsing
// ============================================================================

/**
 * Parse command line arguments
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      currency: { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', short: 'd' },
      'output-dir': { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (values.help) {
    console.log(`
Usage: node migrate-to-csv.js [options]

Options:
  -c, --currency=CODE   Migrate only this currency (e.g., EUR)
  -d, --dry-run         Show what would be migrated without writing files
  -o, --output-dir=PATH Output directory (default: db-csv)
  -h, --help            Show this help message
`);
    process.exit(0);
  }

  return {
    currency: values.currency?.toUpperCase() ?? null,
    dryRun: values['dry-run'] ?? false,
    outputDir: values['output-dir'] ?? CSV_PATH
  };
}

// ============================================================================
// SQLite Reading
// ============================================================================

/**
 * Get all SQLite database files
 * @returns {string[]} Array of currency codes with .db files
 */
function getDbFiles() {
  if (!existsSync(DB_PATH)) {
    return [];
  }

  const files = readdirSync(DB_PATH);
  const dbFiles = [];

  for (const file of files) {
    if (file.endsWith('.db') && !file.endsWith('-wal') && !file.endsWith('-shm')) {
      const currency = basename(file, '.db');
      dbFiles.push(currency);
    }
  }

  return dbFiles.sort();
}

/**
 * Read all records from a SQLite database
 * @param {string} currency - Currency code
 * @returns {RateRecord[]} All records from the database
 */
function readFromSqlite(currency) {
  const dbPath = join(DB_PATH, `${currency}.db`);

  if (!existsSync(dbPath)) {
    return [];
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = db.prepare(`
      SELECT date, from_curr, to_curr, provider, rate, markup
      FROM rates
      ORDER BY date ASC
    `);

    const rows = stmt.all();

    return rows.map((row) => ({
      date: String(row.date),
      from_curr: /** @type {CurrencyCode} */ (String(row.from_curr)),
      to_curr: /** @type {CurrencyCode} */ (String(row.to_curr)),
      provider: /** @type {import('../shared/types.js').Provider} */ (String(row.provider)),
      rate: Number(row.rate),
      markup: row.markup !== null ? Number(row.markup) : null
    }));
  } finally {
    db.close();
  }
}

// ============================================================================
// CSV Writing
// ============================================================================

/**
 * Group records by year
 * @param {RateRecord[]} records
 * @returns {Map<number, RateRecord[]>}
 */
function groupByYear(records) {
  /** @type {Map<number, RateRecord[]>} */
  const grouped = new Map();

  for (const record of records) {
    const year = getYearFromDate(record.date);

    if (!grouped.has(year)) {
      grouped.set(year, []);
    }

    grouped.get(year)?.push(record);
  }

  return grouped;
}

/**
 * Write records to CSV files
 * @param {string} currency - Currency code
 * @param {RateRecord[]} records - Records to write
 * @param {string} outputDir - Output directory
 * @param {boolean} dryRun - If true, don't actually write
 * @returns {{ years: number[], totalRecords: number }}
 */
function writeToCSV(currency, records, outputDir, dryRun) {
  const currencyDir = join(outputDir, currency);
  const grouped = groupByYear(records);

  if (!dryRun) {
    mkdirSync(currencyDir, { recursive: true });
  }

  const years = [];

  for (const [year, yearRecords] of grouped) {
    years.push(year);

    if (!dryRun) {
      const filePath = join(currencyDir, `${year}.csv`);
      const csvContent = serializeCSV(yearRecords);
      writeFileSync(filePath, csvContent, 'utf-8');
    }
  }

  return {
    years: years.sort((a, b) => a - b),
    totalRecords: records.length
  };
}

// ============================================================================
// Migration
// ============================================================================

/**
 * Migrate a single currency
 * @param {string} currency
 * @param {string} outputDir
 * @param {boolean} dryRun
 * @returns {{ currency: string, records: number, years: number[], targets: number }}
 */
function migrateCurrency(currency, outputDir, dryRun) {
  const records = readFromSqlite(currency);

  if (records.length === 0) {
    return { currency, records: 0, years: [], targets: 0 };
  }

  // Count unique target currencies
  const targets = new Set(records.map((r) => r.to_curr)).size;

  const { years, totalRecords } = writeToCSV(currency, records, outputDir, dryRun);

  return {
    currency,
    records: totalRecords,
    years,
    targets
  };
}

/**
 * Main migration function
 */
async function main() {
  const { currency, dryRun, outputDir } = parseCliArgs();

  console.log(SEPARATOR);
  console.log('  ForexRadar: SQLite to CSV Migration');
  console.log(SEPARATOR);

  if (dryRun) {
    console.log('  Mode: DRY RUN (no files will be written)');
  } else {
    console.log(`  Output: ${outputDir}`);
  }

  // Get currencies to migrate
  const currencies = currency ? [currency] : getDbFiles();

  if (currencies.length === 0) {
    console.log('\nNo database files found to migrate.');
    return;
  }

  console.log(`  Currencies: ${currencies.length}`);
  console.log(SEPARATOR);

  // Ensure output directory exists
  if (!dryRun) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Migrate each currency
  /** @type {Array<{ currency: string, records: number, years: number[], targets: number }>} */
  const results = [];

  for (const curr of currencies) {
    process.stdout.write(`\n  Migrating ${curr}...`);

    const result = migrateCurrency(curr, outputDir, dryRun);
    results.push(result);

    if (result.records > 0) {
      console.log(` ${result.records} records → ${result.years.length} files`);
      console.log(`    Years: ${result.years[0]} - ${result.years[result.years.length - 1]}`);
      console.log(`    Targets: ${result.targets} currencies`);
    } else {
      console.log(' (empty)');
    }
  }

  // Summary
  console.log(`\n${SEPARATOR}`);
  console.log('  Summary');
  console.log(SEPARATOR);

  const totalRecords = results.reduce((sum, r) => sum + r.records, 0);
  const totalFiles = results.reduce((sum, r) => sum + r.years.length, 0);
  const nonEmpty = results.filter((r) => r.records > 0).length;

  console.log(`  Currencies migrated: ${nonEmpty}/${currencies.length}`);
  console.log(`  Total records: ${totalRecords.toLocaleString()}`);
  console.log(`  CSV files created: ${totalFiles}`);

  if (!dryRun) {
    console.log(`\n  ✓ Migration complete!`);
    console.log(`  Files written to: ${outputDir}`);
    console.log(`\n  Next steps:`);
    console.log(`  1. Verify the CSV files look correct`);
    console.log(`  2. Run: mv db db-sqlite-backup`);
    console.log(`  3. Run: mv db-csv db`);
    console.log(`  4. Update .gitignore to exclude *.db files`);
  } else {
    console.log(`\n  This was a dry run. No files were written.`);
    console.log(`  Remove --dry-run to perform the actual migration.`);
  }

  console.log(SEPARATOR);
}

main().catch((error) => {
  console.error(`\nMigration failed: ${error.message}`);
  process.exit(1);
});
