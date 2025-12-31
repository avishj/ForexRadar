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
 * @module data-manager
 */

import * as ServerDB from './server-db-loader.js';
import * as Storage from './storage-manager.js';
import * as VisaClient from './visa-client.js';
import { formatDate, getYesterday, addDays } from '../../shared/utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

/**
 * @typedef {Object} FetchResult
 * @property {RateRecord[]} records - Array of rate records
 * @property {Object} stats - Fetch statistics
 * @property {number} stats.fromServer - Count from server DB
 * @property {number} stats.fromCache - Count from IndexedDB
 * @property {number} stats.fromLive - Count from live API
 * @property {number} stats.total - Total record count
 * @property {boolean} stats.hasServerData - Whether server data exists for this pair
 */

/**
 * @typedef {Object} FetchOptions
 * @property {Function} [onProgress] - Progress callback (stage, message)
 * @property {boolean} [skipLive] - Skip live API fetch
 */

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
  
  /** @type {Map<string, 'cache'|'server'|'live'>} Track source of each record */
  const recordSources = new Map();
  
  let fromServer = 0;
  let fromCache = 0;
  let fromLive = 0;
  let hasServerData = false;

  // Step 1: Load Cache Data first
  notify('cache', 'Loading cached data...');
  
  try {
    const cacheRecords = await Storage.getRatesForPair(fromCurr, toCurr);
    for (const record of cacheRecords) {
      mergedData.set(record.date, record);
      recordSources.set(record.date, 'cache');
    }
    notify('cache', `Loaded ${cacheRecords.length} records from cache`);
  } catch (error) {
    notify('cache', `Cache unavailable: ${error.message}`);
  }

  // Step 2: Load Server Data (may overwrite cache with fresher data)
  notify('server', 'Loading server data...');
  
  try {
    const serverRecords = await ServerDB.queryRates(fromCurr, toCurr);
    hasServerData = serverRecords.length > 0;
    for (const record of serverRecords) {
      const wasInCache = mergedData.has(record.date);
      mergedData.set(record.date, record);
      // Only mark as 'server' if it wasn't already in cache
      if (!wasInCache) {
        recordSources.set(record.date, 'server');
      }
    }
    notify('server', `Loaded ${serverRecords.length} records from server`);
    
    // Cache server data in IndexedDB for offline access
    if (serverRecords.length > 0) {
      try {
        await Storage.saveRates(serverRecords);
      } catch (cacheError) {
        // Non-fatal: cache save failure shouldn't stop data flow
        console.warn('Failed to cache server data:', cacheError);
      }
    }
  } catch (error) {
    notify('server', `Server data unavailable: ${error.message}`);
  }

  // Step 3: Check for gaps and fetch live data
  if (!skipLive) {
    const yesterday = getYesterday();
    const yesterdayStr = formatDate(yesterday);
    
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
      // If no historical data exists, only fetch last 7 days
      const stopDateStr = latestDate || addDays(yesterdayStr, -7);
      
      let currentDate = new Date(startDate);
      let consecutiveErrors = 0;
      const maxErrors = 3;

      while (formatDate(currentDate) > stopDateStr) {
        const dateStr = formatDate(currentDate);
        
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
          recordSources.set(record.date, 'live');
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

  // Count sources accurately
  for (const [date, source] of recordSources.entries()) {
    if (source === 'cache') fromCache++;
    else if (source === 'server') fromServer++;
    else if (source === 'live') fromLive++;
  }

  return {
    records,
    stats: {
      fromServer,
      fromCache,
      fromLive,
      total: records.length,
      hasServerData
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
