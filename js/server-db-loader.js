/**
 * Server Database Loader
 * 
 * Loads and queries SQLite databases from the server using sql.js (WASM).
 * Databases are sharded by source currency: /db/{FROM_CURRENCY}.db
 * 
 * @module server-db-loader
 */

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */

/** @type {import('sql.js').SqlJsStatic|null} */
let SQL = null;

/** @type {Map<string, import('sql.js').Database>} */
const dbCache = new Map();

/**
 * Initializes sql.js library
 * @returns {Promise<import('sql.js').SqlJsStatic>}
 */
async function initSqlJs() {
  if (SQL) {
    return SQL;
  }

  // Load sql.js from CDN
  const sqlPromise = window.initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });

  SQL = await sqlPromise;
  return SQL;
}

/**
 * Gets the database URL for a given source currency
 * @param {string} fromCurr - Source currency code
 * @returns {string} URL to the database file
 */
function getDbUrl(fromCurr) {
  // Database files are at db/{currency}.db
  return `db/${fromCurr}.db`;
}

/**
 * Loads a database from the server for a given source currency
 * @param {string} fromCurr - Source currency code
 * @returns {Promise<import('sql.js').Database|null>} Database instance or null if not found
 */
export async function loadDatabase(fromCurr) {
  // Check cache first
  if (dbCache.has(fromCurr)) {
    return dbCache.get(fromCurr);
  }

  try {
    await initSqlJs();

    const dbUrl = getDbUrl(fromCurr);
    const response = await fetch(dbUrl);

    if (!response.ok) {
      if (response.status === 404) {
        // Database doesn't exist for this currency - not an error
        console.log(`No server database for ${fromCurr}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));

    // Cache the database
    dbCache.set(fromCurr, db);

    return db;
  } catch (error) {
    console.error(`Failed to load database for ${fromCurr}:`, error.message);
    return null;
  }
}

/**
 * Queries rates for a specific currency pair from the server database
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<RateRecord[]>} Array of rate records sorted by date ASC
 */
export async function queryRates(fromCurr, toCurr) {
  const db = await loadDatabase(fromCurr);

  if (!db) {
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT date, from_curr, to_curr, provider, rate, markup
      FROM rates
      WHERE from_curr = ? AND to_curr = ?
      ORDER BY date ASC
    `);

    stmt.bind([fromCurr, toCurr]);

    const records = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      records.push({
        date: String(row.date),
        from_curr: String(row.from_curr),
        to_curr: String(row.to_curr),
        provider: /** @type {import('../shared/types.js').Provider} */ (String(row.provider)),
        rate: Number(row.rate),
        markup: row.markup !== null ? Number(row.markup) : null
      });
    }

    stmt.free();
    return records;
  } catch (error) {
    console.error(`Failed to query rates for ${fromCurr}/${toCurr}:`, error.message);
    return [];
  }
}

/**
 * Gets the latest date in server database for a currency pair
 * @param {string} fromCurr - Source currency code
 * @param {string} toCurr - Target currency code
 * @returns {Promise<string|null>} Latest date or null
 */
export async function getLatestDate(fromCurr, toCurr) {
  const db = await loadDatabase(fromCurr);

  if (!db) {
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT MAX(date) as latest_date
      FROM rates
      WHERE from_curr = ? AND to_curr = ?
    `);

    stmt.bind([fromCurr, toCurr]);

    let latestDate = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      latestDate = row.latest_date ? String(row.latest_date) : null;
    }

    stmt.free();
    return latestDate;
  } catch (error) {
    console.error(`Failed to get latest date for ${fromCurr}/${toCurr}:`, error.message);
    return null;
  }
}

/**
 * Lists all currency pairs available in a server database
 * @param {string} fromCurr - Source currency code
 * @returns {Promise<Array<{from_curr: string, to_curr: string}>>}
 */
export async function listPairs(fromCurr) {
  const db = await loadDatabase(fromCurr);

  if (!db) {
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT DISTINCT from_curr, to_curr
      FROM rates
      ORDER BY from_curr, to_curr
    `);

    const pairs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      pairs.push({
        from_curr: String(row.from_curr),
        to_curr: String(row.to_curr)
      });
    }

    stmt.free();
    return pairs;
  } catch (error) {
    console.error(`Failed to list pairs for ${fromCurr}:`, error.message);
    return [];
  }
}

/**
 * Checks if a server database exists for a source currency
 * @param {string} fromCurr - Source currency code
 * @returns {Promise<boolean>}
 */
export async function databaseExists(fromCurr) {
  const db = await loadDatabase(fromCurr);
  return db !== null;
}

/**
 * Clears the database cache (useful for forcing reload)
 */
export function clearCache() {
  for (const db of dbCache.values()) {
    db.close();
  }
  dbCache.clear();
}
