/**
 * Data Manager
 * 
 * Orchestrates data fetching from multiple sources and providers:
 * 
 * Sources (in order of priority):
 * 1. IndexedDB Cache (via StorageManager) - fastest, local
 * 2. Server CSV files (via CSVReader) - historical data
 * 3. Live API (Visa, Mastercard) - fresh data for gaps
 * 
 * Providers:
 * - Visa: Exchange rate + markup percentage
 * - Mastercard: Exchange rate only (no markup)
 * - ECB: Official European Central Bank rates
 * 
 * Implements the Progressive Enhancement pattern:
 * IndexedDB Cache -> Server CSV -> Live API (for gaps)
 * 
 * Cache Freshness:
 * - Server data is refreshed automatically after UTC 12:00
 * - Live data fills gaps between server data and yesterday
 * 
 * @module data-manager
 */

import { csvReader } from './csv-reader.js';
import * as StorageManager from './storage-manager.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate, getYesterday, addDays, parseDate } from '../../shared/utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').RateStats} RateStats */
/** @typedef {import('../../shared/types.js').Provider} Provider */
/** @typedef {import('../../shared/types.js').MultiProviderStats} MultiProviderStats */
/** @typedef {import('../../shared/types.js').DateRange} DateRange */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */

/**
 * @typedef {Object} FetchResult
 * @property {RateRecord[]} records - Array of rate records (all providers combined)
 * @property {RateRecord[]} visaRecords - Visa-only records
 * @property {RateRecord[]} mastercardRecords - Mastercard-only records
 * @property {RateRecord[]} ecbRecords - ECB-only records
 * @property {Object} stats - Fetch statistics
 * @property {number} stats.fromCache - Count from IndexedDB cache
 * @property {number} stats.fromServer - Count from server CSV
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
 * Save records to IndexedDB and merge into the working maps.
 * Always marks records as 'server' source since server data supersedes cache.
 *
 * @param {RateRecord[]} records
 * @param {Map<string, RateRecord>} mergedData
 * @param {Map<string, string>} recordSources
 * @returns {Promise<void>}
 */
async function saveAndMergeServerRecords(records, mergedData, recordSources) {
  for (const record of records) {
    const key = makeRecordKey(record.date, record.provider);
    mergedData.set(key, record);
    recordSources.set(key, 'server');
  }
  try {
    await StorageManager.saveRates(records);
  } catch (error) {
    console.error('Failed to persist server records:', error);
  }
}

/**
 * Calculates the start date based on a date range
 * @param {DateRange} range - Date range specification
 * @returns {string|null} Start date string or null for "all"
 */
function getStartDateFromRange(range) {
  if ("all" in range && range.all) {
    return null; // No start date filtering
  }
  
  // Start from end of today to ensure we include today's data
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today
  const startDate = new Date(now);
  
  if ("months" in range && range.months) {
    startDate.setMonth(startDate.getMonth() - range.months);
  } else if ("years" in range && range.years) {
    startDate.setFullYear(startDate.getFullYear() - range.years);
  }
  
  // Set to beginning of the start day
  startDate.setHours(0, 0, 0, 0);
  
  return formatDate(startDate);
}

/**
 * Calculates the earliest year needed for CSV fetching based on a date range.
 * Returns null for "all" (fetch every year).
 * @param {DateRange} range - Date range specification
 * @returns {number|null} Start year or null for "all"
 */
export function getStartYearFromRange(range) {
  const startDate = getStartDateFromRange(range);
  if (!startDate) return null;
  return parseInt(startDate.slice(0, 4), 10);
}

/**
 * Filters records by date range
 * @param {RateRecord[]} records - Records to filter
 * @param {DateRange} range - Date range specification
 * @returns {RateRecord[]} Filtered records
 */
function filterByRange(records, range) {
  const startDate = getStartDateFromRange(range);
  
  if (!startDate) {
    return records; // Return all
  }
  
  return records.filter(r => r.date >= startDate);
}

/**
 * Fetches rate data for a currency pair from all available sources and providers.
 * 
 * Flow:
 * 1. Load data from IndexedDB cache (StorageManager)
 * 2. If cache is stale (after UTC 12:00), fetch from server CSV and update cache
 * 3. Check for gaps between latest data and yesterday
 * 4. Fetch live API data to fill gaps
 * 5. Save live data to cache
 * 
 * @param {CurrencyCode} fromCurr - Source currency code
 * @param {CurrencyCode} toCurr - Target currency code
 * @param {DateRange} range - Date range to fetch: { months: 1 } | { years: 1 } | { all: true }
 * @param {FetchOptions} [options] - Fetch options
 * @returns {Promise<FetchResult>} Merged rate records and stats
 */
export async function fetchRates(fromCurr, toCurr, range, options = {}) {
  const { 
    onProgress, 
    skipLive = false,
    fetchVisa = true,
    fetchMastercard = true 
  } = options;
  
  const notify = (/** @type {string} */ stage, /** @type {string} */ message) => {
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  /** @type {Map<string, RateRecord>} Key is date:provider */
  const mergedData = new Map();
  
  /** @type {Map<string, 'cache'|'server'|'live'>} Track source of each record */
  const recordSources = new Map();
  
  let fromCache = 0;
  let fromLive = 0;
  let hasServerData = false;

  // Step 1: Load data from IndexedDB cache
  notify('cache', 'Checking cached data...');
  
  try {
    const cachedRecords = await StorageManager.getRatesForPair(fromCurr, toCurr);
    
    for (const record of cachedRecords) {
      const key = makeRecordKey(record.date, record.provider);
      mergedData.set(key, record);
      recordSources.set(key, 'cache');
    }
    
    fromCache = cachedRecords.length;
    
    if (fromCache > 0) {
      notify('cache', `Loaded ${fromCache} cached records`);
    }
  } catch (error) {
    notify('cache', `Cache unavailable: ${error.message}`);
  }

  // Step 2: Check if we need to refresh from server
  const needsRefresh = StorageManager.needsServerRefresh(fromCurr);
  const startYear = getStartYearFromRange(range);
  
  if (needsRefresh) {
    notify('server', 'Fetching server data...');
    
    try {
      // Server is stale — refetch all year files needed for the current range.
      // This ensures we pick up any newly-available data (e.g., today's rates).
      const serverData = await csvReader.fetchRatesByProviderInRange(fromCurr, toCurr, startYear);

      const serverRecords = [...serverData.visa, ...serverData.mastercard, ...serverData.ecb];
      hasServerData = serverRecords.length > 0 || fromCache > 0;
      
      if (serverRecords.length > 0) {
        await saveAndMergeServerRecords(serverRecords, mergedData, recordSources);
        notify('server', `Fetched ${serverRecords.length} records from server`);

        // Only mark as refreshed when records were actually retrieved.
        // Transient network errors return [] instead of throwing, so an empty
        // result may indicate a silent failure — don't suppress retries.
        StorageManager.setLastFetchedStartYear(fromCurr, startYear);
        StorageManager.markServerRefreshed(fromCurr);
      } else if (!hasServerData) {
        notify('server', 'No server data available for this pair');
      }
    } catch (error) {
      notify('server', `Server error: ${error.message}`);
    }
  } else {
    notify('server', 'Server data is up to date');
    // Mark server data as existing if we have cached data
    hasServerData = fromCache > 0;

    // Even when server is fresh, check if range expanded beyond what we fetched.
    // This handles: switching from "1mo" to "all" without triggering a full refetch.
    const prevStartYear = StorageManager.getLastFetchedStartYear(fromCurr);
    const rangeExpanded = prevStartYear !== null && prevStartYear !== 0
      && (startYear === null || startYear < prevStartYear);

    if (rangeExpanded) {
      notify('server', 'Fetching older year files for expanded range...');
      try {
        /** @type {{ visa: RateRecord[], mastercard: RateRecord[], ecb: RateRecord[] }} */
        let deltaData;
        if (startYear === null) {
          // "All" requested — fetch every year before prevStartYear
          deltaData = await csvReader.fetchRatesByProviderInYearRange(fromCurr, toCurr, 0, prevStartYear);
        } else {
          deltaData = await csvReader.fetchRatesByProviderInYearRange(fromCurr, toCurr, startYear, prevStartYear);
        }
        const deltaRecords = [...deltaData.visa, ...deltaData.mastercard, ...deltaData.ecb];

        if (deltaRecords.length > 0) {
          await saveAndMergeServerRecords(deltaRecords, mergedData, recordSources);
          notify('server', `Fetched ${deltaRecords.length} older records`);
          StorageManager.setLastFetchedStartYear(fromCurr, startYear);
        }
      } catch (error) {
        notify('server', `Delta fetch error: ${error.message}`);
      }
    } else if (prevStartYear === null && fromCache > 0) {
      // First call after page load but server is still fresh — record what we have.
      // Only set when cache data exists; otherwise an empty cache would block
      // future delta fetches for this range.
      StorageManager.setLastFetchedStartYear(fromCurr, startYear);
    }
  }

  // Step 3: Check for gaps and fetch live data from Visa/Mastercard
  // Only use the pair-level freshness gate when both providers are in scope.
  // A single-provider call shouldn't suppress future fetches for the other.
  const bothProviders = fetchVisa && fetchMastercard;
  const needsLive = !skipLive && (fetchVisa || fetchMastercard)
    && (!bothProviders || StorageManager.needsLiveRefresh(fromCurr, toCurr));

  if (needsLive) {
    const yesterday = getYesterday();
    const yesterdayStr = formatDate(yesterday);
    
    // Find the latest date we have for each provider (from merged data)
    let latestVisaDate = null;
    let latestMcDate = null;
    
    for (const [, record] of mergedData.entries()) {
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

    // Fetch live data for Visa and Mastercard in parallel
    /** @type {Promise<number>[]} */
    const livePromises = [];

    if (fetchVisa && (!latestVisaDate || latestVisaDate < yesterdayStr)) {
      livePromises.push(fetchLiveDataForProvider(
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
      ));
    }

    if (fetchMastercard && (!latestMcDate || latestMcDate < yesterdayStr)) {
      livePromises.push(fetchLiveDataForProvider(
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
      ));
    }

    const liveResults = await Promise.allSettled(livePromises);
    for (const result of liveResults) {
      if (result.status === 'fulfilled') {
        fromLive += result.value;
      } else {
        console.error('Live fetch failed:', result.reason);
      }
    }

    // Only mark pair-level freshness when both providers were in scope.
    // Otherwise a later call enabling the skipped provider would be blocked.
    if (bothProviders) {
      StorageManager.markLiveFetched(fromCurr, toCurr);
    }

    if (fromLive === 0 && (fetchVisa || fetchMastercard)) {
      notify('live', 'Data is up to date');
    }
  }

  // Convert map to sorted array
  let records = Array.from(mergedData.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Apply date range filter
  records = filterByRange(records, range);

  // Separate by provider (after filtering)
  const visaRecords = records.filter(r => r.provider === 'VISA');
  const mastercardRecords = records.filter(r => r.provider === 'MASTERCARD');
  const ecbRecords = records.filter(r => r.provider === 'ECB');

  // Recount sources after filtering
  let filteredFromCache = 0;
  let filteredFromServer = 0;
  let filteredFromLive = 0;
  
  for (const record of records) {
    const key = makeRecordKey(record.date, record.provider);
    const source = recordSources.get(key);
    if (source === 'cache') filteredFromCache++;
    else if (source === 'server') filteredFromServer++;
    else if (source === 'live') filteredFromLive++;
  }

  return {
    records,
    visaRecords,
    mastercardRecords,
    ecbRecords,
    stats: {
      fromCache: filteredFromCache,
      fromServer: filteredFromServer,
      fromLive: filteredFromLive,
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
 * @param {CurrencyCode} fromCurr - Source currency
 * @param {CurrencyCode} toCurr - Target currency
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
  
  const startDate = parseDate(yesterdayStr);
  // If no historical data exists, only fetch last 7 days
  const stopDateStr = latestDate || addDays(yesterdayStr, -7);
  
  // Collect all missing dates
  /** @type {Date[]} */
  const missingDates = [];
  const currentDate = new Date(startDate.getTime());
  
  while (formatDate(currentDate) > stopDateStr) {
    const dateStr = formatDate(currentDate);
    const key = makeRecordKey(dateStr, providerName);
    
    if (!mergedData.has(key)) {
      missingDates.push(new Date(currentDate.getTime()));
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }

  if (missingDates.length === 0) {
    return 0;
  }

  notify('live', `Fetching live data for ${missingDates.length} ${providerName} dates...`);

  // Fetch with concurrency limit of 3, fail-fast on first error
  const MAX_CONCURRENCY = 3;
  let fetchedCount = 0;
  /** @type {RateRecord[]} */
  const recordsToSave = [];
  let failed = false;

  for (let i = 0; i < missingDates.length && !failed; i += MAX_CONCURRENCY) {
    const batch = missingDates.slice(i, i + MAX_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(date => client.fetchRate(date, fromCurr, toCurr))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const dateStr = formatDate(batch[j]);
      const key = makeRecordKey(dateStr, providerName);

      if (result.status === 'rejected') {
        notify('live', `${providerName} failed on ${dateStr}: ${result.reason?.message ?? result.reason}, stopping`);
        failed = true;
        continue;
      }

      if (result.value !== null) {
        mergedData.set(key, result.value);
        recordSources.set(key, 'live');
        recordsToSave.push(result.value);
        fetchedCount++;
      }
    }
  }

  // Batch save everything that succeeded
  if (recordsToSave.length > 0) {
    await StorageManager.saveRates(recordsToSave);
    notify('live', `Fetched ${fetchedCount} ${providerName} records`);
  }

  return fetchedCount;
}

/**
 * Gets statistics for a single provider's dataset
 * @param {RateRecord[]} records - Array of rate records
 * @returns {RateStats} Statistics object
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
  const allRecords = [...visaRecords, ...mastercardRecords, ...ecbRecords];
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
 * Clears all cached data (IndexedDB + cache timestamps)
 */
export async function clearAllCaches() {
  await StorageManager.clearCache();
}

/**
 * Checks if the cache has data for a currency pair
 * @param {string} fromCurr - Source currency
 * @param {string} toCurr - Target currency
 * @returns {Promise<boolean>} True if cache has data
 */
export async function hasCachedData(fromCurr, toCurr) {
  const count = await StorageManager.getRecordCount(fromCurr, toCurr);
  return count > 0;
}

/**
 * Gets the latest cached date for a provider
 * @param {string} fromCurr - Source currency
 * @param {string} toCurr - Target currency
 * @param {Provider} provider - Provider name
 * @returns {Promise<string|null>} Latest date or null
 */
export async function getLatestCachedDate(fromCurr, toCurr, provider) {
  return StorageManager.getLatestDateForProvider(fromCurr, toCurr, provider);
}

/**
 * Checks if server data exists for a currency (without fetching)
 * @param {CurrencyCode} fromCurr - Source currency code
 * @returns {Promise<boolean>} True if server has data for this currency
 */
export async function hasServerData(fromCurr) {
  return csvReader.hasDataForCurrency(fromCurr);
}
