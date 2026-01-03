/**
 * ECB Exchange Rate Client
 * 
 * Fetches historical exchange rate data from the European Central Bank.
 * ECB publishes EUR reference rates against ~30 currencies.
 * 
 * @module ecb-client
 */

import { formatDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').ECBRateData} ECBRateData */

const ECB_BASE_URL = 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html';

/**
 * @param {string} html
 * @param {string} varName - 'chartData' or 'chartDataInverse'
 * @returns {Array<{date: Date, rate: number}>}
 */
function extractRates(html, varName) {
  const regex = new RegExp(
    `${varName}\\.push\\(\\{\\s*date:\\s*new\\s+Date\\((\\d+),(\\d+),(\\d+)\\),\\s*rate:\\s*([\\d.]+)\\s*\\}\\)`,
    'g'
  );
  
  const entries = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const [, year, month, day, rate] = match;
    entries.push({
      date: new Date(parseInt(year), parseInt(month), parseInt(day)),
      rate: parseFloat(rate)
    });
  }
  return entries;
}

/**
 * @param {string} currency
 * @returns {Promise<ECBRateData|null>}
 */
export async function fetchAllRates(currency) {
  const url = `${ECB_BASE_URL}/eurofxref-graph-${currency.toLowerCase()}.en.html`;
  console.log(`[ECB] Fetching ${currency}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[ECB] HTTP ${response.status} for ${currency}`);
      return null;
    }
    
    const html = await response.text();
    const direct = extractRates(html, 'chartData');
    const inverse = extractRates(html, 'chartDataInverse');
    
    if (direct.length === 0 && inverse.length === 0) {
      console.error(`[ECB] No data found for ${currency}`);
      return null;
    }
    
    console.log(`[ECB] Found ${direct.length} EUR→${currency}, ${inverse.length} ${currency}→EUR`);
    
    return {
      eurTo: direct.map(d => ({
        date: formatDate(d.date),
        from_curr: 'EUR',
        to_curr: currency,
        provider: /** @type {const} */ ('ECB'),
        rate: d.rate,
        markup: null
      })),
      toEur: inverse.map(d => ({
        date: formatDate(d.date),
        from_curr: currency,
        to_curr: 'EUR',
        provider: /** @type {const} */ ('ECB'),
        rate: d.rate,
        markup: null
      }))
    };
  } catch (error) {
    console.error(`[ECB] Error fetching ${currency}: ${error.message}`);
    return null;
  }
}
