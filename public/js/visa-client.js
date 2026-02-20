/**
 * Visa Client (Browser)
 * 
 * Fetches exchange rate data from Visa's public FX API.
 * Browser-side version for live fetching of recent data.
 * 
 * @module visa-client
 */

import { formatDate, formatDateForApi } from '../shared/utils.js';
import { LIVE_FETCH_TIMEOUT_MS } from '../shared/constants.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */

const VISA_API_BASE = 'https://www.visa.co.in/cmsapi/fx/rates';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const PROVIDER_NAME = 'VISA';

/**
 * Fetches exchange rate from Visa API for a specific date and currency pair.
 * 
 * @param {Date} date - The date to fetch the rate for
 * @param {CurrencyCode} fromCurr - Source currency code
 * @param {CurrencyCode} toCurr - Target currency code
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
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
    
    // Extract rate from originalValues object
    const originalValues = data.originalValues;
    if (!originalValues) {
      throw new Error('Invalid response: missing originalValues');
    }
    
    const rate = parseFloat(originalValues.fxRateVisa);
    const benchmark = originalValues.benchmarks?.[0];
    const markup = benchmark ? parseFloat(benchmark.markupWithoutAdditionalFee) : 0;
    
    if (isNaN(rate)) {
      throw new Error('Invalid response: missing fxRateVisa');
    }
    
    return {
      date: formatDate(date),
      from_curr: fromCurr,
      to_curr: toCurr,
      provider: PROVIDER_NAME,
      rate: rate,
      markup: markup ?? 0
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout', { cause: error });
    }
    
    if (error.message.includes('Rate limited')) {
      throw error;
    }
    
    // Network errors
    if (error.name === 'TypeError') {
      throw new Error(`Network error: ${error.message}`, { cause: error });
    }
    
    throw error;
  }
}

export { PROVIDER_NAME };
