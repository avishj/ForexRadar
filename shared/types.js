/**
 * Shared Type Definitions
 * 
 * Common JSDoc typedefs used across frontend and backend.
 * 
 * @module shared/types
 */

/**
 * Supported exchange rate providers
 * @typedef {'VISA' | 'MASTERCARD'} Provider
 */

/**
 * Exchange rate record from a provider
 * 
 * @typedef {Object} RateRecord
 * @property {string} date - Date in "YYYY-MM-DD" format
 * @property {string} from_curr - Source currency code (e.g., "USD")
 * @property {string} to_curr - Target currency code (e.g., "INR")
 * @property {Provider} provider - Provider name ("VISA" or "MASTERCARD")
 * @property {number} rate - Exchange rate (1 unit of from_curr = rate units of to_curr)
 * @property {number|null} markup - Markup percentage (e.g., 0.5 = 0.5%). 
 *                                   Only Visa provides this; Mastercard returns null.
 */

/**
 * Currency pair for tracking
 * @typedef {Object} CurrencyPair
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 */

/**
 * Statistics calculated from rate records
 * @typedef {Object} RateStats
 * @property {number|null} high - Highest rate in the period
 * @property {number|null} low - Lowest rate in the period
 * @property {number|null} current - Most recent rate
 * @property {number|null} avgMarkup - Average Visa markup (null if no Visa data)
 * @property {{start: string|null, end: string|null}} dateRange - Date range of data
 */

/**
 * Statistics for multi-provider data
 * @typedef {Object} MultiProviderStats
 * @property {RateStats} visa - Visa-specific statistics
 * @property {RateStats} mastercard - Mastercard-specific statistics
 * @property {number|null} avgSpread - Average rate difference (MC - Visa) across matching dates
 * @property {number|null} currentSpread - Current rate difference (MC - Visa)
 * @property {'VISA' | 'MASTERCARD' | null} betterRateProvider - Which provider has the better current rate (lower is better for buyer)
 * @property {{start: string|null, end: string|null}} dateRange - Combined date range
 */

/**
 * Visibility settings for chart series
 * @typedef {Object} SeriesVisibility
 * @property {boolean} visaRate - Whether to show Visa exchange rate line
 * @property {boolean} visaMarkup - Whether to show Visa markup line
 * @property {boolean} mastercardRate - Whether to show Mastercard exchange rate line
 */

// Export empty object to make this a valid ES module
export {};
