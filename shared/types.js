/**
 * Shared Type Definitions
 * 
 * Common JSDoc typedefs used across frontend and backend.
 * 
 * @module shared/types
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

/**
 * @typedef {Object} CurrencyPair
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 */

// Export empty object to make this a valid ES module
export {};
