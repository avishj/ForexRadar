# Frontend Structure Map

Quick reference for locating HTML sections and their corresponding CSS styles.

> **Usage**: Find a section below, click the HTML link to see the markup, then use the CSS line range to locate styles.

---

## Sections Overview

| Section | HTML Location | Primary Classes | CSS File |
|---------|---------------|-----------------|----------|
| [Animated Background](#animated-background) | [index.html#L48-L54](../index.html#L48-L54) | `.bg-pattern`, `.bg-grid`, `.bg-blob` | [sections.css](../css/sections.css) |
| [Header & Logo](#header--logo) | [index.html#L56-L96](../index.html#L56-L96) | `.header`, `.logo`, `.logo-icon`, `.radar-ring`, `.radar-sweep` | [sections.css](../css/sections.css) |
| [Theme Toggle](#theme-toggle) | [index.html#L76-L94](../index.html#L76-L94) | `.theme-toggle`, `.theme-toggle-thumb`, `.theme-toggle-stars`, `.theme-toggle-clouds` | [sections.css](../css/sections.css) |
| [Hero Section](#hero-section) | [index.html#L98-L152](../index.html#L98-L152) | `.hero`, `.hero-content`, `.hero-radar-visual`, `.hero-main`, `.hero-title`, `.hero-stats` | [sections.css](../css/sections.css) |
| [Currency Selector](#currency-selector) | [index.html#L154-L209](../index.html#L154-L209) | `.selector-container`, `.selector-card`, `.selector-grid`, `.selector-group`, `.searchable-dropdown` | [sections.css](../css/sections.css) |
| [Searchable Dropdown](#searchable-dropdown) | [index.html#L160-L174](../index.html#L160-L174) | `.searchable-dropdown`, `.dropdown-list`, `.dropdown-item`, `.dropdown-group-header` | [components.css](../css/components.css) |
| [Swap Button](#swap-button) | [index.html#L177-L181](../index.html#L177-L181) | `.selector-arrow`, `.btn--icon` | [components.css](../css/components.css) |
| [Recent Pairs](#recent-pairs) | [index.html#L204-L208](../index.html#L204-L208) | `.recent-pairs`, `.recent-pairs-list`, `.recent-pair-chip` | [components.css](../css/components.css) |
| [Loader](#loader) | [index.html#L211-L217](../index.html#L211-L217) | `.loader-container`, `.loader-spinner`, `.loader-text` | [sections.css](../css/sections.css) |
| [Stats Bar](#stats-bar) | [index.html#L219-L320](../index.html#L219-L320) | `.stats-container`, `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value`, `.stats-actions` | [sections.css](../css/sections.css) |
| [Info Tooltip](#info-tooltip) | (inline in stats) | `.info-tooltip`, `.tooltip-popup` | [components.css](../css/components.css) |
| [Time Range Selector](#time-range-selector) | [index.html#L322-L332](../index.html#L322-L332) | `.time-range-container`, `.time-range-buttons`, `.time-range-btn` | [components.css](../css/components.css) |
| [Series Toggles](#series-toggles) | [index.html#L334-L358](../index.html#L334-L358) | `.series-toggles-container`, `.series-toggles`, `.series-toggle`, `.toggle-indicator` | [components.css](../css/components.css) |
| [Chart Container](#chart-container) | [index.html#L360-L365](../index.html#L360-L365) | `.chart-container`, `.chart-card`, `#chart` | [sections.css](../css/sections.css) |
| [Empty State](#empty-state) | [index.html#L367-L378](../index.html#L367-L378) | `.empty-state`, `.empty-card`, `.empty-icon`, `.empty-title`, `.empty-description` | [sections.css](../css/sections.css) |
| [Archiving Section](#archiving-section) | [index.html#L373-L384](../index.html#L373-L384) | Tailwind utilities + `.footer-link` | Tailwind + [sections.css](../css/sections.css) |
| [Footer](#footer) | [index.html#L386-L429](../index.html#L386-L429) | `.footer` + Tailwind utilities | [sections.css](../css/sections.css) + Tailwind |
| [Notification Toast](#notification-toast) | [index.html#L452](../index.html#L452) | `#notification-container`, `.notification`, `.notif-icon`, `.notif-message` | [sections.css](../css/sections.css) |
| [Keyboard Shortcuts Modal](#keyboard-shortcuts-modal) | (created by JS) | `.shortcuts-modal`, `.shortcuts-content`, `.shortcuts-header`, `.shortcut-row` | [sections.css](../css/sections.css) |

---

## Section Details

### Animated Background
Floating gradient blobs and grid pattern behind all content.

- **HTML**: Lines 48-54 in [index.html](../index.html#L48-L54)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.bg-pattern` (container), `.bg-grid` (grid overlay), `.bg-blob` (gradient circles)
- **Animation**: `blob-float` in [animations.css](../css/animations.css)

### Header & Logo
Fixed header with radar-animated logo icon.

- **HTML**: Lines 56-96 in [index.html](../index.html#L56-L96)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.header` (fixed container), `.logo-icon` (radar visual), `.radar-ring` (pulsing rings), `.radar-sweep` (rotating beam)
- **Animations**: `radar-pulse`, `radar-sweep` in [animations.css](../css/animations.css)
- **Behavior**: `.header.scrolled` adds glass effect on scroll (via JS)

### Theme Toggle
Day/night toggle with sun/moon icons, stars, and clouds.

- **HTML**: Lines 76-94 in [index.html](../index.html#L76-L94)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.theme-toggle` (button), `.theme-toggle-thumb` (sliding indicator), `.theme-toggle-stars` (dark mode), `.theme-toggle-clouds` (light mode)
- **Animations**: `twinkle`, `cloud-drift` in [animations.css](../css/animations.css)
- **JS**: [js/theme.js](../js/theme.js)

### Hero Section
Main headline with radar visualization and currency blips.

- **HTML**: Lines 98-152 in [index.html](../index.html#L98-L152)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.hero`, `.hero-radar-visual` (radar grid), `.radar-blip` (currency symbols), `.hero-title`, `.gradient-text`, `.hero-stats`
- **Animations**: `radar-pulse-ring`, `radar-sweep-beam`, `blip-pulse`, `slide-up`, `gradient-shift` in [animations.css](../css/animations.css)

### Currency Selector
Main currency pair selection card with searchable dropdowns.

- **HTML**: Lines 154-209 in [index.html](../index.html#L154-L209)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.selector-container`, `.selector-card`, `.selector-grid`, `.selector-group`, `.selector-input`
- **Animations**: `selector-entrance`, `group-reveal`, `gradient-rotate` in [animations.css](../css/animations.css)
- **JS**: [js/app.js](../js/app.js) (SearchableDropdown class)

### Searchable Dropdown
Filterable currency list with keyboard navigation.

- **HTML**: Lines 160-174 in [index.html](../index.html#L160-L174)
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.searchable-dropdown`, `.dropdown-list`, `.dropdown-item`, `.dropdown-group-header`, `.clear-btn`
- **States**: `.open` (visible list), `.highlighted` (keyboard focus), `.selected` (current value)

### Swap Button
Circular button to swap from/to currencies.

- **HTML**: Lines 177-181 in [index.html](../index.html#L177-L181)
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.selector-arrow`, `.btn--icon`
- **Animations**: `swap-spin`, `arrow-pop`, `arrow-breathe` in [animations.css](../css/animations.css)

### Recent Pairs
Horizontal list of recently selected currency pairs.

- **HTML**: Lines 204-208 in [index.html](../index.html#L204-L208)
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.recent-pairs`, `.recent-pairs-list`, `.recent-pair-chip`
- **Animation**: `chip-enter` in [animations.css](../css/animations.css)

### Loader
Centered spinner shown during data fetches.

- **HTML**: Lines 211-217 in [index.html](../index.html#L211-L217)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.loader-container`, `.loader-spinner`, `.loader-text`
- **Animation**: `spin` in [animations.css](../css/animations.css)

### Stats Bar
Grid of stat cards displaying rate metrics.

- **HTML**: Lines 219-320 in [index.html](../index.html#L219-L320)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.stats-container`, `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value`, `.stats-actions`, `.action-btn`
- **Value modifiers**: `.accent`, `.high`, `.low`, `.markup`
- **Animation**: `stat-card-entrance` in [animations.css](../css/animations.css), `.stat-updating` (value change pulse)

### Info Tooltip
Question mark icons with hover popups for stat explanations.

- **HTML**: Inline within stat cards
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.info-tooltip`, `.tooltip-popup`
- **Behavior**: Positioned via JS to escape overflow contexts

### Time Range Selector
Button group for 1M/3M/6M/1Y/5Y/All range selection.

- **HTML**: Lines 322-332 in [index.html](../index.html#L322-L332)
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.time-range-container`, `.time-range-buttons`, `.time-range-btn`
- **Active state**: `.btn--active`

### Series Toggles
Checkboxes to show/hide chart series (Visa, Mastercard, ECB, Markup).

- **HTML**: Lines 334-358 in [index.html](../index.html#L334-L358)
- **CSS**: [components.css](../css/components.css)
- **Key classes**: `.series-toggles-container`, `.series-toggles`, `.series-toggle`, `.toggle-indicator`
- **Color indicators**: `.visa-rate` (green), `.mc-rate` (red), `.ecb-rate` (blue), `.visa-markup` (amber dashed)

### Chart Container
ApexCharts wrapper for rate visualization.

- **HTML**: Lines 360-365 in [index.html](../index.html#L360-L365)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.chart-container`, `.chart-card`, `#chart`
- **JS**: [js/chart-manager.js](../js/chart-manager.js)

### Empty State
Placeholder shown before a currency pair is selected.

- **HTML**: Lines 367-378 in [index.html](../index.html#L367-L378)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.empty-state`, `.empty-card`, `.empty-icon`, `.empty-title`, `.empty-description`
- **Animation**: `empty-float` in [animations.css](../css/animations.css)

### Archiving Section
Warning banner for non-archived pairs.

- **HTML**: Lines 373-384 in [index.html](../index.html#L373-L384)
- **CSS**: Tailwind utilities for layout (`text-center`, `py-4`, `px-8`, `text-sm`, `mb-2`, `text-xs`)
- **Key classes**: `.footer-link` (from sections.css)
- **Note**: Uses Tailwind for layout/spacing, CSS variables for theming colors

### Footer
Attribution, links, and keyboard shortcut trigger.

- **HTML**: Lines 386-429 in [index.html](../index.html#L386-L429)
- **CSS**: [sections.css](../css/sections.css) + Tailwind utilities
- **Key classes**: `.footer`, `.footer-text`, `.footer-link`
- **Tailwind usage**: Layout (`flex`, `flex-col`, `items-center`, `gap-*`), spacing (`m-0`, `p-0`), typography (`text-sm`, `text-xs`)

### Notification Toast
Slide-in toast messages for success/error/info feedback.

- **HTML**: Line 452 in [index.html](../index.html#L452) (container only, content created by JS)
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `#notification-container`, `.notification`, `.notification-success`, `.notification-error`, `.notification-warning`, `.notification-info`
- **JS**: Created dynamically in [js/app.js](../js/app.js)

### Keyboard Shortcuts Modal
Modal overlay showing keyboard shortcuts.

- **HTML**: Created dynamically by JS
- **CSS**: [sections.css](../css/sections.css)
- **Key classes**: `.shortcuts-modal`, `.shortcuts-backdrop`, `.shortcuts-content`, `.shortcuts-header`, `.shortcut-row`
- **Animation**: `modal-bounce-in` in [animations.css](../css/animations.css)
- **JS**: Created in [js/app.js](../js/app.js)

---

## CSS Architecture

The CSS is split into modular files, imported via [styles.css](../css/styles.css):

| File | Purpose |
|------|---------|
| [base.css](../css/base.css) | CSS variables, reset, typography, light/dark theming |
| [animations.css](../css/animations.css) | All `@keyframes` + `[data-animate]` entrance system |
| [components.css](../css/components.css) | Buttons, cards, dropdowns, tooltips, toggles, chips |
| [sections.css](../css/sections.css) | Header, hero, selector, stats, chart, footer, notifications, modal |
| [utilities.css](../css/utilities.css) | `.hidden`, `.sr-only`, scrollbar, print styles |

### Import Order (in styles.css)

```css
@import url('base.css');
@import url('animations.css');
@import url('components.css');
@import url('sections.css');
@import url('utilities.css');
```

> **Note**: Import order matters for specificity. Do not reorder.

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

---

## Tailwind CSS Usage

The project uses **Tailwind CSS v4** via CDN for layout and spacing utilities. Custom design tokens and visual effects remain in custom CSS.

### Tailwind Scope (what it handles)

- **Layout**: `flex`, `flex-col`, `items-center`, `justify-center`, `gap-*`
- **Spacing**: `m-*`, `p-*`, `py-*`, `px-*`, `mt-*`, `mb-*`
- **Typography**: `text-xs`, `text-sm`, `text-lg`, `font-medium`, `font-display`
- **Sizing**: `w-*`, `h-*`, `max-w-*`
- **Display**: `hidden`, `block`, `inline-flex`

### Custom CSS Scope (what it handles)

- **Theming**: CSS variables (`--text-primary`, `--bg-secondary`, `--accent-primary`, etc.)
- **Visual effects**: Gradients, shadows, glows, backdrop filters
- **Animations**: All `@keyframes` and entrance animations
- **Complex components**: Radar visuals, theme toggle, stat cards, dropdowns
- **Transitions**: Hover effects, state changes

### Tailwind Configuration

Tailwind v4 is configured via `<style type="text/tailwindcss">` in [index.html](../index.html):

```css
@theme {
  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body: "DM Sans", system-ui, sans-serif;
}
```

### Where Tailwind is Used

| Section | Tailwind Classes | Custom CSS |
|---------|------------------|------------|
| Last Updated | `text-center`, `mt-4`, `text-xs` | `--text-tertiary` (color) |
| Archiving Section | `text-center`, `py-4`, `px-8`, `text-sm`, `mb-2`, `text-xs` | `--text-secondary` (color) |
| Footer | `max-w-5xl`, `mx-auto`, `flex`, `flex-col`, `gap-4`, `items-center`, `m-0`, `text-*` | `.footer`, `.footer-link` |

> **Note**: Tailwind CDN is for development only. For production, consider switching to Tailwind CLI build for smaller CSS.
