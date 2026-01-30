# ForexRadar QA Checklist

Manual quality assurance checklist to verify no regressions during refactoring.

## Pre-Requisites

- [ ] Clear localStorage: `localStorage.clear()`
- [ ] Open browser DevTools to monitor console errors

---

## 1. Page Load & Initial State

- [ ] Page loads without console errors
- [ ] Dark mode is applied by default
- [ ] Header displays with animated radar logo
- [ ] Hero section shows with animated radar visualization
- [ ] Currency blips (€, £, ¥, ₹, ₩) animate on radar
- [ ] Empty state card is visible ("Select a currency pair")
- [ ] Both currency dropdowns show "Search currency..."
- [ ] Footer displays correctly with heart animation

---

## 2. Theme Toggle

- [ ] Click theme toggle → switches to light mode
- [ ] HTML root has `.light` class, no `.dark` class
- [ ] All UI elements readable in light mode
- [ ] Click theme toggle → switches back to dark mode
- [ ] Theme persists on page reload
- [ ] Chart updates colors when theme changes (if chart visible)

---

## 3. Currency Dropdowns

### 3.1 From Currency Dropdown

- [ ] Click input → dropdown opens with "★ Popular" section first
- [ ] Popular currencies (USD, EUR, GBP, JPY, etc.) appear at top
- [ ] "All Currencies" section follows with remaining currencies
- [ ] Type "ind" → filters to show "INR - Indian Rupee"
- [ ] Matching text is highlighted with `<mark>` tags
- [ ] Type gibberish (e.g., "xyz123") → "No currencies found" appears
- [ ] Clear input → list resets to popular + all currencies
- [ ] Click currency → dropdown closes, input shows "CODE – Name"
- [ ] Clear button (×) appears when value is selected
- [ ] Click clear button → value cleared, placeholder restored

### 3.2 Keyboard Navigation

- [ ] Focus input → press Down Arrow → first item highlighted
- [ ] Press Down Arrow repeatedly → cycles through items
- [ ] Press Up Arrow → moves highlight up
- [ ] Press Enter → selects highlighted item
- [ ] Press Escape → closes dropdown
- [ ] Tab away → dropdown closes, value preserved

### 3.3 To Currency Dropdown

- [ ] Same behaviors as From Currency dropdown
- [ ] Can select different currency from "From" dropdown

---

## 4. Swap Currencies

- [ ] Select USD → INR
- [ ] Click swap button (⇄)
- [ ] Swap animation plays
- [ ] Values swap: INR → USD
- [ ] Chart reloads with new pair

---

## 5. Data Loading

### 5.1 Archived Pair (e.g., USD → INR)

- [ ] Loader appears with spinner
- [ ] Loader disappears when data loads
- [ ] Stats bar becomes visible
- [ ] Time range selector becomes visible
- [ ] Series toggles become visible
- [ ] Chart container becomes visible
- [ ] Empty state is hidden
- [ ] Archiving section is hidden

### 5.2 Non-Archived Pair

- [ ] Select a rare pair (e.g., XAF → XOF)
- [ ] Warning message appears: "This pair is not archived"
- [ ] "Request server-side archiving" link is visible
- [ ] Only ~7 days of live data shown

---

## 6. Stats Bar

- [ ] Current Rate displays a number
- [ ] Rate Quality shows percentile with color indicator
- [ ] Highest rate shown with green styling
- [ ] Lowest rate shown with red styling
- [ ] Avg Visa Markup displays percentage
- [ ] MC vs Visa spread shows difference
- [ ] Better Rate shows "Visa" or "MC" with colored background
- [ ] Last updated timestamp displays

### 6.1 Info Tooltips

- [ ] Hover over (?) icons → tooltip appears
- [ ] Tooltip has correct explanation text
- [ ] Tooltip positioned correctly (doesn't overflow viewport)

---

## 7. Chart

### 7.1 Chart Rendering

- [ ] Chart displays with ApexCharts
- [ ] X-axis shows dates
- [ ] Y-axis (left) shows exchange rate
- [ ] Y-axis (right) shows markup percentage
- [ ] Four series visible: Visa Rate, MC Rate, ECB Rate, Visa Markup
- [ ] Each series has distinct color

### 7.2 Chart Interactions

- [ ] Hover over chart → tooltip shows date and values
- [ ] Pinch/scroll to zoom (if enabled)
- [ ] Chart is responsive (resize window → chart adapts)

---

## 8. Time Range Selector

- [ ] Default selection is "1Y" (active state)
- [ ] Click "1M" → chart updates to 1 month of data
- [ ] Click "3M" → chart updates to 3 months
- [ ] Click "6M" → chart updates to 6 months
- [ ] Click "1Y" → chart updates to 1 year
- [ ] Click "5Y" → chart updates to 5 years (or all available)
- [ ] Click "All" → shows all available data
- [ ] Stats update to reflect filtered date range
- [ ] Active button has distinct styling
- [ ] Time range persists on page reload

---

## 9. Series Toggles

- [ ] All four checkboxes checked by default
- [ ] Uncheck "Visa Rate" → Visa Rate series hidden
- [ ] Uncheck "Mastercard Rate" → MC series hidden
- [ ] Uncheck "ECB Rate" → ECB series hidden
- [ ] Uncheck "Visa Markup" → Markup series hidden
- [ ] Re-check → series reappears
- [ ] Multiple toggles can be off simultaneously

---

## 10. Action Buttons

### 10.1 Copy Rate

- [ ] Click "Copy Rate" button
- [ ] Toast notification appears: "Rate copied to clipboard!"
- [ ] Clipboard contains: "USD/INR: 83.1234" (format)
- [ ] Button shows copied state briefly

### 10.2 Share

- [ ] Click "Share" button
- [ ] Toast notification appears: "Link copied to clipboard!"
- [ ] Clipboard contains URL with `?from=USD&to=INR&range=1y`

### 10.3 Download

- [ ] Click "Download" button
- [ ] PNG file downloads
- [ ] Filename format: `forex-USD-INR-1y.png`
- [ ] Image shows chart correctly

---

## 11. Recent Pairs

- [ ] After selecting USD → INR, recent pairs appear below selector
- [ ] Shows "Recent:" label with chips
- [ ] Select EUR → GBP
- [ ] Recent pairs now shows both USD→INR and EUR→GBP
- [ ] Click on a recent pair chip → loads that pair
- [ ] Maximum of 5 recent pairs shown
- [ ] Recent pairs persist on reload

---

## 12. URL State & Navigation

- [ ] Select USD → INR
- [ ] URL updates to `?from=USD&to=INR&range=1y`
- [ ] Copy URL, open in new tab → same pair loads
- [ ] Navigate with URL `?from=EUR&to=JPY` → EUR/JPY loads
- [ ] Change pair → browser history updated
- [ ] Click browser back → previous pair restored
- [ ] Click browser forward → next pair restored

---

## 13. Keyboard Shortcuts

- [ ] Press `?` → shortcuts modal opens
- [ ] Press `Escape` → modal closes
- [ ] Press `s` → focus moves to From currency dropdown
- [ ] Press `x` → currencies swap
- [ ] Press `t` → theme toggles
- [ ] Press `c` → rate copied (if available)
- [ ] Press `1` → 1M time range
- [ ] Press `3` → 3M time range
- [ ] Press `6` → 6M time range
- [ ] Press `y` → 1Y time range
- [ ] Press `5` → 5Y time range
- [ ] Press `a` → All time range

---

## 14. Error Handling

- [ ] Disconnect network → attempt to load new pair
- [ ] Error message appears gracefully
- [ ] Reconnect network → retry works
- [ ] No unhandled promise rejections in console

---

## 15. Responsive Design

### 15.1 Desktop (1920px)

- [ ] Full layout displays correctly
- [ ] Stats bar shows all cards in row

### 15.2 Tablet (768px)

- [ ] Layout adapts to narrower viewport
- [ ] Stats grid wraps appropriately
- [ ] Chart remains readable

### 15.3 Mobile (375px)

- [ ] Header remains functional
- [ ] Dropdowns work on touch
- [ ] Chart scrollable/zoomable
- [ ] Action buttons accessible
- [ ] Footer readable

---

## 16. Accessibility

- [ ] Tab through page → all interactive elements focusable
- [ ] Focus indicators visible
- [ ] Dropdowns have proper ARIA attributes
- [ ] Screen reader announces dropdown options
- [ ] Color contrast sufficient in both themes

---

## 17. Performance

- [ ] Page loads in < 3 seconds on decent connection
- [ ] No memory leaks (check DevTools Memory tab after repeated interactions)
- [ ] Smooth animations (60fps)
- [ ] Chart renders within 500ms of data load

---

## 18. Performance Budget

Automated Lighthouse audits run weekly and after each deploy. Results are available in GitHub Actions workflow summaries.

### Core Web Vitals Targets

| Metric | Target | Warning | Description |
|--------|--------|---------|-------------|
| **LCP** | < 2.5s | ≥ 2.5s | Largest Contentful Paint |
| **FCP** | < 1.8s | ≥ 1.8s | First Contentful Paint |
| **CLS** | < 0.1 | ≥ 0.1 | Cumulative Layout Shift |
| **TBT** | < 200ms | ≥ 200ms | Total Blocking Time |

### Category Score Targets

| Category | Target | Warning |
|----------|--------|---------|
| Performance | ≥ 90% | < 90% |
| Accessibility | ≥ 90% | < 90% |
| Best Practices | ≥ 90% | < 90% |
| SEO | ≥ 90% | < 90% |

### Test Environment

- **Profile**: Desktop (1350×940, no CPU throttling)
- **Runs**: 3 per audit (median used)
- **Workflows**:
  - `lighthouse.yml` — Weekly (Sundays 01:00 UTC) + manual dispatch, uses local server
  - `deploy.yml` — Post-deploy audit against production (GitHub Pages)

### Recording Baselines

After major changes, record baseline metrics here for comparison:

| Date | LCP | FCP | CLS | TBT | Perf | Notes |
|------|-----|-----|-----|-----|------|-------|
| _2025-01-30_ | _2.2s_ | _1.3s_ | _0.00_ | _20ms_ | _00%_ | _Initial baseline_ |

### Running Locally

```bash
# Install Lighthouse CLI
bun i -g lighthouse

# Run audit against local server
bun run tests/server.js &
lighthouse http://localhost:3000 --preset=desktop --output=html --output-path=./lighthouse-report.html

# View report
open lighthouse-report.html
```

---

## Sign-off

| Tester | Date | Browser/OS | Status |
|--------|------|------------|--------|
|        |      |            |        |
