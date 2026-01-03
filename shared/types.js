/**
 * Shared Type Definitions
 * 
 * Common JSDoc typedefs used across frontend and backend.
 * 
 * @module shared/types
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported exchange rate providers (uppercase, as stored in DB)
 * @typedef {'VISA' | 'MASTERCARD'} Provider
 */

/**
 * Provider option for CLI (lowercase input, includes 'all')
 * @typedef {'visa' | 'mastercard' | 'all'} ProviderOption
 */

// ============================================================================
// Currency Types
// ============================================================================

/**
 * Currency pair for tracking
 * @typedef {Object} CurrencyPair
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 */

// ============================================================================
// Rate Data Types
// ============================================================================

/**
 * Exchange rate record from a provider
 * @typedef {Object} RateRecord
 * @property {string} date - Date in "YYYY-MM-DD" format
 * @property {string} from_curr - Source currency code (e.g., "USD")
 * @property {string} to_curr - Target currency code (e.g., "INR")
 * @property {Provider} provider - Provider name ("VISA" or "MASTERCARD")
 * @property {number} rate - Exchange rate (1 unit of from_curr = rate units of to_curr)
 * @property {number|null} markup - Markup percentage. Only Visa provides this; Mastercard returns null.
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
 * @property {'VISA' | 'MASTERCARD' | null} betterRateProvider - Which provider has the better current rate
 * @property {{start: string|null, end: string|null}} dateRange - Combined date range
 */

// ============================================================================
// UI Types
// ============================================================================

/**
 * Visibility settings for chart series
 * @typedef {Object} SeriesVisibility
 * @property {boolean} visaRate - Whether to show Visa exchange rate line
 * @property {boolean} visaMarkup - Whether to show Visa markup line
 * @property {boolean} mastercardRate - Whether to show Mastercard exchange rate line
 */

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Backfill CLI configuration
 * @typedef {Object} BackfillConfig
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 * @property {ProviderOption} provider - Which provider(s) to fetch from
 * @property {number} parallel - Number of concurrent API requests
 */

/**
 * Mass backfill CLI configuration
 * @typedef {Object} MassBackfillConfig
 * @property {ProviderOption} provider - Which provider(s) to fetch from
 * @property {number} parallel - Number of concurrent API requests
 */

/**
 * Result of a backfill child process
 * @typedef {Object} BackfillResult
 * @property {boolean} success - Whether the backfill completed without errors
 * @property {number|null} exitCode - Process exit code (null if spawn failed)
 */

/**
 * Result counts from backfilling a single provider
 * @typedef {Object} ProviderBackfillResult
 * @property {number} inserted - Number of records inserted
 * @property {number} skipped - Number of records skipped (already existed)
 */

export {};
