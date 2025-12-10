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
 * Gets yesterday's date at midnight in ET timezone
 * Visa data is typically available for the previous day in ET
 * @returns {Date} Yesterday's date in ET
 */
export function getYesterday() {
  // Get current time in ET
  const now = new Date();
  const etOptions = { timeZone: 'America/New_York' };
  const etDateStr = now.toLocaleDateString('en-CA', etOptions); // YYYY-MM-DD format
  
  // Parse as local date and subtract one day
  const [year, month, day] = etDateStr.split('-').map(Number);
  const etToday = new Date(year, month - 1, day);
  etToday.setDate(etToday.getDate() - 1);
  etToday.setHours(0, 0, 0, 0);
  return etToday;
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
