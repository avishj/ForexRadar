/**
 * CSVStore - Backend data store for exchange rates
 * 
 * Handles both reading and writing to sharded CSV files.
 * Guarantees uniqueness via in-memory index per currency.
 * 
 * @module backend/csv-store
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCSV,
  serializeCSV,
  makeUniqueKey,
  makeDatePairKey,
  recordToUniqueKey,
  getCSVFilePath,
  getCurrencyDirPath,
  filterByTargetCurrency,
  sortByDateAsc,
  getLatestDateFromRecords,
  getOldestDateFromRecords,
  getUniqueTargets,
  countByProvider
} from '../shared/csv-utils.js';

import { getYearFromDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').Provider} Provider */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CSVStore class for reading and writing exchange rate data
 */
export class CSVStore {
  /** @type {string} */
  #basePath;

  /**
   * In-memory index for uniqueness checking
   * Map<fromCurr, Set<"date|to_curr|provider">>
   * @type {Map<string, Set<string>>}
   */
  #uniqueIndex = new Map();

  /**
   * Cache of loaded records per currency/year
   * Map<"fromCurr/year", RateRecord[]>
   * @type {Map<string, RateRecord[]>}
   */
  #recordCache = new Map();

  /**
   * Track which currencies have been fully indexed
   * @type {Set<string>}
   */
  #indexedCurrencies = new Set();

  /**
   * Create a new CSVStore instance
   * @param {string} [basePath] - Path to db/ directory. Defaults to ../db relative to this file.
   */
  constructor(basePath) {
    this.#basePath = basePath || join(__dirname, '..', 'db');
  }

  /**
   * Ensure currency directory exists
   * @param {string} fromCurr
   */
  #ensureCurrencyDir(fromCurr) {
    const dirPath = getCurrencyDirPath(this.#basePath, fromCurr);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Get all year files for a currency
   * @param {string} fromCurr
   * @returns {number[]} Array of years
   */
  #getYearsForCurrency(fromCurr) {
    const dirPath = getCurrencyDirPath(this.#basePath, fromCurr);
    if (!existsSync(dirPath)) {
      return [];
    }

    const files = readdirSync(dirPath);
    const years = [];
    for (const file of files) {
      const match = file.match(/^(\d{4})\.csv$/);
      if (match) {
        years.push(parseInt(match[1], 10));
      }
    }
    return years.sort((a, b) => a - b);
  }

  /**
   * Read a year file
   * @param {string} fromCurr
   * @param {number} year
   * @returns {RateRecord[]}
   */
  #readYearFile(fromCurr, year) {
    const cacheKey = `${fromCurr}/${year}`;
    
    // Check cache first
    if (this.#recordCache.has(cacheKey)) {
      return this.#recordCache.get(cacheKey) || [];
    }

    const filePath = getCSVFilePath(this.#basePath, fromCurr, year);
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const records = parseCSV(content, /** @type {CurrencyCode} */ (fromCurr));
    
    // Cache the records
    this.#recordCache.set(cacheKey, records);
    
    return records;
  }

  /**
   * Write a year file
   * @param {string} fromCurr
   * @param {number} year
   * @param {RateRecord[]} records
   */
  #writeYearFile(fromCurr, year, records) {
    this.#ensureCurrencyDir(fromCurr);
    const filePath = getCSVFilePath(this.#basePath, fromCurr, year);
    const content = serializeCSV(records);
    writeFileSync(filePath, content, 'utf-8');
    
    // Update cache
    const cacheKey = `${fromCurr}/${year}`;
    this.#recordCache.set(cacheKey, records);
  }

  /**
   * Load all records for a currency and build unique index
   * @param {string} fromCurr
   */
  #ensureIndexLoaded(fromCurr) {
    if (this.#indexedCurrencies.has(fromCurr)) {
      return;
    }

    const index = new Set();
    const years = this.#getYearsForCurrency(fromCurr);
    
    for (const year of years) {
      const records = this.#readYearFile(fromCurr, year);
      for (const record of records) {
        index.add(recordToUniqueKey(record));
      }
    }

    this.#uniqueIndex.set(fromCurr, index);
    this.#indexedCurrencies.add(fromCurr);
  }

  /**
   * Get or create unique index for a currency
   * @param {string} fromCurr
   * @returns {Set<string>}
   */
  #getIndex(fromCurr) {
    this.#ensureIndexLoaded(fromCurr);
    let index = this.#uniqueIndex.get(fromCurr);
    if (!index) {
      index = new Set();
      this.#uniqueIndex.set(fromCurr, index);
    }
    return index;
  }

  /**
   * Get all records for a currency (all years)
   * @param {string} fromCurr
   * @returns {RateRecord[]}
   */
  #getAllRecordsForCurrency(fromCurr) {
    const years = this.#getYearsForCurrency(fromCurr);
    /** @type {RateRecord[]} */
    const allRecords = [];
    
    for (const year of years) {
      const records = this.#readYearFile(fromCurr, year);
      allRecords.push(...records);
    }
    
    return allRecords;
  }

  /**
   * Add one or more rate records.
   * Idempotent: duplicates are silently skipped.
   * Writes immediately to disk.
   * 
   * @param {RateRecord | RateRecord[]} records - Single record or array
   * @returns {number} Count of records actually added (excludes duplicates)
   */
  add(records) {
    const recordArray = Array.isArray(records) ? records : [records];
    
    if (recordArray.length === 0) {
      return 0;
    }

    // Group records by fromCurr and year
    /** @type {Map<string, Map<number, RateRecord[]>>} */
    const grouped = new Map();

    let addedCount = 0;

    for (const record of recordArray) {
      const fromCurr = record.from_curr;
      const year = getYearFromDate(record.date);
      const uniqueKey = recordToUniqueKey(record);
      
      // Check uniqueness
      const index = this.#getIndex(fromCurr);
      if (index.has(uniqueKey)) {
        continue; // Skip duplicate
      }

      // Add to index
      index.add(uniqueKey);
      addedCount++;

      // Group for writing
      if (!grouped.has(fromCurr)) {
        grouped.set(fromCurr, new Map());
      }
      const currencyGroup = grouped.get(fromCurr);
      if (!currencyGroup.has(year)) {
        currencyGroup.set(year, []);
      }
      currencyGroup.get(year)?.push(record);
    }

    // Write each currency/year file
    for (const [fromCurr, yearMap] of grouped) {
      for (const [year, newRecords] of yearMap) {
        // Read existing records
        const existing = this.#readYearFile(fromCurr, year);
        
        // Merge and write
        const merged = [...existing, ...newRecords];
        this.#writeYearFile(fromCurr, year, merged);
      }
    }

    return addedCount;
  }

  /**
   * Check if a rate exists.
   * When provider is omitted, checks if ANY provider has data.
   * 
   * @param {string} date - YYYY-MM-DD
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @param {Provider} [provider] - Optional. If omitted, checks any provider.
   * @returns {boolean}
   */
  has(date, fromCurr, toCurr, provider) {
    const index = this.#getIndex(fromCurr);
    
    if (provider) {
      // Check for specific provider
      const key = makeUniqueKey(date, toCurr, provider);
      return index.has(key);
    } else {
      // Check for any provider
      const prefix = makeDatePairKey(date, toCurr);
      for (const key of index) {
        if (key.startsWith(prefix + '|')) {
          return true;
        }
      }
      return false;
    }
  }

  /**
   * Get most recent date for a currency pair.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {string | null} YYYY-MM-DD or null
   */
  latestDate(fromCurr, toCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    const filtered = filterByTargetCurrency(allRecords, toCurr);
    return getLatestDateFromRecords(filtered);
  }

  /**
   * Get oldest date for a currency pair.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {string | null} YYYY-MM-DD or null
   */
  oldestDate(fromCurr, toCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    const filtered = filterByTargetCurrency(allRecords, toCurr);
    return getOldestDateFromRecords(filtered);
  }

  /**
   * List all target currencies for a source.
   * @param {CurrencyCode} fromCurr
   * @returns {CurrencyCode[]}
   */
  targets(fromCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    return getUniqueTargets(allRecords);
  }

  /**
   * List all source currencies with data.
   * @returns {CurrencyCode[]}
   */
  sources() {
    if (!existsSync(this.#basePath)) {
      return [];
    }

    const entries = readdirSync(this.#basePath, { withFileTypes: true });
    /** @type {CurrencyCode[]} */
    const sources = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        // Check if directory has any CSV files
        const dirPath = join(this.#basePath, entry.name);
        const files = readdirSync(dirPath);
        if (files.some(f => f.endsWith('.csv'))) {
          sources.push(/** @type {CurrencyCode} */ (entry.name));
        }
      }
    }

    return sources.sort();
  }

  /**
   * Get all records for a currency pair, sorted by date ASC.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {RateRecord[]}
   */
  getAll(fromCurr, toCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    const filtered = filterByTargetCurrency(allRecords, toCurr);
    return sortByDateAsc(filtered);
  }

  /**
   * Count total records for a currency pair.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {number}
   */
  count(fromCurr, toCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    const filtered = filterByTargetCurrency(allRecords, toCurr);
    return filtered.length;
  }

  /**
   * Count records per provider.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Record<Provider, number>}
   */
  countByProvider(fromCurr, toCurr) {
    const allRecords = this.#getAllRecordsForCurrency(fromCurr);
    const filtered = filterByTargetCurrency(allRecords, toCurr);
    return countByProvider(filtered);
  }

  /**
   * Clear all in-memory caches.
   * Useful if files were modified externally.
   */
  clearCache() {
    this.#uniqueIndex.clear();
    this.#recordCache.clear();
    this.#indexedCurrencies.clear();
  }

  /**
   * Get the base path being used
   * @returns {string}
   */
  get basePath() {
    return this.#basePath;
  }
}

/**
 * Default CSVStore instance using standard db/ path
 * @type {CSVStore}
 */
export const store = new CSVStore();
