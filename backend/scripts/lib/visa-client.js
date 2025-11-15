/**
 * Visa Exchange Rate Client
 * 
 * Fetches exchange rate data from Visa's public FX API.
 * Designed to be extendible for future providers (e.g., MasterCard).
 * 
 * @module visa-client
 */

/**
 * @typedef {Object} RateRecord
 * @property {string} date - Date in "YYYY-MM-DD" format
 * @property {string} from_curr - Source currency code (e.g., "USD")
 * @property {string} to_curr - Target currency code (e.g., "INR")
 * @property {string} provider - Provider name (e.g., "VISA")
 * @property {number} rate - Exchange rate
 * @property {number} markup - Markup percentage as decimal (e.g., 0.002706)
 */

const VISA_API_BASE = 'https://www.visa.co.in/cmsapi/fx/rates';
const PROVIDER_NAME = 'VISA';

/**
 * Formats a Date object to MM/DD/YYYY string for the Visa API
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateForApi(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Formats a Date object to YYYY-MM-DD string for storage
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateForStorage(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetches exchange rate from Visa API for a specific date and currency pair.
 * 
 * IMPORTANT: Due to Visa API quirk, request parameters are flipped.
 * To get rate for A→B, we send from=B&to=A.
 * 
 * @param {Date} date - The date to fetch the rate for
 * @param {string} fromCurr - Source currency code (e.g., "USD")
 * @param {string} toCurr - Target currency code (e.g., "INR")
 * @returns {Promise<RateRecord|null>} Rate record or null if rate unavailable (HTTP 500 = end of history)
 * @throws {Error} If rate limited (HTTP 429/403) or other network error
 */
export async function fetchRate(date, fromCurr, toCurr) {
  const formattedDate = formatDateForApi(date);
  const encodedDate = encodeURIComponent(formattedDate);
  
  // QUIRK: Flip the currencies for the API request
  // To get A→B rate, we request from=B&to=A
  const url = new URL(VISA_API_BASE);
  url.searchParams.set('amount', '1');
  url.searchParams.set('fee', '0');
  url.searchParams.set('utcConvertedDate', formattedDate);
  url.searchParams.set('exchangedate', formattedDate);
  url.searchParams.set('fromCurr', toCurr);  // Flipped
  url.searchParams.set('toCurr', fromCurr);   // Flipped

  try {
    const response = await fetch(url.toString());
    
    // HTTP 500 indicates end of history (dates older than ~1 year)
    if (response.status === 500) {
      return null;
    }
    
    // Rate limiting - throw to allow retry logic upstream
    if (response.status === 429 || response.status === 403) {
      throw new Error(`Rate limited: HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract rate and markup from response
    const rate = data.fxRateVisa;
    const markup = data.markupWithoutAdditionalFee;
    
    if (rate === undefined || rate === null) {
      throw new Error('Invalid response: missing fxRateVisa');
    }
    
    return {
      date: formatDateForStorage(date),
      from_curr: fromCurr,
      to_curr: toCurr,
      provider: PROVIDER_NAME,
      rate: rate,
      markup: markup ?? 0
    };
  } catch (error) {
    // Re-throw rate limit errors
    if (error.message.includes('Rate limited')) {
      throw error;
    }
    
    // Network errors or other fetch failures
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      throw new Error(`Network error: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Fetches multiple days of exchange rate data, iterating backwards from startDate.
 * Stops when hitting HTTP 500 (end of history) or reaching stopDate.
 * 
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @param {Date} startDate - Start date (most recent, works backwards)
 * @param {Date} [stopDate] - Optional stop date (oldest date to fetch)
 * @param {Function} [onProgress] - Optional callback for progress updates (daysProcessed, record)
 * @returns {Promise<RateRecord[]>} Array of rate records sorted by date ASC
 */
export async function fetchDateRange(fromCurr, toCurr, startDate, stopDate = null, onProgress = null) {
  const records = [];
  const currentDate = new Date(startDate);
  
  // Default stop date: 365 days ago (Visa API hard limit)
  const effectiveStopDate = stopDate || new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  let daysProcessed = 0;
  
  while (currentDate >= effectiveStopDate) {
    try {
      const record = await fetchRate(currentDate, fromCurr, toCurr);
      
      if (record === null) {
        // HTTP 500 - end of history reached
        break;
      }
      
      records.push(record);
      daysProcessed++;
      
      if (onProgress) {
        onProgress(daysProcessed, record);
      }
    } catch (error) {
      // Log error but continue with next date
      console.error(`Failed to fetch rate for ${formatDateForStorage(currentDate)}: ${error.message}`);
    }
    
    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Sort by date ascending
  records.sort((a, b) => a.date.localeCompare(b.date));
  
  return records;
}

export { PROVIDER_NAME };
