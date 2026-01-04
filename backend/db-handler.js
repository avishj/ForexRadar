/**
 * SQLite Database Handler
 * 
 * Manages SQLite database operations for storing exchange rate data.
 * Uses better-sqlite3 for synchronous, performant SQLite access.
 * 
 * Database files are sharded by source currency: /db/{FROM_CURRENCY}.db
 * 
 * @module db-handler
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to db/ relative to this script (root level)
const DB_BASE_PATH = join(__dirname, '..', 'db');

/**
 * Schema for the rates table - matches the unified schema from spec
 * UNIQUE constraint prevents duplicate records for same date/pair/provider
 */
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    from_curr TEXT NOT NULL,
    to_curr TEXT NOT NULL,
    provider TEXT NOT NULL,
    rate REAL NOT NULL,
    markup REAL,
    UNIQUE(date, from_curr, to_curr, provider)
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_date_pair ON rates(date, from_curr, to_curr)
`;

/**
 * Ensures the database directory exists
 */
function ensureDbDirectory() {
  if (!existsSync(DB_BASE_PATH)) {
    mkdirSync(DB_BASE_PATH, { recursive: true });
  }
}

/**
 * Gets the database file path for a given source currency
 * @param {string} fromCurr - Source currency code (e.g., "USD")
 * @returns {string} Full path to the database file
 */
export function getDbPath(fromCurr) {
  return join(DB_BASE_PATH, `${fromCurr}.db`);
}

/**
 * Opens a SQLite database in read-only mode (doesn't modify the file)
 * @param {string} fromCurr - Source currency code (e.g., "USD")
 * @returns {Database.Database | null} SQLite database instance, or null if file doesn't exist
 */
export function openDatabaseReadOnly(fromCurr) {
  const dbPath = getDbPath(fromCurr);
  if (!existsSync(dbPath)) {
    return null;
  }
  const db = new Database(dbPath, { readonly: true });
  return db;
}

/**
 * Opens or creates a SQLite database for a given source currency
 * @param {string} fromCurr - Source currency code (e.g., "USD")
 * @returns {Database.Database} SQLite database instance
 */
export function openDatabase(fromCurr) {
  ensureDbDirectory();
  const dbPath = getDbPath(fromCurr);
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Initialize schema
  db.exec(CREATE_TABLE_SQL);
  db.exec(CREATE_INDEX_SQL);
  
  return db;
}

/**
 * Inserts a single rate record into the database
 * Uses INSERT OR IGNORE to silently skip duplicates (enforced by UNIQUE constraint)
 * @param {Database.Database} db - SQLite database instance
 * @param {RateRecord} record - Rate record to insert
 * @returns {boolean} True if inserted, false if duplicate was skipped
 */
export function insertRate(db, record) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO rates (date, from_curr, to_curr, provider, rate, markup)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    record.date,
    record.from_curr,
    record.to_curr,
    record.provider,
    record.rate,
    record.markup
  );
  
  return result.changes > 0;
}

/**
 * Inserts multiple rate records in a single transaction
 * Uses INSERT OR IGNORE to silently skip duplicates (enforced by UNIQUE constraint)
 * @param {Database.Database} db - SQLite database instance
 * @param {RateRecord[]} records - Array of rate records to insert
 * @returns {number} Number of records actually inserted (excluding duplicates)
 */
export function insertRates(db, records) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO rates (date, from_curr, to_curr, provider, rate, markup)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((records) => {
    let inserted = 0;
    for (const record of records) {
      const result = stmt.run(
        record.date,
        record.from_curr,
        record.to_curr,
        record.provider,
        record.rate,
        record.markup
      );
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });
  
  return insertMany(records);
}

/**
 * Gets the latest date in the database for a specific currency pair
 * @param {Database.Database} db - SQLite database instance
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {string|null} Latest date in "YYYY-MM-DD" format, or null if no data
 */
export function getLatestDate(db, fromCurr, toCurr) {
  const stmt = db.prepare(`
    SELECT MAX(date) as latest_date
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
  `);
  
  const result = stmt.get(fromCurr, toCurr);
  return result?.latest_date ?? null;
}

/**
 * Gets the oldest date in the database for a specific currency pair
 * @param {Database.Database} db - SQLite database instance
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {string|null} Oldest date in "YYYY-MM-DD" format, or null if no data
 */
export function getOldestDate(db, fromCurr, toCurr) {
  const stmt = db.prepare(`
    SELECT MIN(date) as oldest_date
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
  `);
  
  const result = stmt.get(fromCurr, toCurr);
  return result?.oldest_date ?? null;
}

/**
 * Checks if a rate exists for a specific date, currency pair, and provider
 * @param {Database.Database} db - SQLite database instance
 * @param {string} date - Date in "YYYY-MM-DD" format
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {string} [provider] - Optional provider name. If omitted, checks for any provider.
 * @returns {boolean} True if rate exists
 */
export function rateExists(db, date, fromCurr, toCurr, provider) {
  if (provider) {
    const stmt = db.prepare(`
      SELECT 1 FROM rates
      WHERE date = ? AND from_curr = ? AND to_curr = ? AND provider = ?
      LIMIT 1
    `);
    const result = stmt.get(date, fromCurr, toCurr, provider);
    return result !== undefined;
  } else {
    const stmt = db.prepare(`
      SELECT 1 FROM rates
      WHERE date = ? AND from_curr = ? AND to_curr = ?
      LIMIT 1
    `);
    const result = stmt.get(date, fromCurr, toCurr);
    return result !== undefined;
  }
}

/**
 * Filters out records that already exist in the database
 * @param {Database.Database | null} db - SQLite database instance (read-only), or null if DB doesn't exist
 * @param {RateRecord[]} records - Array of rate records to check
 * @returns {RateRecord[]} Array of records that don't exist in the database
 */
export function filterNewRecords(db, records) {
  if (!db || records.length === 0) {
    return records;
  }
  
  const newRecords = [];
  for (const record of records) {
    if (!rateExists(db, record.date, record.from_curr, record.to_curr, record.provider)) {
      newRecords.push(record);
    }
  }
  return newRecords;
}

/**
 * Gets all rates for a specific currency pair
 * @param {Database.Database} db - SQLite database instance
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {RateRecord[]} Array of rate records sorted by date ASC
 */
export function getRates(db, fromCurr, toCurr) {
  const stmt = db.prepare(`
    SELECT date, from_curr, to_curr, provider, rate, markup
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
    ORDER BY date ASC
  `);
  
  return stmt.all(fromCurr, toCurr);
}

/**
 * Gets the count of records for a specific currency pair
 * @param {Database.Database} db - SQLite database instance
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {number} Count of records
 */
export function getRecordCount(db, fromCurr, toCurr) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM rates
    WHERE from_curr = ? AND to_curr = ?
  `);
  
  const result = stmt.get(fromCurr, toCurr);
  return result?.count ?? 0;
}

/**
 * Lists all unique currency pairs in the database
 * @param {Database.Database} db - SQLite database instance
 * @returns {Array<{from_curr: string, to_curr: string}>} Array of currency pairs
 */
export function listPairs(db) {
  const stmt = db.prepare(`
    SELECT DISTINCT from_curr, to_curr
    FROM rates
    ORDER BY from_curr, to_curr
  `);
  
  return stmt.all();
}

/**
 * Closes the database connection
 * @param {Database.Database} db - SQLite database instance
 */
export function closeDatabase(db) {
  db.close();
}
