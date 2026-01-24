/**
 * Standardized logging utility for ForexRadar
 * @module shared/logger
 */

/**
 * @typedef {Object} Logger
 * @property {(msg: string) => void} info - Log info message
 * @property {(msg: string) => void} warn - Log warning message
 * @property {(msg: string) => void} error - Log error message
 * @property {(msg: string) => void} success - Log success message
 */

/**
 * Create a logger instance with module prefix
 * @param {string} module - Module name for prefix (e.g., 'VISA', 'ECB')
 * @returns {Logger}
 */
export function createLogger(module) {
  return {
    info: (msg) => console.log(`[${module}] ${msg}`),
    warn: (msg) => console.warn(`[${module}] ⚠ ${msg}`),
    error: (msg) => console.error(`[${module}] ✗ ${msg}`),
    success: (msg) => console.log(`[${module}] ✓ ${msg}`),
  };
}
