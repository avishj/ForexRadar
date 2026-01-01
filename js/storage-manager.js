/**
 * IndexedDB Storage Manager
 * 
 * Handles client-side caching of exchange rate data using IndexedDB.
 * Used for "Lazy Loaded" pairs (0-365 days) fetched live by the browser.
 * 
 * Database: ForexRadarDB
 * Store: rates
 * 
 * @module storage-manager
 */

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

const DB_NAME = 'ForexRadarDB';
const DB_VERSION = 1;
const STORE_NAME = 'rates';

/** @type {IDBDatabase|null} */
let dbInstance = null;

/**
 * Opens the IndexedDB database, creating it if necessary
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
      
      // Create rates store with compound key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ['date', 'from_curr', 'to_curr', 'provider']
        });
        
        // Index for querying by currency pair
        store.createIndex('pair', ['from_curr', 'to_curr'], { unique: false });
        
        // Index for querying by date
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
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
      // Check for specific provider
      const request = store.get([date, fromCurr, toCurr, provider]);
      
      request.onerror = () => {
        reject(new Error(`Failed to check rate: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };
    } else {
      // Check if any provider exists for this date/pair
      // Use the pair index and filter by date
      const index = store.index('pair');
      const request = index.getAll([fromCurr, toCurr]);
      
      request.onerror = () => {
        reject(new Error(`Failed to check rate: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        const records = request.result || [];
        const exists = records.some(r => r.date === date);
        resolve(exists);
      };
    }
  });
}

/**
 * Clears all cached rates (useful for debugging/testing)
 * @returns {Promise<void>}
 */
export async function clearCache() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
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
}

/**
 * Gets the count of cached records for a currency pair
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<number>}
 */
export async function getRecordCount(fromCurr, toCurr) {
  const records = await getRatesForPair(fromCurr, toCurr);
  return records.length;
}
