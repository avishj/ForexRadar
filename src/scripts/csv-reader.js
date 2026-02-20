/**
 * CSVReader - Server-side CSV data fetcher
 * 
 * Pure fetcher for server CSV files. No caching - that's StorageManager's job.
 * Fetches sharded yearly CSV files from db/{CURRENCY}/{YEAR}.csv
 * 
 * @module src/scripts/csv-reader
 */

import {
  parseCSV,
  filterByTargetCurrency,
  sortByDateAsc,
  splitByProvider
} from '../../shared/csv-utils.js';
import { url } from '../utils/url.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../../shared/types.js').Provider} Provider */

/**
 * CSVReader class for fetching exchange rate data from server
 */
export class CSVReader {
  /** @type {string} */
  #basePath;

  /**
   * Create a new CSVReader instance
   * @param {string} [basePath] - URL path to db/ directory. Defaults to './db'
   */
  constructor(basePath = './db') {
    this.#basePath = basePath;
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
   * Discover which years exist for a currency by checking common years
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
   * Fetch all data for a source currency from server.
   * Returns ALL records - no filtering applied.
   * 
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<RateRecord[]>}
   */
  async fetchAllForCurrency(fromCurr) {
    const years = await this.#discoverYears(fromCurr);

    if (years.length === 0) {
      return [];
    }

    // Fetch all year files in parallel
    const results = await Promise.all(years.map((year) => this.#fetchYearFile(fromCurr, year)));

    // Flatten, sort, and return
    return sortByDateAsc(results.flat());
  }

  /**
   * Fetch rates for a specific currency pair from server.
   * 
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Promise<RateRecord[]>} Sorted by date ASC
   */
  async fetchRatesForPair(fromCurr, toCurr) {
    const allRecords = await this.fetchAllForCurrency(fromCurr);
    const pairRecords = filterByTargetCurrency(allRecords, toCurr);
    return sortByDateAsc(pairRecords);
  }

  /**
   * Fetch rates for a pair, split by provider.
   * 
   * @param {CurrencyCode} fromCurr
   * @param {CurrencyCode} toCurr
   * @returns {Promise<{ visa: RateRecord[], mastercard: RateRecord[], ecb: RateRecord[] }>}
   */
  async fetchRatesByProvider(fromCurr, toCurr) {
    const records = await this.fetchRatesForPair(fromCurr, toCurr);
    return splitByProvider(records);
  }

  /**
   * Check if server has data for a source currency.
   * Does a HEAD request to check if any year files exist.
   * 
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<boolean>}
   */
  async hasDataForCurrency(fromCurr) {
    const currentYear = new Date().getFullYear();
    
    // Check current year and last 2 years
    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      const url = `${this.#basePath}/${fromCurr}/${year}.csv`;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) return true;
      } catch {
        continue;
      }
    }
    
    return false;
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
export const csvReader = new CSVReader(url('/db'));
