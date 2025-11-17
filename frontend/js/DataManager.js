/**
 * Data Manager
 * 
 * Orchestrates data fetching from multiple sources:
 * 1. Server Database (SQLite via sql.js) - Long-term historical data
 * 2. Client Cache (IndexedDB) - Recently fetched live data
 * 3. Live API (Visa) - Fresh data for gaps
 * 
 * Implements the Progressive Enhancement pattern:
 * Local Cache -> Server DB -> Live API
 * 
 * @module DataManager
 */

import * as ServerDB from './ServerDBLoader.js';
import * as Storage from './StorageManager.js';
import * as VisaClient from './VisaClient.js';

/**
 * @typedef {Object} RateRecord
 * @property {string} date - Date in "YYYY-MM-DD" format
 * @property {string} from_curr - Source currency code
 * @property {string} to_curr - Target currency code
 * @property {string} provider - Provider name
 * @property {number} rate - Exchange rate
 * @property {number} markup - Markup percentage as decimal
 */

/**
 * @typedef {Object} FetchResult
 * @property {RateRecord[]} records - Array of rate records
 * @property {Object} stats - Fetch statistics
 * @property {number} stats.fromServer - Count from server DB
 * @property {number} stats.fromCache - Count from IndexedDB
 * @property {number} stats.fromLive - Count from live API
 * @property {number} stats.total - Total record count
 */

/**
 * @typedef {Object} FetchOptions
 * @property {Function} [onProgress] - Progress callback (stage, message)
 * @property {boolean} [skipLive] - Skip live API fetch
 */

/**
 * Gets yesterday's date
 * @returns {Date}
 */
function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  // Reset time to midnight
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Adds days to a date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} days - Days to add (can be negative)
 * @returns {string} New date string
 */
function addDays(dateStr, days) {
  const date = VisaClient.parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return VisaClient.formatDateForStorage(date);
}

/**
 * Fetches rate data for a currency pair from all available sources.
 * Implements the hybrid fetch strategy from the spec.
 * 
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {FetchOptions} [options] - Fetch options
 * @returns {Promise<FetchResult>} Merged rate records and stats
 */
export async function fetchRates(fromCurr, toCurr, options = {}) {
  const { onProgress, skipLive = false } = options;
  
  const notify = (stage, message) => {
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  /** @type {Map<string, RateRecord>} */
  const mergedData = new Map();
  
  let fromServer = 0;
  let fromCache = 0;
  let fromLive = 0;

  // Step 1: Load Server Data
  notify('server', 'Loading server data...');
  
  try {
    const serverRecords = await ServerDB.queryRates(fromCurr, toCurr);
    for (const record of serverRecords) {
      mergedData.set(record.date, record);
    }
    fromServer = serverRecords.length;
    notify('server', `Loaded ${fromServer} records from server`);
  } catch (error) {
    notify('server', `Server data unavailable: ${error.message}`);
  }

  // Step 2: Load Cache Data (overwrites server data if fresher)
  notify('cache', 'Loading cached data...');
  
  try {
    const cacheRecords = await Storage.getRatesForPair(fromCurr, toCurr);
    for (const record of cacheRecords) {
      mergedData.set(record.date, record);
    }
    fromCache = cacheRecords.length;
    notify('cache', `Loaded ${fromCache} records from cache`);
  } catch (error) {
    notify('cache', `Cache unavailable: ${error.message}`);
  }

  // Step 3: Check for gaps and fetch live data
  if (!skipLive) {
    const yesterday = getYesterday();
    const yesterdayStr = VisaClient.formatDateForStorage(yesterday);
    
    // Find the latest date we have
    let latestDate = null;
    for (const date of mergedData.keys()) {
      if (!latestDate || date > latestDate) {
        latestDate = date;
      }
    }

    // If we're missing recent data, fetch from live API
    if (!latestDate || latestDate < yesterdayStr) {
      notify('live', 'Fetching live data...');
      
      const startDate = new Date(yesterday);
      const stopDateStr = latestDate || addDays(yesterdayStr, -365);
      
      let currentDate = new Date(startDate);
      let consecutiveErrors = 0;
      const maxErrors = 3;

      while (VisaClient.formatDateForStorage(currentDate) > stopDateStr) {
        const dateStr = VisaClient.formatDateForStorage(currentDate);
        
        // Skip if we already have this date
        if (mergedData.has(dateStr)) {
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }

        try {
          notify('live', `Fetching ${dateStr}...`);
          
          const record = await VisaClient.fetchRate(currentDate, fromCurr, toCurr);
          
          if (record === null) {
            // End of history (HTTP 500)
            notify('live', 'Reached end of available history');
            break;
          }

          // Save to cache immediately
          await Storage.saveRate(record);
          
          // Add to merged data
          mergedData.set(record.date, record);
          fromLive++;
          consecutiveErrors = 0;
          
        } catch (error) {
          consecutiveErrors++;
          notify('live', `Error fetching ${dateStr}: ${error.message}`);
          
          if (consecutiveErrors >= maxErrors) {
            notify('live', 'Too many consecutive errors, stopping');
            break;
          }
        }

        // Move to previous day
        currentDate.setDate(currentDate.getDate() - 1);
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (fromLive > 0) {
        notify('live', `Fetched ${fromLive} records from live API`);
      }
    } else {
      notify('live', 'Data is up to date');
    }
  }

  // Convert map to sorted array
  const records = Array.from(mergedData.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    records,
    stats: {
      fromServer,
      fromCache,
      fromLive,
      total: records.length
    }
  };
}

/**
 * Gets statistics for a dataset
 * @param {RateRecord[]} records - Array of rate records
 * @returns {Object} Statistics object
 */
export function calculateStats(records) {
  if (records.length === 0) {
    return {
      high: null,
      low: null,
      current: null,
      avgMarkup: null,
      dateRange: { start: null, end: null }
    };
  }

  const rates = records.map(r => r.rate);
  const markups = records.map(r => r.markup).filter(m => m !== null && m !== undefined);

  return {
    high: Math.max(...rates),
    low: Math.min(...rates),
    current: records[records.length - 1].rate,
    avgMarkup: markups.length > 0 
      ? markups.reduce((a, b) => a + b, 0) / markups.length 
      : null,
    dateRange: {
      start: records[0].date,
      end: records[records.length - 1].date
    }
  };
}

/**
 * Clears all cached data (both IndexedDB and in-memory)
 */
export async function clearAllCaches() {
  await Storage.clearCache();
  ServerDB.clearCache();
}
