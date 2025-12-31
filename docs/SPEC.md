

# SPEC.md

## 1. Architectural Overview

**Project Codename:** Forex Radar \
**Goal:** A zero-cost, statically hosted currency tracking application utilizing Visa's public API to provide >365-day historical exchange rates with dual-axis charting (Rate vs. Markup).

### 1.1 Design Philosophy
*   **Hybrid Data Layer:** Combines server-side SQLite (long-term storage) with client-side IndexedDB (short-term caching and lazy loading).
*   **Serverless Git Pattern:** The "backend" is a Node.js script running inside GitHub Actions.
*   **Progressive Enhancement:** The app attempts to load data from the fastest source first (Local Cache -> Server DB -> Live API).

### 1.2 Key Constraints & Limitations
*   **Visa API Hard Limit:** Returns HTTP 500 for dates older than ~1 year (365 days).
*   **Rate Limits:** None detected via client-side browser requests.
*   **Request Quirk:** To get the rate for Pair A→B, the API request parameters must be sent as `from=B&to=A`. The response object returns the correct A→B mapping.
*   **Hosting:** GitHub Pages (Static HTML/JS/DB files).
*   **Compute:** GitHub Actions (Free Tier).

---

## 2. Data Model

### 2.1 Storage Layers
1.  **Server-Side (SQLite):**
    *   **Location:** `/db/{FROM_CURRENCY}.db`
    *   **Purpose:** Persistent history > 1 year. Committed to Git.
    *   **Engine:** `sql.js` (WASM) loaded in browser.
2.  **Client-Side (IndexedDB):**
    *   **Name:** `ForexRadarDB`
    *   **Store:** `rates`
    *   **Purpose:** Cache for "Lazy Loaded" pairs (0-365 days) fetched live by the user's browser.

### 2.2 Schema (Unified)
Both SQLite and IndexedDB use the same record structure to ensure compatibility during merging.

**Record Definition:**
```typescript
interface RateRecord {
  date: string;        // "YYYY-MM-DD"
  from_curr: string;   // "USD"
  to_curr: string;     // "INR"
  provider: string;    // "VISA"
  rate: number;        // 83.50102
  markup: number;      // 0.002706 (Decimal representation of %)
}
```

**Database Schema (SQLite SQL):**
```sql
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    from_curr TEXT NOT NULL,
    to_curr TEXT NOT NULL,
    provider TEXT NOT NULL,
    rate REAL NOT NULL,
    markup REAL
);

CREATE INDEX idx_date_pair ON rates(date, from_curr, to_curr);
```

---

## 3. Implementation Stages

### Stage 1: Backend Infrastructure (The "Server")

This stage sets up the automated ingestion system.

#### 1.1 File Structure
```text
/scripts
  /lib
    db-handler.js    // SQLite utils
    visa-client.js   // API interaction
  backfill.js        // Manual runner for history
  daily-update.js    // GitHub Action entry point
```

#### 1.2 The Visa Client (`visa-client.js`)
**Logic:**
*   **Input:** `Date` object, `from_curr`, `to_curr`.
*   **Request Flip:** Swap params. Send `from=to_curr&to=from_curr`.
*   **Fetch:** `https://www.visa.co.in/cmsapi/fx/rates?amount=1&fee=0&utcConvertedDate=11%2F14%2F2025&exchangedate=11%2F14%2F2025&fromCurr=USD&toCurr=INR`
*   **Parse:** Extract `fxRateVisa` -> `rate`, `markupWithoutAdditionalFee` -> `markup`.
*   **Error Handling:** If `HTTP 500`, return `null` (End of history). If `429/403`, throw `Error` (Rate limit).
*   **Output:** `RateRecord` or `null`.

#### 1.3 The Backfill Script (`backfill.js`)
**Usage:** `node backfill.js --from=USD --to=INR`
**Logic:**
1.  Open SQLite DB (`db/USD.db`).
2.  Determine `start_date` = Today - 1 Day or Today if ET time is past 12pm.
3.  **Loop:** While `current_date` > (Latest date in DB or 1 year ago):
    *   Call `visa-client.fetch(date)`.
    *   If `500`: Break loop (Hit limit).
    *   Insert into DB.
    *   `current_date` = `current_date` - 1 day.
4.  Save and close DB.
5.  Log: "Backfilled X days for USD/INR".

#### 1.4 GitHub Action (`.github/workflows/daily.yml`)
**Trigger:** Cron `0 17 * * *` (12:00 PM ET).
**Steps:**
1.  `actions/checkout@v3`
2.  `actions/setup-node@v3`
3.  Run `node daily-update.js`.
    *   This script iterates through a `watchlist.json`.
    *   Calls `visa-client` for yesterday.
    *   Updates the relevant SQLite files.
4.  Commit changes:
    ```bash
    git config user.name "Bot"
    git add db/*.db
    git commit -m "auto: daily rates update"
    git push
    ```

---

### Stage 2: Frontend Data Layer (The "Brain")

This stage handles the complexity of merging data from Server, Cache, and Live API.

#### 2.1 Dependencies
*   `sql.js` (SQLite WASM)
*   `ApexCharts`
*   `date-fns` (Optional, for date formatting)

#### 2.2 The Data Manager Class (`/public/js/DataManager.js`)
**Responsibilities:**
1.  **Load Sharded DB:** Fetch `/db/{FROM}.db` and load into `sql.js`.
2.  **Query Server:** `SELECT * FROM rates WHERE from=? AND to=?`.
3.  **Query Cache (IndexedDB):** Open `ForexRadarDB`, get all records for pair.
4.  **Hybrid Fetch (The Core Logic):**
    *   *Input:* `pair` (e.g., USD/INR).
    *   *Step 1:* Load Server Data (Async).
    *   *Step 2:* Load Cache Data (Async).
    *   *Step 3:* Merge:
        *   Create Map `Date -> Record`.
        *   Insert Server records.
        *   Insert/Overwrite with Cache records (Cache is fresher).
    *   *Step 4:* Check Gaps:
        *   Identify the latest date in the merged set.
        *   If `Latest Date < Yesterday`, trigger `Live Fetch Loop`.
    *   *Step 5:* Live Fetch Loop:
        *   Loop backwards from Yesterday until existing data found or HTTP 500.
        *   Fetch from Visa API.
        *   **Save to IndexedDB** immediately.
        *   Add to Merged Set.
    *   *Output:* Array of `RateRecord` sorted by date ASC.

---

### Stage 3: Frontend UI (The "Face")

#### 3.1 Layout (HTML/Tailwind)
*   **Header:** Title + "Last Updated: [Date from SQL meta]".
*   **Controls:** Two `<select>` dropdowns (From, To). Populated via JS from a currency list.
*   **Action Area:**
    *   Loader (Spinner): "Fetching History..."
    *   Stats Bar: High, Low, Current, Avg Markup.
    *   Chart Container (`<div id="chart">`).
    *   "Request Server Archiving" Link (Always visible).
        *   Href: `https://github.com/USER/REPO/issues/new?title=Add pair: [FROM]/[TO]&body=Please add server-side archiving for this pair.`

#### 3.2 Chart Configuration (ApexCharts)
**Type:** Line Chart.
**Series:**
1.  `Exchange Rate`: Y-Axis 1 (Left). Color: Blue.
2.  `Markup (%)`: Y-Axis 2 (Right). Color: Red (Dotted).
**X-Axis:** DateTime (Type: 'datetime').
**Tooltip:** Shared crosshairs.
**Stroke:** Smooth curves.

#### 3.3 Event Handling
*   `change` on Dropdowns -> Trigger `DataManager.fetch(pair)` -> `Chart.updateSeries([rateSeries, markupSeries])`.

---

## 4. Operational & Deployment Guide

### 4.1 Initial Population (Bootstrap)
1.  Developer runs `node backfill.js --from=USD --to=INR`.
2.  Verify `db/USD.db` has data.
3.  Commit and Push.

### 4.2 CI/CD Pipeline
1.  Push to `main`.
2.  GitHub Pages builds (Jekyll or static file serving).
3.  Cron triggers `daily-update` at 12 PM ET.
4.  User visits site, loads `USD.db`.
5.  User selects `USD/JPY` (Not in DB).
6.  Browser fetches live history (0-365 days), saves to IndexedDB.
7.  Chart renders.
8.  User clicks "Request Archiving" -> Opens GitHub Issue.
9.  Developer sees issue, adds `USD/JPY` to watchlist, runs backfill script for older history.

### 4.3 Error Handling Standards
*   **Network Error:** Show toast "Network error fetching live data. Showing cached history."
*   **API Error (500):** Silently stop fetch (Handled in loop).
*   **DB Load Fail:** Show "Unable to load server history. Relying on browser cache."

---

## 5. Coding Standards

1.  **Async/Await:** Strict usage for all I/O operations.
2.  **Type Safety (JSDoc):** All functions must include JSDoc comments describing params and returns.
3.  **Separation of Concerns:**
    *   `VisaClient`: Only talks to API.
    *   `StorageManager`: Only talks to SQL/IndexedDB.
    *   `DataManager`: Orchestrates logic.
    *   `UI`: Only updates DOM.
4.  **No Alerts:** Use a simple custom notification system (DOM based).
5.  **Performance:** Debounce the dropdown change events (300ms) to prevent multiple fetches if user scrolls quickly.