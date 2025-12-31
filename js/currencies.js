/**
 * Currency Data
 * 
 * List of supported currencies with codes and names.
 * 
 * @module currencies
 */

/**
 * @typedef {Object} Currency
 * @property {string} code - ISO 4217 currency code
 * @property {string} name - Currency name
 */

/** @type {Currency[]} */
export const currencies = [
  { code: "AFN", name: "Afghanistan Afghani" },
  { code: "ALL", name: "Albanian Lek" },
  { code: "DZD", name: "Algerian Dinar" },
  { code: "AOA", name: "Angolan Kwanza" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "AMD", name: "Armenian Dram" },
  { code: "AWG", name: "Aruban Guilder" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "AZN", name: "Azerbaijan Manat" },
  { code: "BSD", name: "Bahamian Dollar" },
  { code: "BHD", name: "Bahrain Dinar" },
  { code: "BDT", name: "Bangladesh Taka" },
  { code: "BBD", name: "Barbados Dollar" },
  { code: "BYN", name: "Belarussian Ruble" },
  { code: "BZD", name: "Belize Dollar" },
  { code: "BMD", name: "Bermudan Dollar" },
  { code: "BTN", name: "Bhutanese Ngultrum" },
  { code: "BOB", name: "Bolivian Boliviano" },
  { code: "BAM", name: "Bosnian Convertible Mark" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "BND", name: "Brunei Dollar" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "BIF", name: "Burundi Franc" },
  { code: "KHR", name: "Cambodian Riel" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CVE", name: "Cape Verde Escudo" },
  { code: "KYD", name: "Cayman Island Dollar" },
  { code: "XOF", name: "CFA Franc BCEAO" },
  { code: "XAF", name: "CFA Franc BEAC" },
  { code: "XPF", name: "CFP Franc" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "CNY", name: "China Yuan Renminbi" },
  { code: "COP", name: "Colombian Peso" },
  { code: "KMF", name: "Comoros Franc" },
  { code: "CDF", name: "Congolese Franc" },
  { code: "CRC", name: "Costa Rica Colon" },
  { code: "CUP", name: "Cuban Peso" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "DKK", name: "Danish Krone" },
  { code: "DJF", name: "Djibouti Franc" },
  { code: "DOP", name: "Dominican Peso" },
  { code: "XCD", name: "East Caribbean Dollar" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "SVC", name: "El Salvador Colon" },
  { code: "ETB", name: "Ethiopia Birr" },
  { code: "EUR", name: "Euro" },
  { code: "FKP", name: "Falkland Island Pound" },
  { code: "FJD", name: "Fiji Dollar" },
  { code: "GMD", name: "Gambia Dalasi" },
  { code: "GEL", name: "Georgian Lari" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "GIP", name: "Gibraltar Pound" },
  { code: "GBP", name: "Great British Pound" },
  { code: "GTQ", name: "Guatemala Quetzal" },
  { code: "GNF", name: "Guinea Franc" },
  { code: "GYD", name: "Guyana Dollar" },
  { code: "HTG", name: "Haiti Gourde" },
  { code: "HNL", name: "Honduras Lempira" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "ISK", name: "Icelandic Krona" },
  { code: "INR", name: "Indian Rupee" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "IQD", name: "Iraq Dinar" },
  { code: "ILS", name: "Israeli Sheqel" },
  { code: "JMD", name: "Jamaican Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "JOD", name: "Jordan Dinar" },
  { code: "KZT", name: "Kazakhstan Tenge" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "KGS", name: "Kyrgyzstan Som" },
  { code: "LAK", name: "Laotian Kip" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "LSL", name: "Lesotho Loti" },
  { code: "LRD", name: "Liberian Dollar" },
  { code: "LYD", name: "Libya Dinar" },
  { code: "MOP", name: "Macau Pataca" },
  { code: "MKD", name: "Macedonia Denar" },
  { code: "MGA", name: "Malagascy Ariary" },
  { code: "MWK", name: "Malawi Kwacha" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "MVR", name: "Maldive Rufiyaa" },
  { code: "MRU", name: "Mauritania Ouguiya" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MDL", name: "Moldova Leu" },
  { code: "MNT", name: "Mongolia Tugrik" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MZN", name: "Mozambique Metical" },
  { code: "MMK", name: "Myanmar Kyat" },
  { code: "NAD", name: "Namibia Dollar" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "ANG", name: "Netherland Antille Guilder" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "NIO", name: "Nicaragua Cordoba Oro" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "OMR", name: "Oman Rial" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "PAB", name: "Panama Balboa" },
  { code: "PGK", name: "Papua New Guinea Kina" },
  { code: "PYG", name: "Paraguay Guarani" },
  { code: "PEN", name: "Peru Nuevo Sol" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "QAR", name: "Qatar Rial" },
  { code: "RON", name: "Romanian Leu" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "RWF", name: "Rwanda Franc" },
  { code: "SHP", name: "Saint Helena Pound" },
  { code: "WST", name: "Samoa Tala" },
  { code: "STN", name: "Sao Tome and Principe Dobra" },
  { code: "SAR", name: "Saudi Arabia Riyal" },
  { code: "RSD", name: "Serbian Dinar" },
  { code: "SCR", name: "Seychelles Rupee" },
  { code: "SLE", name: "Sierra Leone" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "SBD", name: "Solomon Island Dollar" },
  { code: "SOS", name: "Somali Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "KRW", name: "South Korean Won" },
  { code: "SSP", name: "South Sudan Pound" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "SDG", name: "Sudanese Pound" },
  { code: "SRD", name: "Suriname Dollar" },
  { code: "SZL", name: "Swaziland Lilangeni" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "TJS", name: "Tajikistan Somoni" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "THB", name: "Thai Baht" },
  { code: "TOP", name: "Tonga Paanga" },
  { code: "TTD", name: "Trinidad and Tobago Dollar" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "TMT", name: "Turkmenistan Manat" },
  { code: "UGX", name: "Uganda Shilling" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "AED", name: "United Arab Emirates Dirham" },
  { code: "USD", name: "United States Dollar" },
  { code: "UYU", name: "Uruguay Peso" },
  { code: "UZS", name: "Uzbekistan Sum" },
  { code: "VUV", name: "Vanuatu Vatu" },
  { code: "VES", name: "Venezuelan Bolivar Soberano" },
  { code: "VND", name: "Vietnam Dong" },
  { code: "YER", name: "Yemen Rial" },
  { code: "ZMW", name: "Zambia Kwacha" },
  { code: "ZWG", name: "Zimbabwe Gold" }
];

/**
 * Gets a currency by its code
 * @param {string} code - Currency code
 * @returns {Currency|undefined}
 */
export function getCurrency(code) {
  return currencies.find(c => c.code === code);
}

/**
 * Gets the display name for a currency
 * @param {string} code - Currency code
 * @returns {string}
 */
export function getCurrencyName(code) {
  const currency = getCurrency(code);
  return currency ? `${currency.name} (${currency.code})` : code;
}
