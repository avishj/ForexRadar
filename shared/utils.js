/**
 * Shared Utility Functions
 * 
 * Common date, formatting, and cache utilities used across frontend and backend.
 * 
 * @module shared/utils
 */

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Formats a Date object to YYYY-MM-DD string for storage/display
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to a Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Parsed date object
 */
export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adds days to a date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} days - Days to add (can be negative)
 * @returns {string} New date string in YYYY-MM-DD format
 */
export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Adds months to a date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} months - Months to add (can be negative)
 * @returns {string} New date string in YYYY-MM-DD format
 */
export function addMonths(dateStr, months) {
  const date = parseDate(dateStr);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
}

/**
 * Formats a Date object to MM/DD/YYYY string (for Visa API)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDateForApi(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Gets the year from a date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {number} Year as integer
 */
export function getYearFromDate(dateStr) {
  return parseInt(dateStr.substring(0, 4), 10);
}

/**
 * Gets all years that overlap with a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number[]} Array of years
 */
export function getYearsInRange(startDate, endDate) {
  const startYear = getYearFromDate(startDate);
  const endYear = getYearFromDate(endDate);
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

/**
 * Get date range for backfill (latest available date backwards by N days)
 * @param {number} days - Number of days to go back
 * @returns {{ startDate: string, endDate: string }} Date range in YYYY-MM-DD format
 */
export function getDateRange(days) {
	const latestAvailable = getLatestAvailableDate();
	const startDate = formatDate(latestAvailable);

	const endDate = new Date(latestAvailable);
	endDate.setDate(endDate.getDate() - (days - 1));

	return { startDate, endDate: formatDate(endDate) };
}

/**
 * Determine which providers to check based on CLI option
 * @param {string} providerOption - 'all', 'visa', or 'mastercard'
 * @returns {string[]} Array of provider names in uppercase
 */
export function getProvidersToCheck(providerOption) {
  if (providerOption === 'all') {
    return ['VISA', 'MASTERCARD'];
  }
  return [providerOption.toUpperCase()];
}

// ============================================================================
// DATE AVAILABILITY (for API data fetching)
// ============================================================================

/**
 * Gets the latest available date for Visa data in ET timezone
 * If it's past 12pm ET, today's data should be available
 * Otherwise, only yesterday's data is available
 * @returns {Date} Latest available date in ET
 */
export function getLatestAvailableDate() {
  const now = new Date();
  
  // Get current hour in ET
  const etTimeStr = now.toLocaleTimeString('en-US', { 
    timeZone: 'America/New_York', 
    hour12: false, 
    hour: '2-digit' 
  });
  const etHour = parseInt(etTimeStr, 10);
  
  // Get today's date in ET
  const etDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [year, month, day] = etDateStr.split('-').map(Number);
  const etToday = new Date(year, month - 1, day);
  
  // If it's past 12pm ET, today's data is available; otherwise use yesterday
  if (etHour >= 12) {
    etToday.setHours(0, 0, 0, 0);
    return etToday;
  } else {
    etToday.setDate(etToday.getDate() - 1);
    etToday.setHours(0, 0, 0, 0);
    return etToday;
  }
}

/**
 * @deprecated Use getLatestAvailableDate() instead
 * Gets yesterday's date at midnight in ET timezone
 * @returns {Date} Yesterday's date in ET
 */
export function getYesterday() {
  return getLatestAvailableDate();
}

// ============================================================================
// CACHE STALENESS (UTC 12:00 boundary)
// ============================================================================

/**
 * Gets the timestamp of the most recent UTC 12:00pm
 * This is the cache invalidation boundary
 * @returns {number} Unix timestamp in milliseconds
 */
export function getLastUTC12pm() {
  const now = new Date();
  
  // Create UTC 12:00 for today
  const utc12Today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12, 0, 0, 0
  ));
  
  // If we haven't reached 12:00 UTC today, use yesterday's 12:00 UTC
  if (now.getTime() < utc12Today.getTime()) {
    utc12Today.setUTCDate(utc12Today.getUTCDate() - 1);
  }
  
  return utc12Today.getTime();
}

/**
 * Gets the timestamp of the next UTC 12:00pm
 * @returns {number} Unix timestamp in milliseconds
 */
export function getNextUTC12pm() {
  const now = new Date();
  
  // Create UTC 12:00 for today
  const utc12Today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12, 0, 0, 0
  ));
  
  // If we've already passed 12:00 UTC today, use tomorrow's 12:00 UTC
  if (now.getTime() >= utc12Today.getTime()) {
    utc12Today.setUTCDate(utc12Today.getUTCDate() + 1);
  }
  
  return utc12Today.getTime();
}

/**
 * Gets seconds until next UTC 12:00pm
 * @returns {number} Seconds until next refresh boundary
 */
export function getSecondsUntilNextUTC12pm() {
  return Math.floor((getNextUTC12pm() - Date.now()) / 1000);
}

/**
 * Check if a cached timestamp is stale (crossed UTC 12:00 boundary)
 * @param {number} lastRefreshTimestamp - Unix timestamp of last refresh
 * @returns {boolean} True if cache is stale and should be refreshed
 */
export function isCacheStale(lastRefreshTimestamp) {
  return lastRefreshTimestamp < getLastUTC12pm();
}

/**
 * Gets the localStorage key for cache refresh timestamp
 * @param {string} fromCurr - Source currency code
 * @returns {string} localStorage key
 */
export function getCacheTimestampKey(fromCurr) {
  return `forexradar_lastRefresh_${fromCurr}`;
}

/**
 * Stores the current timestamp as last refresh time for a currency
 * @param {string} fromCurr - Source currency code
 */
export function markCacheRefreshed(fromCurr) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getCacheTimestampKey(fromCurr), String(Date.now()));
  }
}

/**
 * Gets the last refresh timestamp for a currency
 * @param {string} fromCurr - Source currency code
 * @returns {number} Unix timestamp, or 0 if never refreshed
 */
export function getLastRefreshTime(fromCurr) {
  if (typeof localStorage === 'undefined') {
    return 0;
  }
  const stored = localStorage.getItem(getCacheTimestampKey(fromCurr));
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Check if data for a source currency needs refresh
 * @param {string} fromCurr - Source currency code
 * @returns {boolean} True if cache is stale
 */
export function needsRefresh(fromCurr) {
  return isCacheStale(getLastRefreshTime(fromCurr));
}

/**
 * Clear all ForexRadar cache timestamps from localStorage
 */
export function clearAllCacheTimestamps() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('forexradar_lastRefresh_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// ============================================================================
// DATE RANGE UTILITIES
// ============================================================================

/**
 * Calculate start and end dates from a DateRange specification
 * @param {import('./types.js').DateRange} range - Date range specification
 * @returns {{ start: string, end: string }} Start and end dates in YYYY-MM-DD format
 */
export function resolveDateRange(range) {
  const today = formatDate(new Date());
  
  if ('all' in range && range.all) {
    // Return a very wide range that will match everything
    return { start: '1990-01-01', end: today };
  }
  
  if ('start' in range && 'end' in range) {
    return { start: range.start, end: range.end };
  }
  
  if ('months' in range && range.months) {
    const start = addMonths(today, -range.months);
    return { start, end: today };
  }
  
  if ('years' in range && range.years) {
    const start = addMonths(today, -range.years * 12);
    return { start, end: today };
  }
  
  // Default: last 1 year
  return { start: addMonths(today, -12), end: today };
}
