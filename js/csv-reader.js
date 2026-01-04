/**
 * CSVReader - Frontend data loader for exchange rates
 * 
 * Loads data from server CSV files with IndexedDB caching.
 * Auto-refreshes when data becomes stale (after UTC 12:00).
 * Supports date range filtering for efficient loading.
 * 
 * @module js/csv-reader
 */

import {
  parseCSV,
  filterByTargetCurrency,
  filterByDateRange,
  sortByDateAsc,
  splitByProvider,
  getLatestDateFromRecords,
  getOldestDateFromRecords,
  getUniqueTargets
} from '../shared/csv-utils.js';

import {
  resolveDateRange,
  needsRefresh,
  markCacheRefreshed,
  clearAllCacheTimestamps
} from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').DateRange} DateRange */

const DB_NAME = 'ForexRadarCSV';
const DB_VERSION = 1;
const STORE_NAME = 'rates';

/**
 * CSVReader class for loading exchange rate data in the browser
 */
export class CSVReader {
  /** @type {string} */
  #basePath;

  /** @type {IDBDatabase | null} */
  #db = null;

  /**
   * Create a new CSVReader instance
   * @param {string} [basePath] - URL path to db/ directory. Defaults to './db'
   */
  constructor(basePath = './db') {
    this.#basePath = basePath;
  }

  /**
   * Open IndexedDB connection
   * @returns {Promise<IDBDatabase>}
   */
  async #openDB() {
    if (this.#db) {
      return this.#db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.#db = request.result;
        resolve(this.#db);
      };

      request.onupgradeneeded = (event) => {
        const db = /** @type {IDBOpenDBRequest} */ (event.target).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: ['date', 'from_curr', 'to_curr', 'provider']
          });

          // Index for querying by source currency (for bulk operations)
          store.createIndex('from_curr', 'from_curr', { unique: false });

          // Index for querying by currency pair
          store.createIndex('pair', ['from_curr', 'to_curr'], { unique: false });
        }
      };
    });
  }

  /**
   * Save records to IndexedDB
   * @param {RateRecord[]} records
   * @returns {Promise<number>} Count of records saved
   */
  async #saveToCache(records) {
    if (records.length === 0) return 0;

    const db = await this.#openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let savedCount = 0;

      transaction.oncomplete = () => resolve(savedCount);
      transaction.onerror = () => reject(new Error(`Failed to save: ${transaction.error?.message}`));

      for (const record of records) {
        const request = store.put(record);
        request.onsuccess = () => savedCount++;
      }
    });
  }

  /**
   * Get all cached records for a source currency
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<RateRecord[]>}
   */
  async #getFromCache(fromCurr) {
    const db = await this.#openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('from_curr');

      const request = index.getAll(fromCurr);

      request.onerror = () => reject(new Error(`Failed to read cache: ${request.error?.message}`));
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Clear all cached records for a source currency
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<void>}
   */
  async #clearCacheForCurrency(fromCurr) {
    const db = await this.#openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('from_curr');

      const request = index.openCursor(IDBKeyRange.only(fromCurr));

      request.onerror = () => reject(new Error(`Failed to clear cache: ${request.error?.message}`));

      request.onsuccess = (event) => {
        const cursor = /** @type {IDBCursorWithValue | null} */ (
          /** @type {IDBRequest} */ (event.target).result
        );
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * Fetch a year file from server
   * @param {CurrencyCode} fromCurr
   * @param {number} year
   * @returns {Promise<RateRecord[]>}
   */
  async #fetchYearFile(fromCurr, year) {
    const url = `${this.#basePath}/${fromCurr}/${year}.csv`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return []; // File doesn't exist, not an error
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      return parseCSV(text, fromCurr);
    } catch (error) {
      // Network error or other issues - return empty
      console.warn(`Failed to fetch ${url}:`, error);
      return [];
    }
  }

  /**
   * Discover which years exist for a currency by trying common years
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<number[]>}
   */
  async #discoverYears(fromCurr) {
    const currentYear = new Date().getFullYear();
    const yearsToTry = [];

    // Try current year and 30 years back (covers ECB data from 1999)
    for (let y = currentYear; y >= 1990; y--) {
      yearsToTry.push(y);
    }

    // Check which years have files (in parallel, batched)
    const existingYears = [];

    // Check in batches to avoid too many parallel requests
    const batchSize = 5;
    for (let i = 0; i < yearsToTry.length; i += batchSize) {
      const batch = yearsToTry.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (year) => {
          const url = `${this.#basePath}/${fromCurr}/${year}.csv`;
          try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok ? year : null;
          } catch {
            return null;
          }
        })
      );

      for (const year of results) {
        if (year !== null) {
          existingYears.push(year);
        }
      }

      // If we found a gap of 3+ years with no data, stop looking further back
      if (existingYears.length > 0) {
        const latestFound = Math.max(...existingYears);
        const oldestTried = Math.min(...batch);
        if (latestFound - oldestTried > 5 && !results.some((y) => y !== null)) {
          break;
        }
      }
    }

    return existingYears.sort((a, b) => a - b);
  }

  /**
   * Fetch all data for a source currency from server
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<RateRecord[]>}
   */
  async #fetchAllFromServer(fromCurr) {
    const years = await this.#discoverYears(fromCurr);

    if (years.length === 0) {
      return [];
    }

    // Fetch all year files in parallel
    const results = await Promise.all(years.map((year) => this.#fetchYearFile(fromCurr, year)));

    // Flatten and return
    return results.flat();
  }

  /**
   * Ensure cache is fresh for a source currency
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<void>}
   */
  async #ensureFreshCache(fromCurr) {
    if (!needsRefresh(fromCurr)) {
      return; // Cache is still fresh
    }

    // Fetch fresh data from server
    const serverRecords = await this.#fetchAllFromServer(fromCurr);

    if (serverRecords.length > 0) {
      // Clear old cache and save new data
      await this.#clearCacheForCurrency(fromCurr);
      await this.#saveToCache(serverRecords);
    }

    // Mark as refreshed even if no data (to avoid repeated fetches)
    markCacheRefreshed(fromCurr);
  }

  /**
   * Load rates for a currency pair within a date range.
   * Automatically handles cache freshness (UTC 12:00 boundary).
   * 
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @param {DateRange} range - { months: 6 } | { years: 2 } | { start, end } | { all: true }
   * @returns {Promise<RateRecord[]>} Sorted by date ASC
   */
  async getRates(fromCurr, toCurr, range) {
    // Ensure cache is fresh
    await this.#ensureFreshCache(fromCurr);

    // Load from cache
    const allRecords = await this.#getFromCache(fromCurr);

    // Filter by target currency
    const pairRecords = filterByTargetCurrency(allRecords, toCurr);

    // Resolve and apply date range filter
    const { start, end } = resolveDateRange(range);
    const filteredRecords = filterByDateRange(pairRecords, start, end);

    // Sort and return
    return sortByDateAsc(filteredRecords);
  }

  /**
   * Load rates split by provider.
   * Convenience wrapper around getRates().
   * 
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @param {DateRange} range
   * @returns {Promise<{ visa: RateRecord[], mastercard: RateRecord[], ecb: RateRecord[] }>}
   */
  async getRatesByProvider(fromCurr, toCurr, range) {
    const records = await this.getRates(fromCurr, toCurr, range);
    return splitByProvider(records);
  }

  /**
   * Get most recent date for a currency pair.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Promise<string | null>}
   */
  async latestDate(fromCurr, toCurr) {
    await this.#ensureFreshCache(fromCurr);
    const allRecords = await this.#getFromCache(fromCurr);
    const pairRecords = filterByTargetCurrency(allRecords, toCurr);
    return getLatestDateFromRecords(pairRecords);
  }

  /**
   * Get oldest date for a currency pair.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Promise<string | null>}
   */
  async oldestDate(fromCurr, toCurr) {
    await this.#ensureFreshCache(fromCurr);
    const allRecords = await this.#getFromCache(fromCurr);
    const pairRecords = filterByTargetCurrency(allRecords, toCurr);
    return getOldestDateFromRecords(pairRecords);
  }

  /**
   * Get date range boundaries.
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Promise<{ oldest: string, latest: string } | null>}
   */
  async dateRange(fromCurr, toCurr) {
    await this.#ensureFreshCache(fromCurr);
    const allRecords = await this.#getFromCache(fromCurr);
    const pairRecords = filterByTargetCurrency(allRecords, toCurr);

    const oldest = getOldestDateFromRecords(pairRecords);
    const latest = getLatestDateFromRecords(pairRecords);

    if (!oldest || !latest) {
      return null;
    }

    return { oldest, latest };
  }

  /**
   * List target currencies for a source.
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<CurrencyCode[]>}
   */
  async targets(fromCurr) {
    await this.#ensureFreshCache(fromCurr);
    const allRecords = await this.#getFromCache(fromCurr);
    return getUniqueTargets(allRecords);
  }

  /**
   * List all source currencies with data.
   * Note: This requires checking which currencies have data on the server.
   * Returns currencies that are currently cached.
   * @returns {Promise<CurrencyCode[]>}
   */
  async sources() {
    const db = await this.#openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('from_curr');

      const request = index.openKeyCursor(null, 'nextunique');
      /** @type {CurrencyCode[]} */
      const sources = [];

      request.onerror = () => reject(new Error(`Failed to get sources: ${request.error?.message}`));

      request.onsuccess = (event) => {
        const cursor = /** @type {IDBCursor | null} */ (
          /** @type {IDBRequest} */ (event.target).result
        );
        if (cursor) {
          sources.push(/** @type {CurrencyCode} */ (cursor.key));
          cursor.continue();
        } else {
          resolve(sources.sort());
        }
      };
    });
  }

  /**
   * Check if data exists for a source currency.
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<boolean>}
   */
  async exists(fromCurr) {
    await this.#ensureFreshCache(fromCurr);
    const records = await this.#getFromCache(fromCurr);
    return records.length > 0;
  }

  /**
   * Clear all cached data (IndexedDB + refresh timestamps).
   * @returns {Promise<void>}
   */
  async clearCache() {
    const db = await this.#openDB();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(new Error(`Failed to clear cache: ${request.error?.message}`));
      request.onsuccess = () => resolve(undefined);
    });

    clearAllCacheTimestamps();
  }

  /**
   * Force refresh data for a source currency.
   * Use when you know new data is available.
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<void>}
   */
  async forceRefresh(fromCurr) {
    // Fetch fresh data from server
    const serverRecords = await this.#fetchAllFromServer(fromCurr);

    // Clear old cache and save new data
    await this.#clearCacheForCurrency(fromCurr);

    if (serverRecords.length > 0) {
      await this.#saveToCache(serverRecords);
    }

    // Mark as refreshed
    markCacheRefreshed(fromCurr);
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
 * Default CSVReader instance using standard db/ path
 * @type {CSVReader}
 */
export const reader = new CSVReader();
