/**
 * IndexedDB Storage Manager
 * 
 * Handles client-side caching of exchange rate data using IndexedDB.
 * Unified cache for all data sources (server CSV, live API).
 * Tracks cache staleness per source currency using localStorage.
 * 
 * Cache Staleness Rules:
 * - Data is considered stale after UTC 12:00 (when ECB typically updates)
 * - Each source currency has its own refresh timestamp
 * - Staleness check: has UTC 12:00 passed since last refresh?
 * 
 * Database: ForexRadarDB
 * Store: rates
 * 
 * @module storage-manager
 */

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').Provider} Provider */

const DB_NAME = 'ForexRadarDB';
const DB_VERSION = 2;
const STORE_NAME = 'rates';
const REFRESH_KEY_PREFIX = 'forexRadar_serverRefresh_';

/** @type {IDBDatabase|null} */
let dbInstance = null;

/** @type {Promise<IDBDatabase>|null} */
let dbOpenPromise = null;

// ============================================================================
// Cache Staleness Functions
// ============================================================================

/**
 * Get the most recent UTC 12:00 that has passed.
 * @returns {Date}
 */
function getLastUTC12pm() {
  const now = new Date();
  const utc12Today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12, 0, 0, 0
  ));

  // If UTC 12:00 today hasn't happened yet, use yesterday's
  if (now < utc12Today) {
    utc12Today.setUTCDate(utc12Today.getUTCDate() - 1);
  }

  return utc12Today;
}

/**
 * Check if server data needs refresh for a source currency.
 * Data is stale if the last refresh was before the most recent UTC 12:00.
 * 
 * @param {string} fromCurr - Source currency code
 * @returns {boolean} True if data needs refresh from server
 */
export function needsServerRefresh(fromCurr) {
  const key = REFRESH_KEY_PREFIX + fromCurr;
  const lastRefresh = localStorage.getItem(key);

  if (!lastRefresh) {
    return true; // Never fetched, needs refresh
  }

  const lastRefreshDate = new Date(lastRefresh);
  const lastUTC12pm = getLastUTC12pm();

  // Stale if last refresh was before the most recent UTC 12:00
  return lastRefreshDate < lastUTC12pm;
}

/**
 * Mark server data as refreshed for a source currency.
 * Called after successfully fetching and caching server data.
 * 
 * @param {string} fromCurr - Source currency code
 */
export function markServerRefreshed(fromCurr) {
  const key = REFRESH_KEY_PREFIX + fromCurr;
  localStorage.setItem(key, new Date().toISOString());
}

/**
 * Get the last server refresh timestamp for a currency.
 * 
 * @param {string} fromCurr - Source currency code
 * @returns {Date | null}
 */
export function getLastServerRefresh(fromCurr) {
  const key = REFRESH_KEY_PREFIX + fromCurr;
  const lastRefresh = localStorage.getItem(key);
  return lastRefresh ? new Date(lastRefresh) : null;
}

/**
 * Clear all server refresh timestamps.
 */
export function clearAllRefreshTimestamps() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(REFRESH_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

// ============================================================================
// IndexedDB Functions
// ============================================================================

/**
 * Opens the IndexedDB database, creating it if necessary
 * Uses promise memoization to prevent race conditions on concurrent calls.
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbOpenPromise = null;
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
      const tx = /** @type {IDBTransaction} */ (/** @type {IDBOpenDBRequest} */ (event.target).transaction);
      
      /** @type {IDBObjectStore} */
      let store;
      
      // Create rates store with compound key (or get existing store for upgrade)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, {
          keyPath: ['date', 'from_curr', 'to_curr', 'provider']
        });
        
        // Index for querying by currency pair
        store.createIndex('pair', ['from_curr', 'to_curr'], { unique: false });
        
        // Index for querying by date
        store.createIndex('date', 'date', { unique: false });
      } else {
        store = tx.objectStore(STORE_NAME);
      }
      
      // V2: Add composite index for efficient provider queries
      if (!store.indexNames.contains('pair_provider')) {
        store.createIndex('pair_provider', ['from_curr', 'to_curr', 'provider'], { unique: false });
      }
    };
  });

  return dbOpenPromise;
}

/**
 * Saves a single rate record to IndexedDB
 * @param {RateRecord} record - Rate record to save
 * @returns {Promise<void>}
 */
export async function saveRate(record) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put(record);
    
    request.onerror = () => {
      reject(new Error(`Failed to save rate: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Saves multiple rate records to IndexedDB in a single transaction
 * @param {RateRecord[]} records - Array of rate records to save
 * @returns {Promise<number>} Number of records saved
 */
export async function saveRates(records) {
  if (records.length === 0) return 0;
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let savedCount = 0;
    
    transaction.oncomplete = () => {
      resolve(savedCount);
    };
    
    transaction.onerror = () => {
      reject(new Error(`Failed to save rates: ${transaction.error?.message}`));
    };
    
    for (const record of records) {
      const request = store.put(record);
      request.onsuccess = () => {
        savedCount++;
      };
    }
  });
}

/**
 * Gets all rate records for a specific currency pair
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<RateRecord[]>} Array of rate records sorted by date ASC
 */
export async function getRatesForPair(fromCurr, toCurr) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('pair');
    
    const request = index.getAll([fromCurr, toCurr]);
    
    request.onerror = () => {
      reject(new Error(`Failed to get rates: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      const records = request.result || [];
      // Sort by date ascending
      records.sort((a, b) => a.date.localeCompare(b.date));
      resolve(records);
    };
  });
}

/**
 * Gets the latest date in cache for a specific currency pair
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<string|null>} Latest date in "YYYY-MM-DD" format, or null
 */
export async function getLatestDate(fromCurr, toCurr) {
  const records = await getRatesForPair(fromCurr, toCurr);
  
  if (records.length === 0) {
    return null;
  }
  
  return records[records.length - 1].date;
}

/**
 * Checks if a rate exists in cache for a specific date, currency pair, and provider
 * Uses direct key lookup for efficiency instead of loading all records
 * @param {string} date - Date in "YYYY-MM-DD" format
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {string} [provider] - Provider name (optional - if omitted, checks for any provider)
 * @returns {Promise<boolean>}
 */
export async function rateExists(date, fromCurr, toCurr, provider) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    if (provider) {
      // Check for specific provider using direct key lookup
      const request = store.get([date, fromCurr, toCurr, provider]);
      
      request.onerror = () => {
        reject(new Error(`Failed to check rate: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };
    } else {
      // Check if any provider exists for this date/pair using cursor (stops at first match)
      const index = store.index('pair');
      const range = IDBKeyRange.only([fromCurr, toCurr]);
      const request = index.openCursor(range);
      
      request.onerror = () => {
        reject(new Error(`Failed to check rate: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(false);
          return;
        }
        
        if (cursor.value.date === date) {
          resolve(true);
        } else {
          cursor.continue();
        }
      };
    }
  });
}

/**
 * Clears all cached rates and refresh timestamps
 * @returns {Promise<void>}
 */
export async function clearCache() {
  const db = await openDB();
  
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.clear();
    
    request.onerror = () => {
      reject(new Error(`Failed to clear cache: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
  
  // Also clear refresh timestamps
  clearAllRefreshTimestamps();
}

/**
 * Gets the count of cached records for a currency pair
 * Uses IDBIndex.count() instead of loading all records
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<number>}
 */
export async function getRecordCount(fromCurr, toCurr) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('pair');
    
    const request = index.count(IDBKeyRange.only([fromCurr, toCurr]));
    
    request.onerror = () => {
      reject(new Error(`Failed to count records: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * Gets the latest date for a specific provider in cache
 * Uses cursor with reverse direction on pair_provider index for efficiency
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {Provider} provider - Provider name
 * @returns {Promise<string|null>} Latest date or null
 */
export async function getLatestDateForProvider(fromCurr, toCurr, provider) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('pair_provider');
    const range = IDBKeyRange.only([fromCurr, toCurr, provider]);
    
    // Open cursor in reverse to get latest date first
    const request = index.openCursor(range, 'prev');
    
    request.onerror = () => {
      reject(new Error(`Failed to get latest date: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        resolve(cursor.value.date);
      } else {
        resolve(null);
      }
    };
  });
}

/**
 * Gets rates for a currency pair split by provider
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<{visa: RateRecord[], mastercard: RateRecord[], ecb: RateRecord[]}>}
 */
export async function getRatesByProvider(fromCurr, toCurr) {
  const records = await getRatesForPair(fromCurr, toCurr);
  
  return {
    visa: records.filter(r => r.provider === 'VISA'),
    mastercard: records.filter(r => r.provider === 'MASTERCARD'),
    ecb: records.filter(r => r.provider === 'ECB')
  };
}
