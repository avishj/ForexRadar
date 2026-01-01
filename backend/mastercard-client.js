/**
 * Mastercard Exchange Rate Client
 * 
 * Fetches exchange rate data from Mastercard's public settlement rate API
 * using Playwright to bypass potential Cloudflare protection.
 * 
 * Key differences from Visa:
 * - Mastercard does NOT provide markup information
 * - API returns error in JSON body (not HTTP 500) for out-of-range dates
 * - Date format is YYYY-MM-DD (same as Visa)
 * 
 * @module mastercard-client
 */

import { chromium } from 'playwright';
import { formatDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

const MASTERCARD_API_BASE = 'https://www.mastercard.co.in/settlement/currencyrate/conversion-rate';
const MASTERCARD_UI_PAGE = 'https://www.mastercard.co.in/content/mastercardcom/global/en/personal/get-support/convert-currency.html';
const PROVIDER_NAME = 'MASTERCARD';

// Reusable browser instance for efficiency
let browserInstance = null;
let browserContext = null;
let browserInitPromise = null;

/**
 * Gets or creates a shared browser instance (race-condition safe)
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext}>}
 */
async function getBrowser() {
  if (browserInstance) {
    return { browser: browserInstance, context: browserContext };
  }
  
  // If already initializing, wait for that promise
  if (browserInitPromise) {
    return browserInitPromise;
  }
  
  // Start initialization
  browserInitPromise = (async () => {
    console.log('[MASTERCARD] Launching Chromium browser...');
    browserInstance = await chromium.launch({ 
      headless: false,  // Akamai bot detection blocks headless mode
      args: [
        '--disable-blink-features=AutomationControlled'
      ]
    });
    browserContext = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-GB',
      extraHTTPHeaders: {
        'Accept-Language': 'en-GB,en;q=0.9',
        'DNT': '1',
        'Sec-GPC': '1'
      }
    });
    
    // Visit UI page first to establish session (required for Akamai)
    console.log('[MASTERCARD] Visiting UI page...');
    const initPage = await browserContext.newPage();
    try {
      await initPage.goto(MASTERCARD_UI_PAGE, { waitUntil: 'networkidle', timeout: 30000 });
      // Keep this page open to maintain the session
    } catch (error) {
      console.warn('[MASTERCARD] Failed to load UI page:', error.message);
      await initPage.close();
    }
    
    return { browser: browserInstance, context: browserContext };
  })();
  
  return browserInitPromise;
}

/**
 * Closes the shared browser instance (call when done with all fetches)
 */
export async function closeBrowser() {
  if (browserInstance) {
    console.log('[MASTERCARD] Closing browser...');
    await browserInstance.close();
    browserInstance = null;
    browserContext = null;
    browserInitPromise = null;
  }
}

/**
 * Formats a Date object to Mastercard API date format (YYYY-MM-DD)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateForMastercardApi(date) {
  return formatDate(date); // Same format as our internal format
}

/**
 * Checks if the API response indicates an error (out of range, bad request, etc.)
 * Mastercard returns HTTP 200 with error payload instead of HTTP error codes.
 * 
 * @param {object} data - Parsed JSON response
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
 * Uses Playwright to bypass potential Cloudflare JS challenge.
 * 
 * @param {Date} date - The date to fetch the rate for
 * @param {string} fromCurr - Source currency code (e.g., "USD")
 * @param {string} toCurr - Target currency code (e.g., "INR")
 * @returns {Promise<RateRecord|null>} Rate record or null if rate unavailable (end of history)
 * @throws {Error} If rate limited (HTTP 429/403) or other network error
 */
export async function fetchRate(date, fromCurr, toCurr) {
  const formattedDate = formatDateForMastercardApi(date);
  
  // Build the URL with query parameters
  // transCurr = source currency (what you're converting FROM)
  // crdhldBillCurr = target currency (what you're converting TO / billing currency)
  const url = new URL(MASTERCARD_API_BASE);
  url.searchParams.set('fxDate', formattedDate);
  url.searchParams.set('transCurr', fromCurr);
  url.searchParams.set('crdhldBillCurr', toCurr);
  url.searchParams.set('bankFee', '0');
  url.searchParams.set('transAmt', '1');

  const urlStr = url.toString();
  console.log(`[MASTERCARD] Request -> ${urlStr}`);

  try {
    const { context } = await getBrowser();
    
    // Create a new page for the API request
    const page = await context.newPage();
    
    // Navigate directly to the API URL (like opening in a new tab)
    const response = await page.goto(urlStr, { waitUntil: 'networkidle', timeout: 30000 });
    
    const apiStatus = response.status();
    console.log(`[MASTERCARD] Response status -> ${apiStatus}`);
    
    // Get the response body (the page content will be the JSON response)
    const apiResponse = await page.content();
    
    await page.close();

    // Handle HTTP errors
    if (apiStatus === 429 || apiStatus === 403) {
      console.error(`[MASTERCARD] Rate limited or forbidden. HTTP ${apiStatus}`);
      throw new Error(`Rate limited: HTTP ${apiStatus}`);
    }

    if (apiStatus !== 200) {
      throw new Error(`HTTP error: ${apiStatus}`);
    }

    // Parse the JSON response (extract from HTML wrapper if needed)
    let data;
    try {
      let jsonText = apiResponse;
      // Extract JSON from <pre> tag if wrapped in HTML
      // Look for <pre> first (innermost), fallback to <body>
      let match = apiResponse.match(/<pre[^>]*>(.*?)<\/pre>/is);
      if (match) {
        jsonText = match[1].trim();
      } else {
        // Fallback to <body> if no <pre> tag
        match = apiResponse.match(/<body[^>]*>(.*?)<\/body>/is);
        if (match) {
          jsonText = match[1].trim();
        }
      }
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error('[MASTERCARD] Failed to parse JSON:', apiResponse.substring(0, 200));
      throw new Error('Invalid JSON response from Mastercard API');
    }
    
    // Check for API-level errors (Mastercard returns 200 with error in body)
    const errorCheck = checkForApiError(data);
    if (errorCheck.isError) {
      if (errorCheck.isEndOfHistory) {
        console.log(`[MASTERCARD] End of history reached for ${formattedDate}`);
        return null;
      }
      throw new Error(`Mastercard API error: ${errorCheck.message}`);
    }
    
    // Extract conversion rate from response
    // Response structure: { data: { conversionRate: 89.921, ... } }
    const conversionRate = data.data?.conversionRate;
    
    if (conversionRate === undefined || conversionRate === null) {
      console.error('[MASTERCARD] Invalid response payload:', data);
      throw new Error('Invalid response: missing conversionRate');
    }
    
    /** @type {RateRecord} */
    const record = {
      date: formatDate(date),
      from_curr: fromCurr,
      to_curr: toCurr,
      provider: PROVIDER_NAME,
      rate: parseFloat(conversionRate),
      markup: null // Mastercard does not provide markup information
    };

    console.log(`[MASTERCARD] Fetched rate for ${record.date} ${fromCurr}/${toCurr} -> ${record.rate}`);
    return record;
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
 * Stops when hitting end of history (error response) or reaching stopDate.
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
  
  // Default stop date: 365 days ago
  const effectiveStopDate = stopDate || new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  let daysProcessed = 0;
  
  while (currentDate >= effectiveStopDate) {
    try {
      const record = await fetchRate(currentDate, fromCurr, toCurr);
      
      if (record === null) {
        // End of history reached
        break;
      }
      
      records.push(record);
      daysProcessed++;
      
      if (onProgress) {
        onProgress(daysProcessed, record);
      }
    } catch (error) {
      // Log error but continue with next date
      console.error(`Failed to fetch rate for ${formatDate(currentDate)}: ${error.message}`);
    }
    
    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Sort by date ascending
  records.sort((a, b) => a.date.localeCompare(b.date));
  
  return records;
}

export { PROVIDER_NAME };
