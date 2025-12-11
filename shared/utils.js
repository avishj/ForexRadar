/**
 * Shared Utility Functions
 * 
 * Common date and formatting utilities used across frontend and backend.
 * 
 * @module shared/utils
 */

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
