/**
 * Visa Client (Browser)
 * 
 * Fetches exchange rate data from Visa's public FX API.
 * Browser-side version for live fetching of recent data.
 * 
 * @module VisaClient
 */

/**
 * @typedef {Object} RateRecord
 * @property {string} date - Date in "YYYY-MM-DD" format
 * @property {string} from_curr - Source currency code
 * @property {string} to_curr - Target currency code
 * @property {string} provider - Provider name
 * @property {number} rate - Exchange rate
 * @property {number} markup - Markup percentage as decimal
 */

const VISA_API_BASE = 'https://www.visa.co.in/cmsapi/fx/rates';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const PROVIDER_NAME = 'VISA';

/**
 * Formats a Date object to MM/DD/YYYY string for the Visa API
 * @param {Date} date - The date to format
 * @returns {string}
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
 * @returns {string}
 */
export function formatDateForStorage(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to a Date object
 * @param {string} dateStr - Date string
 * @returns {Date}
 */
export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Fetches exchange rate from Visa API for a specific date and currency pair.
 * 
 * @param {Date} date - The date to fetch the rate for
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<RateRecord|null>} Rate record or null if unavailable
 */
export async function fetchRate(date, fromCurr, toCurr) {
  const formattedDate = formatDateForApi(date);
  
  // QUIRK: Flip the currencies for the API request
  const url = new URL(VISA_API_BASE);
  url.searchParams.set('amount', '1');
  url.searchParams.set('fee', '0');
  url.searchParams.set('utcConvertedDate', formattedDate);
  url.searchParams.set('exchangedate', formattedDate);
  url.searchParams.set('fromCurr', toCurr);  // Flipped
  url.searchParams.set('toCurr', fromCurr);  // Flipped

  // Use CORS proxy to bypass browser restrictions
  const proxyUrl = CORS_PROXY + encodeURIComponent(url.toString());

  try {
    const response = await fetch(proxyUrl);
    
    // HTTP 500 indicates end of history
    if (response.status === 500) {
      return null;
    }
    
    if (response.status === 429 || response.status === 403) {
      throw new Error(`Rate limited: HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
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
    if (error.message.includes('Rate limited')) {
      throw error;
    }
    
    // Network errors
    if (error.name === 'TypeError') {
      throw new Error(`Network error: ${error.message}`);
    }
    
    throw error;
  }
}

export { PROVIDER_NAME };
