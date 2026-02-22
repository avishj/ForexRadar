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

  /** @type {Promise<Record<string, number[]>|null>|null} */
  #manifestPromise = null;

  /**
   * Create a new CSVReader instance
   * @param {string} [basePath] - URL path to db/ directory. Defaults to './db'
   */
  constructor(basePath = './db') {
    this.#basePath = basePath;
  }

  /**
   * Fetch the db manifest (cached). Returns null if unavailable.
   * @returns {Promise<Record<string, number[]>|null>}
   */
  #fetchManifest() {
    if (!this.#manifestPromise) {
      this.#manifestPromise = fetch(`${this.#basePath}/manifest.json`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => /** @type {null} */ (null));
    }
    return this.#manifestPromise;
  }

  /**
   * Fetch a year file from server
   * @param {CurrencyCode} fromCurr
   * @param {number} year
   * @returns {Promise<RateRecord[]>}
   */
  async #fetchYearFile(fromCurr, year) {
    const fileUrl = `${this.#basePath}/${fromCurr}/${year}.csv`;

    try {
      const response = await fetch(fileUrl);

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
      console.warn(`Failed to fetch ${fileUrl}:`, error);
      return [];
    }
  }

  /**
   * Discover which years exist for a currency.
   * Uses manifest.json when available, falls back to HEAD probing.
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<number[]>}
   */
  async #discoverYears(fromCurr) {
    // Fast path: use manifest if available
    const manifest = await this.#fetchManifest();
    if (manifest?.[fromCurr]) {
      return manifest[fromCurr];
    }

    // Fallback: HEAD-probe year files (generates 404s in console)
    const currentYear = new Date().getFullYear();
    const yearsToTry = [];

    for (let y = currentYear; y >= 1990; y--) {
      yearsToTry.push(y);
    }

    const existingYears = [];
    const batchSize = 5;
    for (let i = 0; i < yearsToTry.length; i += batchSize) {
      const batch = yearsToTry.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (year) => {
          const fileUrl = `${this.#basePath}/${fromCurr}/${year}.csv`;
          try {
            const response = await fetch(fileUrl, { method: 'HEAD' });
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
   * Uses manifest when available, falls back to HEAD requests.
   * 
   * @param {CurrencyCode} fromCurr
   * @returns {Promise<boolean>}
   */
  async hasDataForCurrency(fromCurr) {
    const manifest = await this.#fetchManifest();
    if (manifest) {
      return fromCurr in manifest;
    }

    const currentYear = new Date().getFullYear();
    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      const fileUrl = `${this.#basePath}/${fromCurr}/${year}.csv`;
      try {
        const response = await fetch(fileUrl, { method: 'HEAD' });
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
