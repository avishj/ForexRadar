/**
 * CSV Utility Functions
 * 
 * Shared CSV parsing and serialization utilities.
 * Used by both CSVStore (backend) and CSVReader (frontend).
 * 
 * CSV Format:
 *   date,to_curr,provider,rate,markup
 *   2024-01-01,USD,VISA,1.0892,0.45
 *   2024-01-01,USD,ECB,1.0856,
 * 
 * Note: from_curr is implicit (folder name), not stored in CSV.
 * 
 * @module shared/csv-utils
 */

/** @typedef {import('./types.js').RateRecord} RateRecord */
/** @typedef {import('./types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('./types.js').Provider} Provider */

// ============================================================================
// CSV HEADER
// ============================================================================

/**
 * CSV header row (without from_curr which is implicit)
 * @type {string}
 */
export const CSV_HEADER = 'date,to_curr,provider,rate,markup';

/**
 * CSV columns in order
 * @type {readonly string[]}
 */
export const CSV_COLUMNS = Object.freeze(['date', 'to_curr', 'provider', 'rate', 'markup']);

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse a single CSV line into a partial record (without from_curr)
 * @param {string} line - CSV line to parse
 * @returns {{ date: string, to_curr: CurrencyCode, provider: Provider, rate: number, markup: number | null } | null}
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === CSV_HEADER) {
    return null;
  }
  
  const parts = trimmed.split(',');
  if (parts.length < 4) {
    return null;
  }
  
  const [date, to_curr, provider, rateStr, markupStr] = parts;
  
  const rate = parseFloat(rateStr);
  if (isNaN(rate)) {
    return null;
  }
  
  const markup = markupStr && markupStr.trim() !== '' 
    ? parseFloat(markupStr) 
    : null;
  
  return {
    date: date.trim(),
    to_curr: /** @type {CurrencyCode} */ (to_curr.trim()),
    provider: /** @type {Provider} */ (provider.trim()),
    rate,
    markup: markup !== null && !isNaN(markup) ? markup : null
  };
}

/**
 * Parse CSV text into RateRecord array
 * @param {string} csvText - Full CSV content (with or without header)
 * @param {CurrencyCode} fromCurr - Source currency (implicit, folder name)
 * @returns {RateRecord[]} Parsed records
 */
export function parseCSV(csvText, fromCurr) {
  const lines = csvText.split('\n');
  /** @type {RateRecord[]} */
  const records = [];
  
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      records.push({
        date: parsed.date,
        from_curr: fromCurr,
        to_curr: parsed.to_curr,
        provider: parsed.provider,
        rate: parsed.rate,
        markup: parsed.markup
      });
    }
  }
  
  return records;
}

// ============================================================================
// CSV SERIALIZATION
// ============================================================================

/**
 * Serialize a single record to CSV line (without from_curr)
 * @param {RateRecord} record - Record to serialize
 * @returns {string} CSV line (no newline)
 */
function serializeLine(record) {
  const markup = record.markup !== null && record.markup !== undefined
    ? String(record.markup)
    : '';
  return `${record.date},${record.to_curr},${record.provider},${record.rate},${markup}`;
}

/**
 * Serialize records to CSV text (with header)
 * Records are sorted by (date, to_curr, provider) for clean git diffs
 * @param {RateRecord[]} records - Records to serialize
 * @returns {string} Complete CSV content with header and trailing newline
 */
export function serializeCSV(records) {
  if (records.length === 0) {
    return CSV_HEADER + '\n';
  }
  
  // Sort by date, then to_curr, then provider
  const sorted = [...records].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    
    const currCompare = a.to_curr.localeCompare(b.to_curr);
    if (currCompare !== 0) return currCompare;
    
    return a.provider.localeCompare(b.provider);
  });
  
  const lines = [CSV_HEADER];
  for (const record of sorted) {
    lines.push(serializeLine(record));
  }
  
  return lines.join('\n') + '\n';
}

// ============================================================================
// UNIQUE KEY UTILITIES
// ============================================================================

/**
 * Create a unique key for a rate record
 * Used for deduplication in CSVStore
 * @param {string} date - YYYY-MM-DD
 * @param {string} toCurr - Target currency
 * @param {string} provider - Provider name
 * @returns {string} Unique key
 */
export function makeUniqueKey(date, toCurr, provider) {
  return `${date}|${toCurr}|${provider}`;
}

/**
 * Create a unique key from a record
 * @param {RateRecord} record - Rate record
 * @returns {string} Unique key
 */
export function recordToUniqueKey(record) {
  return makeUniqueKey(record.date, record.to_curr, record.provider);
}

/**
 * Create a unique key for checking any provider
 * Used when provider is optional in has() checks
 * @param {string} date - YYYY-MM-DD
 * @param {string} toCurr - Target currency
 * @returns {string} Partial key prefix
 */
export function makeDatePairKey(date, toCurr) {
  return `${date}|${toCurr}`;
}

// ============================================================================
// FILE PATH UTILITIES
// ============================================================================

/**
 * Get the CSV file path for a currency/year combination
 * @param {string} basePath - Base path to db directory
 * @param {string} fromCurr - Source currency
 * @param {number} year - Year
 * @returns {string} File path
 */
export function getCSVFilePath(basePath, fromCurr, year) {
  return `${basePath}/${fromCurr}/${year}.csv`;
}

/**
 * Get the index file path
 * @param {string} basePath - Base path to db directory
 * @returns {string} Index file path
 */
export function getIndexFilePath(basePath) {
  return `${basePath}/_index.json`;
}

/**
 * Get the currency directory path
 * @param {string} basePath - Base path to db directory
 * @param {string} fromCurr - Source currency
 * @returns {string} Currency directory path
 */
export function getCurrencyDirPath(basePath, fromCurr) {
  return `${basePath}/${fromCurr}`;
}

// ============================================================================
// RECORD FILTERING
// ============================================================================

/**
 * Filter records by target currency
 * @param {RateRecord[]} records - Records to filter
 * @param {CurrencyCode} toCurr - Target currency to filter for
 * @returns {RateRecord[]} Filtered records
 */
export function filterByTargetCurrency(records, toCurr) {
  return records.filter(r => r.to_curr === toCurr);
}

/**
 * Filter records by date range (inclusive)
 * @param {RateRecord[]} records - Records to filter
 * @param {string} startDate - Start date (YYYY-MM-DD, inclusive)
 * @param {string} endDate - End date (YYYY-MM-DD, inclusive)
 * @returns {RateRecord[]} Filtered records
 */
export function filterByDateRange(records, startDate, endDate) {
  return records.filter(r => r.date >= startDate && r.date <= endDate);
}

/**
 * Filter records by provider
 * @param {RateRecord[]} records - Records to filter
 * @param {Provider} provider - Provider to filter for
 * @returns {RateRecord[]} Filtered records
 */
export function filterByProvider(records, provider) {
  return records.filter(r => r.provider === provider);
}

/**
 * Split records by provider
 * @param {RateRecord[]} records - Records to split
 * @returns {{ visa: RateRecord[], mastercard: RateRecord[], ecb: RateRecord[] }}
 */
export function splitByProvider(records) {
  /** @type {RateRecord[]} */
  const visa = [];
  /** @type {RateRecord[]} */
  const mastercard = [];
  /** @type {RateRecord[]} */
  const ecb = [];
  
  for (const record of records) {
    switch (record.provider) {
      case 'VISA':
        visa.push(record);
        break;
      case 'MASTERCARD':
        mastercard.push(record);
        break;
      case 'ECB':
        ecb.push(record);
        break;
    }
  }
  
  return { visa, mastercard, ecb };
}

// ============================================================================
// RECORD SORTING
// ============================================================================

/**
 * Sort records by date ascending
 * @param {RateRecord[]} records - Records to sort
 * @returns {RateRecord[]} New sorted array
 */
export function sortByDateAsc(records) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Sort records by date descending
 * @param {RateRecord[]} records - Records to sort
 * @returns {RateRecord[]} New sorted array
 */
export function sortByDateDesc(records) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

// ============================================================================
// RECORD AGGREGATIONS
// ============================================================================

/**
 * Get the latest date from a set of records
 * @param {RateRecord[]} records - Records to check
 * @returns {string | null} Latest date or null if empty
 */
export function getLatestDateFromRecords(records) {
  if (records.length === 0) return null;
  return records.reduce((max, r) => r.date > max ? r.date : max, records[0].date);
}

/**
 * Get the oldest date from a set of records
 * @param {RateRecord[]} records - Records to check
 * @returns {string | null} Oldest date or null if empty
 */
export function getOldestDateFromRecords(records) {
  if (records.length === 0) return null;
  return records.reduce((min, r) => r.date < min ? r.date : min, records[0].date);
}

/**
 * Get all unique target currencies from records
 * @param {RateRecord[]} records - Records to check
 * @returns {CurrencyCode[]} Unique target currencies, sorted
 */
export function getUniqueTargets(records) {
  const targets = new Set(records.map(r => r.to_curr));
  return /** @type {CurrencyCode[]} */ ([...targets].sort());
}

/**
 * Count records by provider
 * @param {RateRecord[]} records - Records to count
 * @returns {Record<Provider, number>} Counts per provider
 */
export function countByProvider(records) {
  /** @type {Record<Provider, number>} */
  const counts = { VISA: 0, MASTERCARD: 0, ECB: 0 };
  for (const record of records) {
    if (record.provider in counts) {
      counts[record.provider]++;
    }
  }
  return counts;
}
