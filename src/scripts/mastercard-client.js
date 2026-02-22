/**
 * Mastercard Client (Browser)
 * 
 * Fetches exchange rate data from Mastercard's settlement rate API.
 * Browser-side version for live fetching of recent data.
 * 
 * Key differences from Visa:
 * - Mastercard does NOT provide markup information
 * - API returns error in JSON body (not HTTP error codes) for out-of-range dates
 * 
 * @module mastercard-client
 */

import { formatDate } from '../../shared/utils.js';
import { LIVE_FETCH_TIMEOUT_MS } from '../../shared/constants.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */

const MASTERCARD_API_BASE = 'https://www.mastercard.co.in/settlement/currencyrate/conversion-rate';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const PROVIDER_NAME = 'MASTERCARD';

/**
 * Checks if the API response indicates an error (out of range, bad request, etc.)
 * Mastercard returns HTTP 200 with error payload instead of HTTP error codes.
 * 
 * @param {{ type?: string, data?: { errorCode?: string, errorMessage?: string, conversionRate?: number } }} data - Parsed JSON response
 * @returns {{isError: boolean, message: string|null, isEndOfHistory: boolean}}
 */
function checkForApiError(data) {
  // Check for error type response
  if (data.type === 'error' || data.data?.errorCode) {
    const errorMessage = data.data?.errorMessage || 'Unknown error';
    const errorCode = data.data?.errorCode || '';
    
    // Check if this is the "end of history" error
    const isEndOfHistory = errorMessage.toLowerCase().includes('outside of approved historical rate range');
    
    return {
      isError: true,
      message: `${errorCode}: ${errorMessage}`,
      isEndOfHistory
    };
  }
  
  return { isError: false, message: null, isEndOfHistory: false };
}

/**
 * Fetches exchange rate from Mastercard API for a specific date and currency pair.
 * 
 * @param {Date} date - The date to fetch the rate for
 * @param {CurrencyCode} fromCurr - Source currency code
 * @param {CurrencyCode} toCurr - Target currency code
 * @returns {Promise<RateRecord|null>} Rate record or null if unavailable (end of history)
 */
export async function fetchRate(date, fromCurr, toCurr) {
  const formattedDate = formatDate(date);
  
  // Build the URL with query parameters
  // transCurr = source currency (what you're converting FROM)
  // crdhldBillCurr = target currency (what you're converting TO / billing currency)
  const url = new URL(MASTERCARD_API_BASE);
  url.searchParams.set('fxDate', formattedDate);
  url.searchParams.set('transCurr', fromCurr);
  url.searchParams.set('crdhldBillCurr', toCurr);
  url.searchParams.set('bankFee', '0');
  url.searchParams.set('transAmt', '1');

  // Use CORS proxy to bypass browser restrictions
  const proxyUrl = CORS_PROXY + encodeURIComponent(url.toString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Handle HTTP-level errors
    if (response.status === 429 || response.status === 403) {
      throw new Error(`Rate limited: HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API-level errors (Mastercard returns 200 with error in body)
    const errorCheck = checkForApiError(data);
    if (errorCheck.isError) {
      if (errorCheck.isEndOfHistory) {
        return null;
      }
      throw new Error(`Mastercard API error: ${errorCheck.message}`);
    }
    
    // Extract conversion rate from response
    // Response structure: { data: { conversionRate: 89.921, ... } }
    const conversionRate = data.data?.conversionRate;
    
    if (conversionRate === undefined || conversionRate === null) {
      throw new Error('Invalid response: missing conversionRate');
    }
    
    /** @type {RateRecord} */
    return {
      date: formatDate(date),
      from_curr: fromCurr,
      to_curr: toCurr,
      provider: PROVIDER_NAME,
      rate: parseFloat(conversionRate),
      markup: null // Mastercard does not provide markup information
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
