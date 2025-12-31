/**
 * Visa Exchange Rate Client
 * 
 * Fetches exchange rate data from Visa's public FX API using Playwright
 * to bypass Cloudflare protection.
 * Designed to be extendible for future providers (e.g., MasterCard).
 * 
 * @module visa-client
 */

import { firefox } from 'playwright';
import { formatDate, formatDateForApi } from '../../../shared/utils.js';

/** @typedef {import('../../../shared/types.js').RateRecord} RateRecord */

const VISA_API_BASE = 'https://www.visa.co.in/cmsapi/fx/rates';
const PROVIDER_NAME = 'VISA';

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
    console.log('[VISA] Launching headless Firefox browser...');
    browserInstance = await firefox.launch({ headless: true });
    browserContext = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    return { browser: browserInstance, context: browserContext };
  })();
  
  return browserInitPromise;
}

/**
 * Closes the shared browser instance (call when done with all fetches)
 */
export async function closeBrowser() {
  if (browserInstance) {
    console.log('[VISA] Closing browser...');
    await browserInstance.close();
    browserInstance = null;
    browserContext = null;
    browserInitPromise = null;
  }
}

/**
 * Fetches exchange rate from Visa API for a specific date and currency pair.
 * Uses Playwright to bypass Cloudflare JS challenge.
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
  
  // QUIRK: Flip the currencies for the API request
  // To get A→B rate, we request from=B&to=A
  const url = new URL(VISA_API_BASE);
  url.searchParams.set('amount', '1');
  url.searchParams.set('fee', '0');
  url.searchParams.set('utcConvertedDate', formattedDate);
  url.searchParams.set('exchangedate', formattedDate);
  url.searchParams.set('fromCurr', toCurr);  // Flipped
  url.searchParams.set('toCurr', fromCurr);   // Flipped

  const urlStr = url.toString();
  console.log(`[VISA] Request -> ${urlStr}`);

  try {
    const { context } = await getBrowser();
    const page = await context.newPage();

    let apiResponse = null;
    let apiStatus = null;

    // Intercept the API response
    page.on('response', async (response) => {
      if (response.url().includes('/cmsapi/fx/rates')) {
        apiStatus = response.status();
        try {
          apiResponse = await response.text();
        } catch (e) {
          // Response body may not be available
        }
      }
    });

    // Navigate to the URL and wait for network to settle
    await page.goto(urlStr, { waitUntil: 'networkidle', timeout: 30000 });

    // Give Cloudflare challenge a moment if needed
    if (!apiResponse) {
      await page.waitForTimeout(3000);
    }

    await page.close();

    console.log(`[VISA] Response status -> ${apiStatus}`);

    // HTTP 500 indicates end of history (dates older than ~1 year)
    if (apiStatus === 500) {
      return null;
    }

    // Handle errors
    if (!apiResponse || apiStatus !== 200) {
      if (apiStatus === 429 || apiStatus === 403) {
        console.error(`[VISA] Rate limited or forbidden. HTTP ${apiStatus}`);
        throw new Error(`Rate limited: HTTP ${apiStatus}`);
      }
      throw new Error(`HTTP error: ${apiStatus}`);
    }

    // Parse the JSON response
    let data;
    try {
      data = JSON.parse(apiResponse);
    } catch (e) {
      console.error('[VISA] Failed to parse JSON:', apiResponse.substring(0, 200));
      throw new Error('Invalid JSON response from Visa API');
    }
    
    // Extract rate and markup from response (nested in originalValues)
    const rate = data.originalValues?.fxRateVisa;
    const markup = data.benchMarkAmount || 0;
    
    if (rate === undefined || rate === null) {
      console.error('[VISA] Invalid response payload:', data);
      throw new Error('Invalid response: missing fxRateVisa');
    }
    
    const record = {
      date: formatDate(date),
      from_curr: fromCurr,
      to_curr: toCurr,
      provider: PROVIDER_NAME,
      rate: parseFloat(rate),
      markup: parseFloat(markup)
    };

    console.log(`[VISA] Fetched rate for ${record.date} ${fromCurr}/${toCurr} -> ${record.rate}`);
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
