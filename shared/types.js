/**
 * Shared Type Definitions
 * @module shared/types
 */

/** @typedef {'VISA' | 'MASTERCARD'} Provider */
/** @typedef {'visa' | 'mastercard' | 'all'} ProviderOption */

/**
 * @typedef {Object} CurrencyPair
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {Object} RateRecord
 * @property {string} date - YYYY-MM-DD format
 * @property {string} from_curr
 * @property {string} to_curr
 * @property {Provider} provider
 * @property {number} rate
 * @property {number|null} markup - Only Visa provides this
 */

/**
 * @typedef {Object} RateStats
 * @property {number|null} high
 * @property {number|null} low
 * @property {number|null} current
 * @property {number|null} avgMarkup
 * @property {{start: string|null, end: string|null}} dateRange
 */

/**
 * @typedef {Object} MultiProviderStats
 * @property {RateStats} visa
 * @property {RateStats} mastercard
 * @property {number|null} avgSpread
 * @property {number|null} currentSpread
 * @property {Provider|null} betterRateProvider
 * @property {{start: string|null, end: string|null}} dateRange
 */

/**
 * @typedef {Object} SeriesVisibility
 * @property {boolean} visaRate
 * @property {boolean} visaMarkup
 * @property {boolean} mastercardRate
 */

/**
 * @typedef {Object} BackfillConfig
 * @property {string} from
 * @property {string} to
 * @property {ProviderOption} provider
 * @property {number} parallel
 * @property {number} days
 */

/**
 * @typedef {Object} MassBackfillConfig
 * @property {ProviderOption} provider
 * @property {number} parallel
 * @property {number} days
 */

/**
 * @typedef {Object} BackfillResult
 * @property {boolean} success
 * @property {number|null} exitCode
 */

/**
 * @typedef {Object} ProviderBackfillResult
 * @property {number} inserted
 * @property {number} skipped
 */

export {};
