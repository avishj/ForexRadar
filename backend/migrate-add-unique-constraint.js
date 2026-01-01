#!/usr/bin/env node

/**
 * Migration Script: Add Unique Constraint
 * 
 * Adds a UNIQUE constraint to prevent duplicate records for the same
 * date, currency pair, and provider combination.
 * 
 * This migration:
 * 1. Removes any existing duplicates (keeping oldest rowid)
 * 2. Creates new table with UNIQUE constraint
 * 3. Migrates data
 * 4. Replaces old table
 * 
 * Usage: node migrate-add-unique-constraint.js
 */

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_BASE_PATH = join(__dirname, '..', 'db');

/**
 * Migrates a single database file
 * @param {string} dbPath - Path to the database file
 * @param {string} dbName - Name of the database (for logging)
 */
function migrateDatabase(dbPath, dbName) {
  console.log(`\n=== Migrating ${dbName} ===`);
  
  const db = new Database(dbPath);
  
  try {
    // Check if unique constraint already exists
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='rates'").get();
    if (tableInfo && tableInfo.sql.includes('UNIQUE')) {
      console.log('✓ Unique constraint already exists, skipping');
      db.close();
      return;
    }
    
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // Count duplicates before cleanup
    const dupeCount = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT date, from_curr, to_curr, provider, COUNT(*) as cnt
        FROM rates
        GROUP BY date, from_curr, to_curr, provider
        HAVING cnt > 1
      )
    `).get();
    
    console.log(`Found ${dupeCount.count} sets of duplicates`);
    
    if (dupeCount.count > 0) {
      // Remove duplicates - keep the record with minimum rowid (oldest insert)
      const deleteResult = db.prepare(`
        DELETE FROM rates
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM rates
          GROUP BY date, from_curr, to_curr, provider
        )
      `).run();
      
      console.log(`✓ Removed ${deleteResult.changes} duplicate records`);
    }
    
    // Create new table with UNIQUE constraint
    db.exec(`
      CREATE TABLE rates_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        from_curr TEXT NOT NULL,
        to_curr TEXT NOT NULL,
        provider TEXT NOT NULL,
        rate REAL NOT NULL,
        markup REAL,
        UNIQUE(date, from_curr, to_curr, provider)
      )
    `);
    
    // Copy data from old table to new table
    const copyResult = db.prepare(`
      INSERT INTO rates_new (date, from_curr, to_curr, provider, rate, markup)
      SELECT date, from_curr, to_curr, provider, rate, markup
      FROM rates
    `).run();
    
    console.log(`✓ Copied ${copyResult.changes} records to new table`);
    
    // Drop old table
    db.exec('DROP TABLE rates');
    
    // Rename new table
    db.exec('ALTER TABLE rates_new RENAME TO rates');
    
    // Recreate index
    db.exec('CREATE INDEX IF NOT EXISTS idx_date_pair ON rates(date, from_curr, to_curr)');
    
    // Commit transaction
    db.exec('COMMIT');
    
    // Verify
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM rates').get();
    console.log(`✓ Migration complete: ${finalCount.count} records in final table`);
    
  } catch (error) {
    console.error(`✗ Migration failed: ${error.message}`);
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Main migration function
 */
function main() {
  console.log('=== Database Migration: Add UNIQUE Constraint ===');
  console.log('This will prevent duplicate records for same date/pair/provider\n');
  
  if (!existsSync(DB_BASE_PATH)) {
    console.error('Database directory not found:', DB_BASE_PATH);
    process.exit(1);
  }
  
  // Get all .db files
  const dbFiles = readdirSync(DB_BASE_PATH).filter(f => f.endsWith('.db'));
  
  if (dbFiles.length === 0) {
    console.log('No database files found');
    return;
  }
  
  console.log(`Found ${dbFiles.length} database(s) to migrate`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const dbFile of dbFiles) {
    try {
      const dbPath = join(DB_BASE_PATH, dbFile);
      migrateDatabase(dbPath, dbFile);
      successCount++;
    } catch (error) {
      console.error(`Failed to migrate ${dbFile}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n=== Migration Summary ===`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

main();
