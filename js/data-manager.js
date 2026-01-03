/**
 * Data Manager
 * 
 * Orchestrates data fetching from multiple sources and providers:
 * 
 * Sources:
 * 1. Server Database (SQLite via sql.js) - Long-term historical data
 * 2. Client Cache (IndexedDB) - Recently fetched live data
 * 3. Live API (Visa, Mastercard) - Fresh data for gaps
 * 
 * Providers:
 * - Visa: Exchange rate + markup percentage
 * - Mastercard: Exchange rate only (no markup)
 * 
 * Implements the Progressive Enhancement pattern:
 * Local Cache -> Server DB -> Live API
 * 
 * @module data-manager
 */

import * as ServerDB from './server-db-loader.js';
import * as Storage from './storage-manager.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate, getYesterday, addDays } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').MultiProviderStats} MultiProviderStats */

/**
 * @typedef {Object} FetchResult
 * @property {RateRecord[]} records - Array of rate records (all providers combined)
 * @property {RateRecord[]} visaRecords - Visa-only records
 * @property {RateRecord[]} mastercardRecords - Mastercard-only records
 * @property {RateRecord[]} ecbRecords - ECB-only records
 * @property {Object} stats - Fetch statistics
 * @property {number} stats.fromServer - Count from server DB
 * @property {number} stats.fromCache - Count from IndexedDB
 * @property {number} stats.fromLive - Count from live API
 * @property {number} stats.visaCount - Total Visa records
 * @property {number} stats.mastercardCount - Total Mastercard records
 * @property {number} stats.ecbCount - Total ECB records
 * @property {number} stats.total - Total record count
 * @property {boolean} stats.hasServerData - Whether server data exists for this pair
 */

/**
 * @typedef {Object} FetchOptions
 * @property {Function} [onProgress] - Progress callback (stage, message)
 * @property {boolean} [skipLive] - Skip live API fetch
 * @property {boolean} [fetchVisa] - Fetch Visa rates (default: true)
 * @property {boolean} [fetchMastercard] - Fetch Mastercard rates (default: true)
 */

/**
 * Creates a unique key for a rate record (date + provider)
 * @param {string} date - Date string
 * @param {string} provider - Provider name
 * @returns {string} Unique key
 */
function makeRecordKey(date, provider) {
  return `${date}:${provider}`;
}

/**
 * Fetches rate data for a currency pair from all available sources and providers.
 * Implements the hybrid fetch strategy from the spec.
 * 
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {FetchOptions} [options] - Fetch options
 * @returns {Promise<FetchResult>} Merged rate records and stats
 */
export async function fetchRates(fromCurr, toCurr, options = {}) {
  const { 
    onProgress, 
    skipLive = false,
    fetchVisa = true,
    fetchMastercard = true 
  } = options;
  
  const notify = (stage, message) => {
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  /** @type {Map<string, RateRecord>} Key is date:provider */
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
      const key = makeRecordKey(record.date, record.provider);
      mergedData.set(key, record);
      recordSources.set(key, 'cache');
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
      const key = makeRecordKey(record.date, record.provider);
      const wasInCache = mergedData.has(key);
      mergedData.set(key, record);
      // Only mark as 'server' if it wasn't already in cache
      if (!wasInCache) {
        recordSources.set(key, 'server');
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

  // Step 3: Check for gaps and fetch live data from both providers
  if (!skipLive && (fetchVisa || fetchMastercard)) {
    const yesterday = getYesterday();
    const yesterdayStr = formatDate(yesterday);
    
    // Find the latest date we have for each provider
    let latestVisaDate = null;
    let latestMcDate = null;
    
    for (const [key, record] of mergedData.entries()) {
      if (record.provider === 'VISA') {
        if (!latestVisaDate || record.date > latestVisaDate) {
          latestVisaDate = record.date;
        }
      } else if (record.provider === 'MASTERCARD') {
        if (!latestMcDate || record.date > latestMcDate) {
          latestMcDate = record.date;
        }
      }
    }

    // Fetch live data for Visa if needed
    if (fetchVisa && (!latestVisaDate || latestVisaDate < yesterdayStr)) {
      const liveCount = await fetchLiveDataForProvider(
        'VISA',
        VisaClient,
        fromCurr,
        toCurr,
        yesterdayStr,
        latestVisaDate,
        hasServerData,
        mergedData,
        recordSources,
        notify
      );
      fromLive += liveCount;
    }

    // Fetch live data for Mastercard if needed
    if (fetchMastercard && (!latestMcDate || latestMcDate < yesterdayStr)) {
      const liveCount = await fetchLiveDataForProvider(
        'MASTERCARD',
        MastercardClient,
        fromCurr,
        toCurr,
        yesterdayStr,
        latestMcDate,
        hasServerData,
        mergedData,
        recordSources,
        notify
      );
      fromLive += liveCount;
    }

    if (fromLive === 0 && (fetchVisa || fetchMastercard)) {
      notify('live', 'Data is up to date');
    }
  }

  // Convert map to sorted array
  const records = Array.from(mergedData.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Separate by provider
  const visaRecords = records.filter(r => r.provider === 'VISA');
  const mastercardRecords = records.filter(r => r.provider === 'MASTERCARD');
  const ecbRecords = records.filter(r => r.provider === 'ECB');

  // Count sources accurately
  fromServer = 0;
  fromCache = 0;
  for (const [key, source] of recordSources.entries()) {
    if (source === 'cache') fromCache++;
    else if (source === 'server') fromServer++;
    // fromLive is already counted during fetch
  }

  return {
    records,
    visaRecords,
    mastercardRecords,
    ecbRecords,
    stats: {
      fromServer,
      fromCache,
      fromLive,
      visaCount: visaRecords.length,
      mastercardCount: mastercardRecords.length,
      ecbCount: ecbRecords.length,
      total: records.length,
      hasServerData
    }
  };
}

/**
 * Fetches live data for a specific provider
 * @param {Provider} providerName - Provider name
 * @param {typeof VisaClient | typeof MastercardClient} client - Provider client module
 * @param {string} fromCurr - Source currency
 * @param {string} toCurr - Target currency
 * @param {string} yesterdayStr - Yesterday's date string
 * @param {string|null} latestDate - Latest date we have for this provider
 * @param {boolean} hasServerData - Whether server data exists
 * @param {Map<string, RateRecord>} mergedData - Map to add records to
 * @param {Map<string, string>} recordSources - Map to track record sources
 * @param {Function} notify - Progress notification function
 * @returns {Promise<number>} Number of records fetched
 */
async function fetchLiveDataForProvider(
  providerName,
  client,
  fromCurr,
  toCurr,
  yesterdayStr,
  latestDate,
  hasServerData,
  mergedData,
  recordSources,
  notify
) {
  notify('live', `Fetching live ${providerName} data...`);
  
  let fetchedCount = 0;
  const startDate = new Date(yesterdayStr);
  // If no historical data exists, only fetch last 7 days
  const stopDateStr = latestDate || addDays(yesterdayStr, -7);
  
  let currentDate = new Date(startDate);
  let consecutiveErrors = 0;
  const maxErrors = 3;

  while (formatDate(currentDate) > stopDateStr) {
    const dateStr = formatDate(currentDate);
    const key = makeRecordKey(dateStr, providerName);
    
    // Skip if we already have this date for this provider
    if (mergedData.has(key)) {
      currentDate.setDate(currentDate.getDate() - 1);
      continue;
    }

    try {
      notify('live', `Fetching ${providerName} ${dateStr}...`);
      
      const record = await client.fetchRate(currentDate, fromCurr, toCurr);
      
      if (record === null) {
        // End of history
        notify('live', `${providerName}: Reached end of available history`);
        break;
      }

      // Save to cache immediately
      await Storage.saveRate(record);
      
      // Add to merged data
      mergedData.set(key, record);
      recordSources.set(key, 'live');
      fetchedCount++;
      consecutiveErrors = 0;
      
    } catch (error) {
      consecutiveErrors++;
      notify('live', `${providerName} error for ${dateStr}: ${error.message}`);
      
      if (consecutiveErrors >= maxErrors) {
        notify('live', `${providerName}: Too many consecutive errors, stopping`);
        break;
      }
    }

    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (fetchedCount > 0) {
    notify('live', `Fetched ${fetchedCount} ${providerName} records`);
  }

  return fetchedCount;
}

/**
 * Gets statistics for a single provider's dataset
 * @param {RateRecord[]} records - Array of rate records
 * @returns {import('../shared/types.js').RateStats} Statistics object
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
 * Calculates multi-provider statistics for comparison
 * @param {RateRecord[]} visaRecords - Visa rate records
 * @param {RateRecord[]} mastercardRecords - Mastercard rate records
 * @param {RateRecord[]} ecbRecords - ECB rate records
 * @returns {MultiProviderStats} Combined statistics for all providers
 */
export function calculateMultiProviderStats(visaRecords, mastercardRecords, ecbRecords = []) {
  const visaStats = calculateStats(visaRecords);
  const mcStats = calculateStats(mastercardRecords);
  const ecbStats = calculateStats(ecbRecords);

  // Calculate spread (difference between MC and Visa rates)
  // Build a map of dates where we have both rates
  const visaByDate = new Map(visaRecords.map(r => [r.date, r.rate]));
  const mcByDate = new Map(mastercardRecords.map(r => [r.date, r.rate]));
  
  const spreads = [];
  for (const [date, visaRate] of visaByDate.entries()) {
    const mcRate = mcByDate.get(date);
    if (mcRate !== undefined) {
      // Spread = MC rate - Visa rate (positive means MC is higher/worse for buyer)
      spreads.push(mcRate - visaRate);
    }
  }

  const avgSpread = spreads.length > 0 
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length 
    : null;

  // Current spread (using most recent date where both exist)
  let currentSpread = null;
  /** @type {Provider | null} */
  let betterRateProvider = null;

  // Get the most recent date that has both
  const allDates = [...new Set([...visaByDate.keys(), ...mcByDate.keys()])].sort().reverse();
  for (const date of allDates) {
    const visaRate = visaByDate.get(date);
    const mcRate = mcByDate.get(date);
    if (visaRate !== undefined && mcRate !== undefined) {
      currentSpread = mcRate - visaRate;
      // Lower rate is better for buyer (more foreign currency per unit)
      // Actually for buying foreign currency, HIGHER rate is better (you get more per USD)
      // But for billing (paying in foreign currency), LOWER is better
      // Typically for forex cards, lower rate = less INR per USD = better for buyer
      betterRateProvider = visaRate < mcRate ? 'VISA' : (mcRate < visaRate ? 'MASTERCARD' : null);
      break;
    }
  }

  // Combined date range
  const allRecords = [...visaRecords, ...mastercardRecords];
  const dates = allRecords.map(r => r.date).sort();
  const dateRange = {
    start: dates.length > 0 ? dates[0] : null,
    end: dates.length > 0 ? dates[dates.length - 1] : null
  };

  return {
    visa: visaStats,
    mastercard: mcStats,
    ecb: ecbStats,
    avgSpread,
    currentSpread,
    betterRateProvider,
    dateRange
  };
}

/**
 * Clears all cached data (both IndexedDB and in-memory)
 */
export async function clearAllCaches() {
  await Storage.clearCache();
  ServerDB.clearCache();
}
