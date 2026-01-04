/**
 * Shared Type Definitions
 * 
 * Central type definitions for the ForexRadar application.
 * Includes providers, currencies, rate records, and related types.
 * 
 * @module shared/types
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

/**
 * Data providers that supply exchange rates
 * @typedef {'VISA' | 'MASTERCARD' | 'ECB'} Provider
 */

/**
 * Provider values as a frozen object for runtime validation
 * @type {Readonly<{VISA: 'VISA', MASTERCARD: 'MASTERCARD', ECB: 'ECB'}>}
 */
export const Provider = Object.freeze({
  VISA: 'VISA',
  MASTERCARD: 'MASTERCARD',
  ECB: 'ECB'
});

/**
 * List of all valid provider values
 * @type {readonly Provider[]}
 */
export const PROVIDERS = Object.freeze(/** @type {Provider[]} */ (Object.values(Provider)));

/**
 * Check if a string is a valid Provider
 * @param {string} value
 * @returns {value is Provider}
 */
export function isProvider(value) {
  return PROVIDERS.includes(/** @type {Provider} */ (value));
}

// ============================================================================
// CURRENCY TYPES
// ============================================================================

/**
 * ISO 4217 currency codes supported by the application
 * @typedef {'AFN' | 'ALL' | 'DZD' | 'AOA' | 'ARS' | 'AMD' | 'AWG' | 'AUD' | 
 *           'AZN' | 'BSD' | 'BHD' | 'BDT' | 'BBD' | 'BYN' | 'BZD' | 'BMD' | 
 *           'BTN' | 'BOB' | 'BAM' | 'BWP' | 'BRL' | 'BND' | 'BGN' | 'BIF' | 
 *           'KHR' | 'CAD' | 'CVE' | 'KYD' | 'XOF' | 'XAF' | 'XPF' | 'CLP' | 
 *           'CNY' | 'COP' | 'KMF' | 'CDF' | 'CRC' | 'CUP' | 'CZK' | 'DKK' | 
 *           'DJF' | 'DOP' | 'XCD' | 'EGP' | 'SVC' | 'ETB' | 'EUR' | 'FKP' | 
 *           'FJD' | 'GMD' | 'GEL' | 'GHS' | 'GIP' | 'GBP' | 'GTQ' | 'GNF' | 
 *           'GYD' | 'HTG' | 'HNL' | 'HKD' | 'HUF' | 'ISK' | 'INR' | 'IDR' | 
 *           'IQD' | 'ILS' | 'JMD' | 'JPY' | 'JOD' | 'KZT' | 'KES' | 'KWD' | 
 *           'KGS' | 'LAK' | 'LBP' | 'LSL' | 'LRD' | 'LYD' | 'MOP' | 'MKD' | 
 *           'MGA' | 'MWK' | 'MYR' | 'MVR' | 'MRU' | 'MUR' | 'MXN' | 'MDL' | 
 *           'MNT' | 'MAD' | 'MZN' | 'MMK' | 'NAD' | 'NPR' | 'ANG' | 'NZD' | 
 *           'NIO' | 'NGN' | 'NOK' | 'OMR' | 'PKR' | 'PAB' | 'PGK' | 'PYG' | 
 *           'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RON' | 'RUB' | 'RWF' | 'SHP' | 
 *           'WST' | 'STN' | 'SAR' | 'RSD' | 'SCR' | 'SLE' | 'SGD' | 'SBD' | 
 *           'SOS' | 'ZAR' | 'KRW' | 'SSP' | 'LKR' | 'SDG' | 'SRD' | 'SZL' | 
 *           'SEK' | 'CHF' | 'TWD' | 'TJS' | 'TZS' | 'THB' | 'TOP' | 'TTD' | 
 *           'TND' | 'TRY' | 'TMT' | 'UGX' | 'UAH' | 'AED' | 'USD' | 'UYU' | 
 *           'UZS' | 'VUV' | 'VES' | 'VND' | 'YER' | 'ZMW' | 'ZWG'} CurrencyCode
 */

/**
 * Currency information with code and display name
 * @typedef {Object} CurrencyInfo
 * @property {CurrencyCode} code - ISO 4217 currency code
 * @property {string} name - Human-readable currency name
 */

/**
 * All supported currencies with their codes and names
 * @type {Readonly<Record<CurrencyCode, CurrencyInfo>>}
 */
export const CURRENCIES = Object.freeze(/** @type {Record<CurrencyCode, CurrencyInfo>} */ ({
  AFN: { code: 'AFN', name: 'Afghanistan Afghani' },
  ALL: { code: 'ALL', name: 'Albanian Lek' },
  DZD: { code: 'DZD', name: 'Algerian Dinar' },
  AOA: { code: 'AOA', name: 'Angolan Kwanza' },
  ARS: { code: 'ARS', name: 'Argentine Peso' },
  AMD: { code: 'AMD', name: 'Armenian Dram' },
  AWG: { code: 'AWG', name: 'Aruban Guilder' },
  AUD: { code: 'AUD', name: 'Australian Dollar' },
  AZN: { code: 'AZN', name: 'Azerbaijan Manat' },
  BSD: { code: 'BSD', name: 'Bahamian Dollar' },
  BHD: { code: 'BHD', name: 'Bahrain Dinar' },
  BDT: { code: 'BDT', name: 'Bangladesh Taka' },
  BBD: { code: 'BBD', name: 'Barbados Dollar' },
  BYN: { code: 'BYN', name: 'Belarussian Ruble' },
  BZD: { code: 'BZD', name: 'Belize Dollar' },
  BMD: { code: 'BMD', name: 'Bermudan Dollar' },
  BTN: { code: 'BTN', name: 'Bhutanese Ngultrum' },
  BOB: { code: 'BOB', name: 'Bolivian Boliviano' },
  BAM: { code: 'BAM', name: 'Bosnian Convertible Mark' },
  BWP: { code: 'BWP', name: 'Botswana Pula' },
  BRL: { code: 'BRL', name: 'Brazilian Real' },
  BND: { code: 'BND', name: 'Brunei Dollar' },
  BGN: { code: 'BGN', name: 'Bulgarian Lev' },
  BIF: { code: 'BIF', name: 'Burundi Franc' },
  KHR: { code: 'KHR', name: 'Cambodian Riel' },
  CAD: { code: 'CAD', name: 'Canadian Dollar' },
  CVE: { code: 'CVE', name: 'Cape Verde Escudo' },
  KYD: { code: 'KYD', name: 'Cayman Island Dollar' },
  XOF: { code: 'XOF', name: 'CFA Franc BCEAO' },
  XAF: { code: 'XAF', name: 'CFA Franc BEAC' },
  XPF: { code: 'XPF', name: 'CFP Franc' },
  CLP: { code: 'CLP', name: 'Chilean Peso' },
  CNY: { code: 'CNY', name: 'China Yuan Renminbi' },
  COP: { code: 'COP', name: 'Colombian Peso' },
  KMF: { code: 'KMF', name: 'Comoros Franc' },
  CDF: { code: 'CDF', name: 'Congolese Franc' },
  CRC: { code: 'CRC', name: 'Costa Rica Colon' },
  CUP: { code: 'CUP', name: 'Cuban Peso' },
  CZK: { code: 'CZK', name: 'Czech Koruna' },
  DKK: { code: 'DKK', name: 'Danish Krone' },
  DJF: { code: 'DJF', name: 'Djibouti Franc' },
  DOP: { code: 'DOP', name: 'Dominican Peso' },
  XCD: { code: 'XCD', name: 'East Caribbean Dollar' },
  EGP: { code: 'EGP', name: 'Egyptian Pound' },
  SVC: { code: 'SVC', name: 'El Salvador Colon' },
  ETB: { code: 'ETB', name: 'Ethiopia Birr' },
  EUR: { code: 'EUR', name: 'Euro' },
  FKP: { code: 'FKP', name: 'Falkland Island Pound' },
  FJD: { code: 'FJD', name: 'Fiji Dollar' },
  GMD: { code: 'GMD', name: 'Gambia Dalasi' },
  GEL: { code: 'GEL', name: 'Georgian Lari' },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi' },
  GIP: { code: 'GIP', name: 'Gibraltar Pound' },
  GBP: { code: 'GBP', name: 'Great British Pound' },
  GTQ: { code: 'GTQ', name: 'Guatemala Quetzal' },
  GNF: { code: 'GNF', name: 'Guinea Franc' },
  GYD: { code: 'GYD', name: 'Guyana Dollar' },
  HTG: { code: 'HTG', name: 'Haiti Gourde' },
  HNL: { code: 'HNL', name: 'Honduras Lempira' },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar' },
  HUF: { code: 'HUF', name: 'Hungarian Forint' },
  ISK: { code: 'ISK', name: 'Icelandic Krona' },
  INR: { code: 'INR', name: 'Indian Rupee' },
  IDR: { code: 'IDR', name: 'Indonesian Rupiah' },
  IQD: { code: 'IQD', name: 'Iraq Dinar' },
  ILS: { code: 'ILS', name: 'Israeli Sheqel' },
  JMD: { code: 'JMD', name: 'Jamaican Dollar' },
  JPY: { code: 'JPY', name: 'Japanese Yen' },
  JOD: { code: 'JOD', name: 'Jordan Dinar' },
  KZT: { code: 'KZT', name: 'Kazakhstan Tenge' },
  KES: { code: 'KES', name: 'Kenyan Shilling' },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar' },
  KGS: { code: 'KGS', name: 'Kyrgyzstan Som' },
  LAK: { code: 'LAK', name: 'Laotian Kip' },
  LBP: { code: 'LBP', name: 'Lebanese Pound' },
  LSL: { code: 'LSL', name: 'Lesotho Loti' },
  LRD: { code: 'LRD', name: 'Liberian Dollar' },
  LYD: { code: 'LYD', name: 'Libya Dinar' },
  MOP: { code: 'MOP', name: 'Macau Pataca' },
  MKD: { code: 'MKD', name: 'Macedonia Denar' },
  MGA: { code: 'MGA', name: 'Malagascy Ariary' },
  MWK: { code: 'MWK', name: 'Malawi Kwacha' },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit' },
  MVR: { code: 'MVR', name: 'Maldive Rufiyaa' },
  MRU: { code: 'MRU', name: 'Mauritania Ouguiya' },
  MUR: { code: 'MUR', name: 'Mauritian Rupee' },
  MXN: { code: 'MXN', name: 'Mexican Peso' },
  MDL: { code: 'MDL', name: 'Moldova Leu' },
  MNT: { code: 'MNT', name: 'Mongolia Tugrik' },
  MAD: { code: 'MAD', name: 'Moroccan Dirham' },
  MZN: { code: 'MZN', name: 'Mozambique Metical' },
  MMK: { code: 'MMK', name: 'Myanmar Kyat' },
  NAD: { code: 'NAD', name: 'Namibia Dollar' },
  NPR: { code: 'NPR', name: 'Nepalese Rupee' },
  ANG: { code: 'ANG', name: 'Netherland Antille Guilder' },
  NZD: { code: 'NZD', name: 'New Zealand Dollar' },
  NIO: { code: 'NIO', name: 'Nicaragua Cordoba Oro' },
  NGN: { code: 'NGN', name: 'Nigerian Naira' },
  NOK: { code: 'NOK', name: 'Norwegian Krone' },
  OMR: { code: 'OMR', name: 'Oman Rial' },
  PKR: { code: 'PKR', name: 'Pakistani Rupee' },
  PAB: { code: 'PAB', name: 'Panama Balboa' },
  PGK: { code: 'PGK', name: 'Papua New Guinea Kina' },
  PYG: { code: 'PYG', name: 'Paraguay Guarani' },
  PEN: { code: 'PEN', name: 'Peru Nuevo Sol' },
  PHP: { code: 'PHP', name: 'Philippine Peso' },
  PLN: { code: 'PLN', name: 'Polish Zloty' },
  QAR: { code: 'QAR', name: 'Qatar Rial' },
  RON: { code: 'RON', name: 'Romanian Leu' },
  RUB: { code: 'RUB', name: 'Russian Ruble' },
  RWF: { code: 'RWF', name: 'Rwanda Franc' },
  SHP: { code: 'SHP', name: 'Saint Helena Pound' },
  WST: { code: 'WST', name: 'Samoa Tala' },
  STN: { code: 'STN', name: 'Sao Tome and Principe Dobra' },
  SAR: { code: 'SAR', name: 'Saudi Arabia Riyal' },
  RSD: { code: 'RSD', name: 'Serbian Dinar' },
  SCR: { code: 'SCR', name: 'Seychelles Rupee' },
  SLE: { code: 'SLE', name: 'Sierra Leone' },
  SGD: { code: 'SGD', name: 'Singapore Dollar' },
  SBD: { code: 'SBD', name: 'Solomon Island Dollar' },
  SOS: { code: 'SOS', name: 'Somali Shilling' },
  ZAR: { code: 'ZAR', name: 'South African Rand' },
  KRW: { code: 'KRW', name: 'South Korean Won' },
  SSP: { code: 'SSP', name: 'South Sudan Pound' },
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee' },
  SDG: { code: 'SDG', name: 'Sudanese Pound' },
  SRD: { code: 'SRD', name: 'Suriname Dollar' },
  SZL: { code: 'SZL', name: 'Swaziland Lilangeni' },
  SEK: { code: 'SEK', name: 'Swedish Krona' },
  CHF: { code: 'CHF', name: 'Swiss Franc' },
  TWD: { code: 'TWD', name: 'Taiwan Dollar' },
  TJS: { code: 'TJS', name: 'Tajikistan Somoni' },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling' },
  THB: { code: 'THB', name: 'Thai Baht' },
  TOP: { code: 'TOP', name: 'Tonga Paanga' },
  TTD: { code: 'TTD', name: 'Trinidad and Tobago Dollar' },
  TND: { code: 'TND', name: 'Tunisian Dinar' },
  TRY: { code: 'TRY', name: 'Turkish Lira' },
  TMT: { code: 'TMT', name: 'Turkmenistan Manat' },
  UGX: { code: 'UGX', name: 'Uganda Shilling' },
  UAH: { code: 'UAH', name: 'Ukrainian Hryvnia' },
  AED: { code: 'AED', name: 'United Arab Emirates Dirham' },
  USD: { code: 'USD', name: 'United States Dollar' },
  UYU: { code: 'UYU', name: 'Uruguay Peso' },
  UZS: { code: 'UZS', name: 'Uzbekistan Sum' },
  VUV: { code: 'VUV', name: 'Vanuatu Vatu' },
  VES: { code: 'VES', name: 'Venezuelan Bolivar Soberano' },
  VND: { code: 'VND', name: 'Vietnam Dong' },
  YER: { code: 'YER', name: 'Yemen Rial' },
  ZMW: { code: 'ZMW', name: 'Zambia Kwacha' },
  ZWG: { code: 'ZWG', name: 'Zimbabwe Gold' }
}));

/**
 * List of all valid currency codes
 * @type {readonly CurrencyCode[]}
 */
export const CURRENCY_CODES = Object.freeze(
  /** @type {CurrencyCode[]} */ (Object.keys(CURRENCIES))
);

/**
 * Check if a string is a valid CurrencyCode
 * @param {string} value
 * @returns {value is CurrencyCode}
 */
export function isCurrencyCode(value) {
  return value in CURRENCIES;
}

/**
 * Get currency info by code
 * @param {CurrencyCode} code
 * @returns {CurrencyInfo}
 */
export function getCurrency(code) {
  return CURRENCIES[code];
}

/**
 * Get display name for a currency (e.g., "United States Dollar (USD)")
 * @param {CurrencyCode} code
 * @returns {string}
 */
export function getCurrencyDisplayName(code) {
  const currency = CURRENCIES[code];
  return currency ? `${currency.name} (${currency.code})` : code;
}

/**
 * Get all currencies as an array (for dropdowns, etc.)
 * @returns {CurrencyInfo[]}
 */
export function getCurrencyList() {
  return Object.values(CURRENCIES);
}

// ============================================================================
// RATE RECORD TYPES
// ============================================================================

/**
 * A single exchange rate record
 * @typedef {Object} RateRecord
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {CurrencyCode} from_curr - Source currency code
 * @property {CurrencyCode} to_curr - Target currency code
 * @property {Provider} provider - Data provider (VISA, MASTERCARD, ECB)
 * @property {number} rate - Exchange rate
 * @property {number|null} markup - Markup percentage (VISA only, null for others)
 */

/**
 * Currency pair for watchlist
 * @typedef {Object} CurrencyPair
 * @property {CurrencyCode} from - Source currency
 * @property {CurrencyCode} to - Target currency
 */

// ============================================================================
// DATE RANGE TYPES (for CSVReader)
// ============================================================================

/**
 * Relative date range (last N months/years)
 * @typedef {Object} DateRangeRelative
 * @property {number} [months] - Last N months from today
 * @property {number} [years] - Last N years from today
 */

/**
 * Absolute date range (explicit start/end)
 * @typedef {Object} DateRangeAbsolute
 * @property {string} start - Start date in YYYY-MM-DD format
 * @property {string} end - End date in YYYY-MM-DD format
 */

/**
 * Load all available data
 * @typedef {Object} DateRangeAll
 * @property {boolean} all - When true, load all available data
 */

/**
 * Date range specification for queries
 * Use exactly one of: { months }, { years }, { start, end }, or { all: true }
 * @typedef {DateRangeRelative | DateRangeAbsolute | DateRangeAll} DateRange
 */

// ============================================================================
// INDEX FILE TYPES (for CSV store)
// ============================================================================

/**
 * Metadata for a single source currency in the index
 * @typedef {Object} CurrencyIndexEntry
 * @property {number[]} years - Years that have data files
 * @property {CurrencyCode[]} targets - Target currencies with data
 * @property {string} latest - Latest date with data (YYYY-MM-DD)
 */

/**
 * Index file structure (_index.json)
 * @typedef {Object} IndexFile
 * @property {string} generated - ISO timestamp when index was generated
 * @property {Record<CurrencyCode, CurrencyIndexEntry>} currencies - Per-currency metadata
 */

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Statistics for a single provider's data
 * @typedef {Object} RateStats
 * @property {number|null} high - Highest rate in range
 * @property {number|null} low - Lowest rate in range
 * @property {number|null} current - Most recent rate
 * @property {number|null} avgMarkup - Average markup percentage (VISA only)
 * @property {{start: string|null, end: string|null}} dateRange - Data date range
 */

/**
 * Combined statistics across all providers
 * @typedef {Object} MultiProviderStats
 * @property {RateStats} visa - Visa statistics
 * @property {RateStats} mastercard - Mastercard statistics
 * @property {RateStats} ecb - ECB statistics
 * @property {number|null} avgSpread - Average spread between providers
 * @property {number|null} currentSpread - Current spread between providers
 * @property {Provider|null} betterRateProvider - Provider with better current rate
 * @property {{start: string|null, end: string|null}} dateRange - Overall date range
 */

/**
 * Chart series visibility settings
 * @typedef {Object} SeriesVisibility
 * @property {boolean} visaRate - Show Visa rate line
 * @property {boolean} visaMarkup - Show Visa markup line
 * @property {boolean} mastercardRate - Show Mastercard rate line
 * @property {boolean} ecbRate - Show ECB rate line
 */

// ============================================================================
// BACKEND OPERATION TYPES
// ============================================================================

/**
 * ECB rate data (bidirectional)
 * @typedef {Object} ECBRateData
 * @property {RateRecord[]} eurTo - EUR → Currency rates
 * @property {RateRecord[]} toEur - Currency → EUR rates
 */

/**
 * ECB backfill result for a single currency
 * @typedef {Object} ECBBackfillResult
 * @property {CurrencyCode | null} currency - Currency that was backfilled
 * @property {number} eurToInserted - EUR → Currency records inserted
 * @property {number} toEurInserted - Currency → EUR records inserted
 * @property {number} skipped - Records skipped (duplicates)
 */

/**
 * Daily update failure record
 * @typedef {Object} DailyUpdateFailure
 * @property {string} pair - Currency pair (e.g., "USD/INR")
 * @property {Provider} provider - Provider that failed
 * @property {string} error - Error message
 */

/**
 * Backfill configuration
 * @typedef {Object} BackfillConfig
 * @property {CurrencyCode} from - Source currency
 * @property {CurrencyCode} to - Target currency
 * @property {'visa' | 'mastercard' | 'all'} provider - Provider(s) to backfill
 * @property {number} parallel - Number of parallel requests
 * @property {number} days - Number of days to backfill
 */

/**
 * Mass backfill configuration
 * @typedef {Object} MassBackfillConfig
 * @property {'visa' | 'mastercard' | 'all'} provider - Provider(s) to backfill
 * @property {number} parallel - Number of parallel requests
 * @property {number} days - Number of days to backfill
 */

/**
 * Backfill result for a single pair
 * @typedef {Object} BackfillResult
 * @property {boolean} success - Whether backfill succeeded
 * @property {number|null} exitCode - Process exit code
 */

/**
 * Provider-specific backfill result
 * @typedef {Object} ProviderBackfillResult
 * @property {number} inserted - Records inserted
 * @property {number} skipped - Records skipped (duplicates)
 */
