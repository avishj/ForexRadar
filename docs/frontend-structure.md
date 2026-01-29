# Frontend Structure Map

Quick reference for locating HTML sections and their corresponding CSS styles.

> **Usage**: Find a section below, click the HTML link to see the markup, then use the CSS line range to locate styles.

---

## Sections Overview

| Section | HTML Location | Primary Classes | CSS Location |
|---------|---------------|-----------------|--------------|
| [Animated Background](#animated-background) | [index.html#L48-L54](../index.html#L48-L54) | `.bg-pattern`, `.bg-grid`, `.bg-blob` | [styles.css#L309-L377](../css/styles.css#L309-L377) |
| [Header & Logo](#header--logo) | [index.html#L56-L96](../index.html#L56-L96) | `.header`, `.logo`, `.logo-icon`, `.radar-ring`, `.radar-sweep` | [styles.css#L379-L551](../css/styles.css#L379-L551) |
| [Theme Toggle](#theme-toggle) | [index.html#L76-L94](../index.html#L76-L94) | `.theme-toggle`, `.theme-toggle-thumb`, `.theme-toggle-stars`, `.theme-toggle-clouds` | [styles.css#L553-L709](../css/styles.css#L553-L709) |
| [Hero Section](#hero-section) | [index.html#L98-L152](../index.html#L98-L152) | `.hero`, `.hero-content`, `.hero-radar-visual`, `.hero-main`, `.hero-title`, `.hero-stats` | [styles.css#L711-L1001](../css/styles.css#L711-L1001) |
| [Currency Selector](#currency-selector) | [index.html#L154-L209](../index.html#L154-L209) | `.selector-container`, `.selector-card`, `.selector-grid`, `.selector-group`, `.searchable-dropdown` | [styles.css#L1092-L1342](../css/styles.css#L1092-L1342) |
| [Searchable Dropdown](#searchable-dropdown) | [index.html#L160-L174](../index.html#L160-L174) | `.searchable-dropdown`, `.dropdown-list`, `.dropdown-item`, `.dropdown-group-header` | [styles.css#L1343-L1527](../css/styles.css#L1343-L1527) |
| [Swap Button](#swap-button) | [index.html#L177-L181](../index.html#L177-L181) | `.selector-arrow`, `.btn--icon` | [styles.css#L1528-L1638](../css/styles.css#L1528-L1638) |
| [Recent Pairs](#recent-pairs) | [index.html#L204-L208](../index.html#L204-L208) | `.recent-pairs`, `.recent-pairs-list`, `.recent-pair-chip` | [styles.css#L1640-L1713](../css/styles.css#L1640-L1713) |
| [Loader](#loader) | [index.html#L211-L217](../index.html#L211-L217) | `.loader-container`, `.loader-spinner`, `.loader-text` | [styles.css#L2094-L2122](../css/styles.css#L2094-L2122) |
| [Stats Bar](#stats-bar) | [index.html#L219-L320](../index.html#L219-L320) | `.stats-container`, `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value`, `.stats-actions` | [styles.css#L1715-L2022](../css/styles.css#L1715-L2022) |
| [Info Tooltip](#info-tooltip) | (inline in stats) | `.info-tooltip`, `.tooltip-popup` | [styles.css#L1836-L1905](../css/styles.css#L1836-L1905) |
| [Time Range Selector](#time-range-selector) | [index.html#L322-L332](../index.html#L322-L332) | `.time-range-container`, `.time-range-buttons`, `.time-range-btn` | [styles.css#L2280-L2323](../css/styles.css#L2280-L2323) |
| [Series Toggles](#series-toggles) | [index.html#L334-L358](../index.html#L334-L358) | `.series-toggles-container`, `.series-toggles`, `.series-toggle`, `.toggle-indicator` | [styles.css#L2325-L2412](../css/styles.css#L2325-L2412) |
| [Chart Container](#chart-container) | [index.html#L360-L365](../index.html#L360-L365) | `.chart-container`, `.chart-card`, `#chart` | [styles.css#L2024-L2039](../css/styles.css#L2024-L2039) |
| [Empty State](#empty-state) | [index.html#L367-L378](../index.html#L367-L378) | `.empty-state`, `.empty-card`, `.empty-icon`, `.empty-title`, `.empty-description` | [styles.css#L2041-L2092](../css/styles.css#L2041-L2092) |
| [Archiving Section](#archiving-section) | [index.html#L380-L391](../index.html#L380-L391) | (inline styles) | N/A (inline) |
| [Footer](#footer) | [index.html#L393-L436](../index.html#L393-L436) | `.footer`, `.footer-text`, `.footer-link` | [styles.css#L2124-L2161](../css/styles.css#L2124-L2161) |
| [Notification Toast](#notification-toast) | [index.html#L452](../index.html#L452) | `#notification-container`, `.notification`, `.notif-icon`, `.notif-message` | [styles.css#L2163-L2257](../css/styles.css#L2163-L2257) |
| [Keyboard Shortcuts Modal](#keyboard-shortcuts-modal) | (created by JS) | `.shortcuts-modal`, `.shortcuts-content`, `.shortcuts-header`, `.shortcut-row` | [styles.css#L2448-L2598](../css/styles.css#L2448-L2598) |

---

## Section Details

### Animated Background
Floating gradient blobs and grid pattern behind all content.

- **HTML**: Lines 48-54 in [index.html](../index.html#L48-L54)
- **CSS**: Lines 309-377 in [styles.css](../css/styles.css#L309-L377)
- **Key classes**: `.bg-pattern` (container), `.bg-grid` (grid overlay), `.bg-blob` (gradient circles)
- **Animation**: `blob-float` keyframes for subtle movement

### Header & Logo
Fixed header with radar-animated logo icon.

- **HTML**: Lines 56-96 in [index.html](../index.html#L56-L96)
- **CSS**: Lines 379-551 in [styles.css](../css/styles.css#L379-L551)
- **Key classes**: `.header` (fixed container), `.logo-icon` (radar visual), `.radar-ring` (pulsing rings), `.radar-sweep` (rotating beam)
- **Animations**: `radar-pulse`, `radar-sweep` keyframes
- **Behavior**: `.header.scrolled` adds glass effect on scroll (via JS)

### Theme Toggle
Day/night toggle with sun/moon icons, stars, and clouds.

- **HTML**: Lines 76-94 in [index.html](../index.html#L76-L94)
- **CSS**: Lines 553-709 in [styles.css](../css/styles.css#L553-L709)
- **Key classes**: `.theme-toggle` (button), `.theme-toggle-thumb` (sliding indicator), `.theme-toggle-stars` (dark mode), `.theme-toggle-clouds` (light mode)
- **Animations**: `twinkle` (stars), `cloud-drift` (clouds)
- **JS**: [js/theme.js](../js/theme.js)

### Hero Section
Main headline with radar visualization and currency blips.

- **HTML**: Lines 98-152 in [index.html](../index.html#L98-L152)
- **CSS**: Lines 711-1001 in [styles.css](../css/styles.css#L711-L1001)
- **Key classes**: `.hero`, `.hero-radar-visual` (radar grid), `.radar-blip` (currency symbols), `.hero-title`, `.gradient-text`, `.hero-stats`
- **Animations**: `radar-pulse-ring`, `radar-sweep-beam`, `blip-pulse`, `slide-up` (entrance), `gradient-shift`

### Currency Selector
Main currency pair selection card with searchable dropdowns.

- **HTML**: Lines 154-209 in [index.html](../index.html#L154-L209)
- **CSS**: Lines 1092-1342 in [styles.css](../css/styles.css#L1092-L1342)
- **Key classes**: `.selector-container`, `.selector-card`, `.selector-grid`, `.selector-group`, `.selector-input`
- **Animations**: `selector-entrance`, `group-reveal`, `gradient-rotate` (hover)
- **JS**: [js/app.js](../js/app.js) (SearchableDropdown class)

### Searchable Dropdown
Filterable currency list with keyboard navigation.

- **HTML**: Lines 160-174 in [index.html](../index.html#L160-L174)
- **CSS**: Lines 1343-1527 in [styles.css](../css/styles.css#L1343-L1527)
- **Key classes**: `.searchable-dropdown`, `.dropdown-list`, `.dropdown-item`, `.dropdown-group-header`, `.clear-btn`
- **States**: `.open` (visible list), `.highlighted` (keyboard focus), `.selected` (current value)

### Swap Button
Circular button to swap from/to currencies.

- **HTML**: Lines 177-181 in [index.html](../index.html#L177-L181)
- **CSS**: Lines 1528-1638 in [styles.css](../css/styles.css#L1528-L1638)
- **Key classes**: `.selector-arrow`, `.btn--icon`
- **Animations**: `swap-spin` (on click), `arrow-pop` (entrance), `arrow-breathe` (idle)

### Recent Pairs
Horizontal list of recently selected currency pairs.

- **HTML**: Lines 204-208 in [index.html](../index.html#L204-L208)
- **CSS**: Lines 1640-1713 in [styles.css](../css/styles.css#L1640-L1713)
- **Key classes**: `.recent-pairs`, `.recent-pairs-list`, `.recent-pair-chip`
- **Animation**: `chip-enter` for new chips

### Loader
Centered spinner shown during data fetches.

- **HTML**: Lines 211-217 in [index.html](../index.html#L211-L217)
- **CSS**: Lines 2094-2122 in [styles.css](../css/styles.css#L2094-L2122)
- **Key classes**: `.loader-container`, `.loader-spinner`, `.loader-text`
- **Animation**: `spin` keyframes

### Stats Bar
Grid of stat cards displaying rate metrics.

- **HTML**: Lines 219-320 in [index.html](../index.html#L219-L320)
- **CSS**: Lines 1715-2022 in [styles.css](../css/styles.css#L1715-L2022)
- **Key classes**: `.stats-container`, `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value`, `.stats-actions`, `.action-btn`
- **Value modifiers**: `.accent`, `.high`, `.low`, `.markup`
- **Animation**: `stat-card-entrance` (staggered per card), `.stat-updating` (value change pulse)

### Info Tooltip
Question mark icons with hover popups for stat explanations.

- **HTML**: Inline within stat cards
- **CSS**: Lines 1836-1905 in [styles.css](../css/styles.css#L1836-L1905)
- **Key classes**: `.info-tooltip`, `.tooltip-popup`
- **Behavior**: Positioned via JS to escape overflow contexts

### Time Range Selector
Button group for 1M/3M/6M/1Y/5Y/All range selection.

- **HTML**: Lines 322-332 in [index.html](../index.html#L322-L332)
- **CSS**: Lines 2280-2323 in [styles.css](../css/styles.css#L2280-L2323)
- **Key classes**: `.time-range-container`, `.time-range-buttons`, `.time-range-btn`
- **Active state**: `.btn--active`

### Series Toggles
Checkboxes to show/hide chart series (Visa, Mastercard, ECB, Markup).

- **HTML**: Lines 334-358 in [index.html](../index.html#L334-L358)
- **CSS**: Lines 2325-2412 in [styles.css](../css/styles.css#L2325-L2412)
- **Key classes**: `.series-toggles-container`, `.series-toggles`, `.series-toggle`, `.toggle-indicator`
- **Color indicators**: `.visa-rate` (green), `.mc-rate` (red), `.ecb-rate` (blue), `.visa-markup` (amber dashed)

### Chart Container
ApexCharts wrapper for rate visualization.

- **HTML**: Lines 360-365 in [index.html](../index.html#L360-L365)
- **CSS**: Lines 2024-2039 in [styles.css](../css/styles.css#L2024-L2039)
- **Key classes**: `.chart-container`, `.chart-card`, `#chart`
- **JS**: [js/chart-manager.js](../js/chart-manager.js)

### Empty State
Placeholder shown before a currency pair is selected.

- **HTML**: Lines 367-378 in [index.html](../index.html#L367-L378)
- **CSS**: Lines 2041-2092 in [styles.css](../css/styles.css#L2041-L2092)
- **Key classes**: `.empty-state`, `.empty-card`, `.empty-icon`, `.empty-title`, `.empty-description`
- **Animation**: `empty-float` (icon bobbing)

### Archiving Section
Warning banner for non-archived pairs (uses inline styles).

- **HTML**: Lines 380-391 in [index.html](../index.html#L380-L391)
- **CSS**: Inline styles in HTML (candidate for future cleanup)

### Footer
Attribution, links, and keyboard shortcut trigger.

- **HTML**: Lines 393-436 in [index.html](../index.html#L393-L436)
- **CSS**: Lines 2124-2161 in [styles.css](../css/styles.css#L2124-L2161)
- **Key classes**: `.footer`, `.footer-text`, `.footer-link`
- **Note**: Contains inline styles (candidate for future cleanup)

### Notification Toast
Slide-in toast messages for success/error/info feedback.

- **HTML**: Line 452 in [index.html](../index.html#L452) (container only, content created by JS)
- **CSS**: Lines 2163-2257 in [styles.css](../css/styles.css#L2163-L2257)
- **Key classes**: `#notification-container`, `.notification`, `.notification-success`, `.notification-error`, `.notification-warning`, `.notification-info`
- **JS**: Created dynamically in [js/app.js](../js/app.js)

### Keyboard Shortcuts Modal
Modal overlay showing keyboard shortcuts.

- **HTML**: Created dynamically by JS
- **CSS**: Lines 2448-2598 in [styles.css](../css/styles.css#L2448-L2598)
- **Key classes**: `.shortcuts-modal`, `.shortcuts-backdrop`, `.shortcuts-content`, `.shortcuts-header`, `.shortcut-row`
- **Animation**: `modal-bounce-in`
- **JS**: Created in [js/app.js](../js/app.js)

---

## CSS Architecture

The stylesheet is organized in this order:

| Section | Lines | Purpose |
|---------|-------|---------|
| Variables & Theming | 13-118 | CSS custom properties, light/dark mode colors |
| Base Styles | 120-146 | Reset, typography, body defaults |
| Animation Primitives | 148-192 | Keyframes and `[data-animate]` entrance system |
| Button Base & Modifiers | 194-307 | `.btn` component and variants |
| Animated Background | 309-377 | `.bg-pattern`, `.bg-blob` |
| Header & Logo | 379-551 | `.header`, `.logo`, radar animations |
| Theme Toggle | 553-709 | Day/night toggle styles |
| Hero Section | 711-1031 | Hero layout, radar visual, entrance animations |
| Card Base | 1033-1090 | `.card` component |
| Currency Selector | 1092-1342 | Selector card, inputs, responsive |
| Searchable Dropdown | 1343-1638 | Dropdown list, items, swap button |
| Recent Pairs | 1640-1713 | Chip list |
| Stats Cards | 1715-2022 | Stats grid, values, actions |
| Chart Container | 2024-2039 | Chart wrapper |
| Empty State | 2041-2092 | Placeholder card |
| Loader | 2094-2122 | Spinner |
| Footer | 2124-2161 | Footer layout |
| Notification Toast | 2163-2257 | Toast messages |
| Scrollbar | 2259-2278 | Custom scrollbar |
| Time Range Selector | 2280-2323 | Range buttons |
| Series Toggles | 2325-2412 | Chart toggle controls |
| Utility Classes | 2414-2430 | `.hidden`, `.sr-only` |
| Print Styles | 2432-2446 | Print media query |
| Keyboard Shortcuts Modal | 2448-2598 | Modal styles |

---

## JavaScript Modules

| File | Purpose | Related HTML/CSS |
|------|---------|------------------|
| [js/app.js](../js/app.js) | Main app logic, dropdown, stats, modal, notifications | Selector, stats, modal, toasts |
| [js/theme.js](../js/theme.js) | Theme toggle behavior | `.theme-toggle` |
| [js/animations.js](../js/animations.js) | Entrance animations, scroll observer | `[data-animate]` elements |
| [js/chart-manager.js](../js/chart-manager.js) | ApexCharts wrapper | `#chart` |
| [js/data-manager.js](../js/data-manager.js) | Data fetching orchestration | Loader, stats |
| [js/storage-manager.js](../js/storage-manager.js) | IndexedDB + localStorage | Cache logic |
| [js/csv-reader.js](../js/csv-reader.js) | CSV parsing | Data layer |
| [js/currencies.js](../js/currencies.js) | Currency metadata | Dropdown items |
