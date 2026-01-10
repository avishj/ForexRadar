# ForexRadar Architecture Diagrams

Visual documentation of data flows and system architecture.

---

## System Overview

```mermaid
graph TB
    subgraph "Data Providers"
        VISA[Visa API]
        MC[Mastercard API]
        ECB[ECB Website]
    end

    subgraph "GitHub Actions"
        DAILY[daily-update.js]
        BACKFILL[backfill-orchestrator.js]
    end

    subgraph "Git Repository"
        CSV[("db/CURR/YEAR.csv")]
        WATCHLIST[watchlist.json]
    end

    subgraph "GitHub Pages"
        STATIC[Static Files]
    end

    subgraph "User Browser"
        APP[Frontend App]
        IDB[(IndexedDB Cache)]
    end

    VISA --> DAILY
    MC --> DAILY
    ECB --> DAILY
    VISA --> BACKFILL
    MC --> BACKFILL

    WATCHLIST --> DAILY
    WATCHLIST --> BACKFILL

    DAILY --> CSV
    BACKFILL --> CSV

    CSV --> STATIC
    STATIC --> APP
    APP <--> IDB

    VISA -.->|CORS Proxy| APP
    MC -.->|CORS Proxy| APP
```

---

## Backend: Daily Update Flow

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant DU as daily-update.js
    participant WL as watchlist.json
    participant VISA as Visa API
    participant MC as Mastercard API
    participant ECB as ECB Website
    participant CSV as csv-store.js
    participant GIT as Git

    GH->>DU: Cron trigger (UTC 17/19/21/23)
    DU->>WL: Load currency pairs
    
    loop Each Visa/MC pair
        DU->>CSV: Check if exists for date
        alt Not exists
            DU->>VISA: fetchRate(date, from, to)
            VISA-->>DU: RateRecord
            DU->>CSV: store.add(record)
            DU->>MC: fetchRate(date, from, to)
            MC-->>DU: RateRecord
            DU->>CSV: store.add(record)
        end
    end

    loop Each ECB currency
        DU->>ECB: fetchAllRates(currency)
        ECB-->>DU: EUR↔Currency rates
        DU->>CSV: store.add(records)
    end

    DU->>GIT: Commit & push CSV changes
    
    alt Failures detected
        DU->>GH: Create GitHub Issue via gh CLI
    end
```

---

## Backend: Backfill Orchestrator Flow

```mermaid
flowchart TD
    START([bun run backfill]) --> PARSE[Parse CLI args<br/>--days, --provider]
    PARSE --> LOAD[Load watchlist.json]
    LOAD --> ANALYZE[Analyze gaps<br/>Check each date/pair/provider]
    
    ANALYZE --> MISSING{Missing data?}
    MISSING -->|No| DONE([Complete])
    MISSING -->|Yes| GROUP[Group by provider]
    
    GROUP --> VISA_CHECK{Visa gaps?}
    GROUP --> MC_CHECK{Mastercard gaps?}
    
    VISA_CHECK -->|Yes| VISA_BATCH[visa-client-batch.js<br/>16 parallel requests<br/>Firefox headless]
    MC_CHECK -->|Yes| MC_BATCH[mastercard-client-batch.js<br/>Sequential requests<br/>Chromium headed]
    
    VISA_BATCH --> SAVE1[Save to CSV]
    MC_BATCH --> SAVE2[Save to CSV]
    
    SAVE1 --> SUMMARY
    SAVE2 --> SUMMARY
    VISA_CHECK -->|No| SUMMARY
    MC_CHECK -->|No| SUMMARY
    
    SUMMARY[Print summary] --> DONE
```

---

## Backend: Mastercard Session Management

```mermaid
stateDiagram-v2
    [*] --> LaunchBrowser: Start batch
    LaunchBrowser --> VisitUI: Chromium (headed)
    VisitUI --> FetchAPI: Get cookies/session
    
    FetchAPI --> CheckCount: Request complete
    
    CheckCount --> FetchAPI: count < 6
    CheckCount --> RefreshSession: count = 6
    CheckCount --> RestartBrowser: count = 18
    
    RefreshSession --> VisitUI: Visit UI page
    RestartBrowser --> LaunchBrowser: Close & reopen
    
    FetchAPI --> Handle403: HTTP 403
    Handle403 --> Wait2Min: Akamai block
    Wait2Min --> RefreshSession
    
    CheckCount --> [*]: Batch complete
```

---

## Frontend: Progressive Data Loading

```mermaid
flowchart TD
    START([User selects currency pair]) --> DEBOUNCE[Debounce 300ms]
    DEBOUNCE --> CACHE[1. Check IndexedDB cache]
    
    CACHE --> STALE{Cache stale?<br/>After UTC 12:00}
    
    STALE -->|No| MERGE1[Use cached data]
    STALE -->|Yes| SERVER[2. Fetch server CSVs]
    
    SERVER --> DISCOVER[Discover year files<br/>db/CURR/YEAR.csv]
    DISCOVER --> FETCH_CSV[Fetch relevant years]
    FETCH_CSV --> SAVE_CACHE[Save to IndexedDB]
    SAVE_CACHE --> MERGE2[Merge with cache]
    
    MERGE1 --> GAP_CHECK
    MERGE2 --> GAP_CHECK
    
    GAP_CHECK{Gap to yesterday?}
    
    GAP_CHECK -->|No| RENDER[Render chart]
    GAP_CHECK -->|Yes| LIVE[3. Live API fetch]
    
    LIVE --> VISA_LIVE[Visa API via CORS proxy]
    LIVE --> MC_LIVE[Mastercard API via CORS proxy]
    
    VISA_LIVE --> SAVE_LIVE[Save each to IndexedDB]
    MC_LIVE --> SAVE_LIVE
    
    SAVE_LIVE --> STOP{HTTP 500?}
    STOP -->|Yes| RENDER
    STOP -->|No| NEXT_DATE[Previous date]
    NEXT_DATE --> GAP_CHECK
```

---

## Frontend: Data Manager Merge Logic

```mermaid
flowchart LR
    subgraph Sources
        IDB[(IndexedDB)]
        CSV[(Server CSV)]
        API[Live API]
    end

    subgraph "Merge Map"
        MAP["Map&lt;date:provider, RateRecord&gt;"]
    end

    subgraph Output
        VISA_ARR["visaRecords[]"]
        MC_ARR["mastercardRecords[]"]
        ECB_ARR["ecbRecords[]"]
    end

    IDB -->|1. Load first| MAP
    CSV -->|2. Overwrite older| MAP
    API -->|3. Fill gaps| MAP

    MAP -->|Split by provider| VISA_ARR
    MAP -->|Split by provider| MC_ARR
    MAP -->|Split by provider| ECB_ARR
```

---

## Frontend: Chart Rendering

```mermaid
flowchart TD
    DATA[Merged RateRecords] --> SPLIT[Split by provider]
    
    SPLIT --> VISA_DATA[Visa records]
    SPLIT --> MC_DATA[Mastercard records]
    SPLIT --> ECB_DATA[ECB records]
    
    VISA_DATA --> SERIES1[Series: Visa Rate<br/>Left Y-axis, Emerald]
    VISA_DATA --> SERIES4[Series: Visa Markup %<br/>Right Y-axis, Amber]
    MC_DATA --> SERIES2[Series: MC Rate<br/>Left Y-axis, Red]
    ECB_DATA --> SERIES3[Series: ECB Rate<br/>Left Y-axis, Blue]
    
    SERIES1 --> APEX[ApexCharts]
    SERIES2 --> APEX
    SERIES3 --> APEX
    SERIES4 --> APEX
    
    APEX --> CHART[Dual-axis Line Chart]
    
    subgraph "User Controls"
        TOGGLE[Series Toggles] --> APEX
        RANGE[Time Range 1M-All] --> APEX
        ZOOM[Zoom/Pan] --> APEX
    end
    
    APEX --> STATS[Recalculate Stats<br/>on visible range]
```

---

## CSV Sharding Structure

```mermaid
graph TD
    subgraph "db/"
        subgraph "USD/"
            USD_2024[2024.csv]
            USD_2025[2025.csv]
            USD_2026[2026.csv]
        end
        
        subgraph "EUR/"
            EUR_1999[1999.csv]
            EUR_2000[2000.csv]
            EUR_DOT[...]
            EUR_2026[2026.csv]
        end
        
        subgraph "GBP/"
            GBP_2024[2024.csv]
            GBP_2025[2025.csv]
            GBP_2026[2026.csv]
        end
    end
    
    NOTE[Each file contains:<br/>date,to_curr,provider,rate,markup<br/>from_curr implicit from folder]
```

---

## Cache Staleness Logic

```mermaid
flowchart TD
    CHECK[needsServerRefresh] --> GET[Get lastRefresh from localStorage]
    
    GET --> EXISTS{Exists?}
    EXISTS -->|No| STALE1[Return: STALE]
    
    EXISTS -->|Yes| CALC[Calculate last UTC 12:00]
    
    CALC --> NOW{Current time}
    NOW -->|Before UTC 12:00 today| USE_YESTERDAY[Use yesterday's 12:00]
    NOW -->|After UTC 12:00 today| USE_TODAY[Use today's 12:00]
    
    USE_YESTERDAY --> COMPARE
    USE_TODAY --> COMPARE
    
    COMPARE{lastRefresh < lastUTC12pm?}
    COMPARE -->|Yes| STALE2[Return: STALE]
    COMPARE -->|No| FRESH[Return: FRESH]
```

---

## Error Handling Flow

```mermaid
flowchart TD
    subgraph "Backend Errors"
        B_500[HTTP 500] -->|End of history| B_STOP[Stop fetching, continue next]
        B_403[HTTP 403] -->|Mastercard block| B_WAIT[Wait 2 min, refresh session]
        B_FAIL[API failure] -->|Visa/ECB| B_ISSUE[Create GitHub Issue]
        B_FAIL2[API failure] -->|Mastercard| B_LOG[Log only, no issue]
    end
    
    subgraph "Frontend Errors"
        F_NET[Network error] --> F_TOAST[Show toast notification]
        F_500[HTTP 500] --> F_SILENT[Silent stop, use cached]
        F_429[HTTP 429/403] --> F_THROW[Throw error, show toast]
        F_CACHE[Cache unavailable] --> F_FALLBACK[Continue with server data]
    end
```
