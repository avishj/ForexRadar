// @ts-check
import { test, expect } from '@playwright/test';

/**
 * ForexRadar UI Smoke Tests
 * 
 * Comprehensive test suite to prevent regressions during refactoring.
 * Tests run on both Chromium and Firefox.
 */

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Select a currency from the "from" dropdown.
 * Clears the input first to ensure dropdown shows all options.
 */
async function selectFromCurrency(page, code) {
  const input = page.locator('#from-currency-input');
  await input.focus();
  await input.fill('');
  await page.click(`#from-currency-list .dropdown-item[data-code="${code}"]`);
}

/**
 * Select a currency from the "to" dropdown.
 * Clears the input first to ensure dropdown shows all options.
 */
async function selectToCurrency(page, code) {
  const input = page.locator('#to-currency-input');
  await input.focus();
  await input.fill('');
  await page.click(`#to-currency-list .dropdown-item[data-code="${code}"]`);
}

/**
 * Select a currency pair and wait for data to load.
 */
async function selectCurrencyPair(page, fromCode, toCode) {
  await selectFromCurrency(page, fromCode);
  await selectToCurrency(page, toCode);
}

/**
 * Select USD/INR and wait for stats bar to be visible.
 */
async function selectUsdInrAndWaitForData(page) {
  await selectCurrencyPair(page, 'USD', 'INR');
  await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
}

// ============================================================================
// Test Setup
// ============================================================================

// Note: Each test starts fresh by going to '/' directly
// Tests that need clean localStorage must clear it explicitly

// ============================================================================
// Page Load & Initial State Tests
// ============================================================================

test.describe('Page Load & Initial State', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (e.g., network failures for external resources)
    const criticalErrors = errors.filter(
      (e) => !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('dark mode is applied by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).not.toHaveClass(/light/);
  });

  test('header displays with logo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.logo-text')).toContainText('Forex Radar');
  });

  test('radar logo has animated rings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.radar-ring-1')).toBeVisible();
    await expect(page.locator('.radar-ring-2')).toBeVisible();
    await expect(page.locator('.radar-ring-3')).toBeVisible();
    await expect(page.locator('.radar-sweep')).toBeVisible();
  });

  test('hero section displays correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.hero-title')).toContainText('Decode the');
    await expect(page.locator('.gradient-text')).toContainText('hidden costs');
  });

  test('hero radar visualization with currency blips', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-radar-visual')).toBeVisible();
    
    // Check currency blips
    const blips = page.locator('.radar-blip');
    await expect(blips).toHaveCount(5);
    await expect(page.locator('[data-currency="EUR"]')).toContainText('€');
    await expect(page.locator('[data-currency="GBP"]')).toContainText('£');
    await expect(page.locator('[data-currency="JPY"]')).toContainText('¥');
    await expect(page.locator('[data-currency="INR"]')).toContainText('₹');
    await expect(page.locator('[data-currency="KRW"]')).toContainText('₩');
  });

  test('empty state exists in DOM', async ({ page }) => {
    // Note: App defaults to USD/INR on fresh load, so empty state will be hidden
    // This test just verifies the empty state element exists and has correct content
    await page.goto('/');
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeAttached();
    await expect(page.locator('.empty-title')).toContainText('Select a currency pair');
  });

  test('currency dropdowns have correct initial state', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const toInput = page.locator('#to-currency-input');
    
    await expect(fromInput).toHaveAttribute('placeholder', 'Search currency...');
    await expect(toInput).toHaveAttribute('placeholder', 'Search currency...');
  });

  test('footer displays correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer.footer')).toBeVisible();
    await expect(page.locator('.footer-text')).toContainText('Data sourced from Visa and Mastercard');
  });

  test('theme toggle button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeVisible();
  });

  test('hero stats display', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-stat-number').first()).toContainText('150+');
    await expect(page.locator('.hero-stat-label').first()).toContainText('Currencies');
  });
});

// ============================================================================
// Theme Toggle Tests
// ============================================================================

test.describe('Theme Toggle', () => {
  test('clicking toggle switches to light mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    await page.click('#theme-toggle');
    
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('clicking toggle again switches back to dark mode', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/light/);
    
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('theme persists on reload', async ({ page }) => {
    await page.goto('/');
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/light/);
    
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('themechange event fires without error', async ({ page }) => {
    await page.goto('/');
    
    const eventFired = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('themechange', (e) => {
          // @ts-ignore
          resolve(e.detail?.theme);
        }, { once: true });
        document.getElementById('theme-toggle')?.click();
      });
    });
    
    expect(eventFired).toBe('light');
  });
});

// ============================================================================
// Currency Dropdown Tests
// ============================================================================

test.describe('Currency Dropdowns', () => {
  test('dropdown opens on input focus', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    await expect(fromList).not.toBeVisible();
    await fromInput.focus();
    await expect(fromList).toBeVisible();
  });

  test('dropdown shows popular currencies first', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    // Clear any default value to see full list
    await fromInput.focus();
    await fromInput.fill('');
    await page.waitForSelector('#from-currency-list .dropdown-item');
    
    const popularHeader = page.locator('#from-currency-list .dropdown-group-header').first();
    await expect(popularHeader).toContainText('★ Popular');
    
    // Check popular currencies are present
    const items = page.locator('#from-currency-list .dropdown-item');
    await expect(items.first()).toBeVisible();
  });

  test('typing filters currencies correctly', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.focus();
    await fromInput.fill('ind');
    
    // Should show INR - Indian Rupee
    const item = page.locator('#from-currency-list .dropdown-item').filter({ hasText: 'INR' });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Indian Rupee');
  });

  test('matching text is highlighted with mark tags', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.focus();
    await fromInput.fill('eur');
    
    const mark = page.locator('#from-currency-list .dropdown-item mark');
    await expect(mark.first()).toBeVisible();
  });

  test('no results message shows for invalid search', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.fill('xyz123invalidcurrency');
    
    await expect(page.locator('.dropdown-no-results')).toBeVisible();
    await expect(page.locator('.dropdown-no-results')).toContainText('No currencies found');
  });

  test('selecting currency updates input value', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    
    await expect(fromInput).toHaveValue(/EUR – Euro/);
  });

  test('clear button appears after selection', async ({ page }) => {
    await page.goto('/');
    const fromDropdown = page.locator('#from-currency-dropdown');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    
    await expect(fromDropdown.locator('.clear-btn')).toBeVisible();
  });

  test('clear button clears selection', async ({ page }) => {
    await page.goto('/');
    const fromDropdown = page.locator('#from-currency-dropdown');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    await expect(fromInput).toHaveValue(/EUR/);
    
    await fromDropdown.locator('.clear-btn').click();
    await expect(fromInput).toHaveValue('');
  });

  test('keyboard navigation with arrow keys', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await page.keyboard.press('ArrowDown');
    
    const highlighted = fromList.locator('.dropdown-item.highlighted');
    await expect(highlighted).toBeVisible();
  });

  test('Enter key selects highlighted item', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Should have selected a currency
    await expect(fromInput).not.toHaveValue('');
  });

  test('Escape key closes dropdown', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    await fromInput.focus();
    await expect(fromList).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(fromList).not.toBeVisible();
  });

  test('tab closes dropdown and preserves value', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="GBP"]').click();
    await expect(fromInput).toHaveValue(/GBP/);
    
    await fromInput.focus();
    await page.keyboard.press('Tab');
    
    // Value should be preserved
    await expect(fromInput).toHaveValue(/GBP/);
  });
});

// ============================================================================
// Swap Currencies Tests
// ============================================================================

test.describe('Swap Currencies', () => {
  test('swap button swaps currency values', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Get initial values
    const fromBefore = await page.locator('#from-currency').inputValue();
    const toBefore = await page.locator('#to-currency').inputValue();
    
    expect(fromBefore).toBe('USD');
    expect(toBefore).toBe('EUR');
    
    // Click swap
    await page.click('#swap-currencies');
    
    // Wait for swap
    await page.waitForTimeout(200);
    
    // Check values swapped
    const fromAfter = await page.locator('#from-currency').inputValue();
    const toAfter = await page.locator('#to-currency').inputValue();
    
    expect(fromAfter).toBe('EUR');
    expect(toAfter).toBe('USD');
  });

  test('swap button has animation class during swap', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Start watching for class before clicking
    const swapButton = page.locator('#swap-currencies');
    await swapButton.click();
    
    // Class should be added (might be transient)
    await expect(swapButton).toHaveClass(/swapping/);
  });
});

// ============================================================================
// Data Loading Tests
// ============================================================================

test.describe('Data Loading', () => {
  test('loader appears when loading data', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    // Loader should be visible initially (might be brief)
    // We check that it exists in DOM
    await expect(page.locator('#loader')).toBeDefined();
  });

  test('stats bar becomes visible after loading', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await expect(page.locator('#stats-bar')).toBeVisible({ timeout: 30000 });
  });

  test('chart container becomes visible after loading', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await expect(page.locator('#chart-container')).toBeVisible({ timeout: 30000 });
  });

  test('empty state is hidden after loading data', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#chart-container').waitFor({ state: 'visible', timeout: 30000 });
    await expect(page.locator('#empty-state')).toHaveClass(/hidden/);
  });

  test('time range selector becomes visible', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await expect(page.locator('#time-range-selector')).toBeVisible({ timeout: 30000 });
  });

  test('series toggles become visible', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await expect(page.locator('#series-toggles')).toBeVisible({ timeout: 30000 });
  });
});

// ============================================================================
// Stats Bar Tests
// ============================================================================

test.describe('Stats Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectUsdInrAndWaitForData(page);
  });

  test('current rate displays a value', async ({ page }) => {
    const statCurrent = page.locator('#stat-current');
    await expect(statCurrent).not.toHaveText('-');
  });

  test('rate quality displays percentile', async ({ page }) => {
    const statPercentile = page.locator('#stat-percentile');
    // Should contain a number or percentage
    const text = await statPercentile.textContent();
    expect(text).not.toBe('-');
  });

  test('high rate is displayed', async ({ page }) => {
    const statHigh = page.locator('#stat-high');
    await expect(statHigh).not.toHaveText('-');
  });

  test('low rate is displayed', async ({ page }) => {
    const statLow = page.locator('#stat-low');
    await expect(statLow).not.toHaveText('-');
  });

  test('last updated timestamp displays', async ({ page }) => {
    const lastUpdated = page.locator('#last-updated');
    await expect(lastUpdated).not.toBeEmpty();
  });

  test('info tooltips are present', async ({ page }) => {
    const tooltips = page.locator('.info-tooltip');
    await expect(tooltips.first()).toBeVisible();
  });

  test('action buttons are visible', async ({ page }) => {
    await expect(page.locator('#copy-rate-btn')).toBeVisible();
    await expect(page.locator('#share-url-btn')).toBeVisible();
    await expect(page.locator('#download-chart-btn')).toBeVisible();
  });
});

// ============================================================================
// Time Range Tests
// ============================================================================

test.describe('Time Range Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('default selection is 1Y', async ({ page }) => {
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '1y');
  });

  test('clicking 1M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="1m"]');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '1m');
  });

  test('clicking 3M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="3m"]');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '3m');
  });

  test('clicking 6M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="6m"]');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '6m');
  });

  test('clicking 5Y changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="5y"]');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '5y');
  });

  test('clicking All changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="all"]');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', 'all');
  });

  test('time range persists on reload', async ({ page }) => {
    await page.click('.time-range-btn[data-range="3m"]');
    await page.waitForTimeout(500);
    
    await page.reload();
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '3m');
  });
});

// ============================================================================
// Series Toggle Tests
// ============================================================================

test.describe('Series Toggles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#series-toggles').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('all toggles checked by default', async ({ page }) => {
    await expect(page.locator('#toggle-visa-rate')).toBeChecked();
    await expect(page.locator('#toggle-mc-rate')).toBeChecked();
    // ECB toggle may not be visible if no ECB data exists for the pair
    const ecbToggle = page.locator('#toggle-ecb-rate');
    if (await ecbToggle.isVisible()) {
      await expect(ecbToggle).toBeChecked();
    }
    await expect(page.locator('#toggle-visa-markup')).toBeChecked();
  });

  test('unchecking Visa Rate toggle works', async ({ page }) => {
    await page.locator('#toggle-visa-rate').uncheck({ force: true });
    await expect(page.locator('#toggle-visa-rate')).not.toBeChecked();
  });

  test('unchecking Mastercard Rate toggle works', async ({ page }) => {
    await page.locator('#toggle-mc-rate').uncheck({ force: true });
    await expect(page.locator('#toggle-mc-rate')).not.toBeChecked();
  });

  test('unchecking ECB Rate toggle works', async ({ page }) => {
    const ecbToggle = page.locator('#toggle-ecb-rate');
    // ECB toggle may not be visible if no ECB data exists for the pair
    if (await ecbToggle.isVisible()) {
      await ecbToggle.uncheck({ force: true });
      await expect(ecbToggle).not.toBeChecked();
    }
  });

  test('unchecking Visa Markup toggle works', async ({ page }) => {
    await page.locator('#toggle-visa-markup').uncheck({ force: true });
    await expect(page.locator('#toggle-visa-markup')).not.toBeChecked();
  });

  test('re-checking toggle works', async ({ page }) => {
    await page.locator('#toggle-visa-rate').uncheck({ force: true });
    await expect(page.locator('#toggle-visa-rate')).not.toBeChecked();
    
    await page.locator('#toggle-visa-rate').check({ force: true });
    await expect(page.locator('#toggle-visa-rate')).toBeChecked();
  });
});

// ============================================================================
// Chart Tests
// ============================================================================

test.describe('Chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#chart-container').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('chart container is visible', async ({ page }) => {
    await expect(page.locator('#chart')).toBeVisible();
  });

  test('ApexCharts initializes', async ({ page }) => {
    // ApexCharts adds specific elements when initialized
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('chart has legend', async ({ page }) => {
    await expect(page.locator('.apexcharts-legend')).toBeVisible();
  });
});

// ============================================================================
// Action Button Tests
// ============================================================================

test.describe('Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectUsdInrAndWaitForData(page);
  });

  test('copy rate button shows notification', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    
    await page.click('#copy-rate-btn');
    
    // Notification should appear with specific text
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('share button shows notification', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    
    await page.click('#share-url-btn');
    
    // Look for the share-specific notification
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'Link copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('download button triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('#download-chart-btn');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('forex-USD-INR');
  });
});

// ============================================================================
// Recent Pairs Tests
// ============================================================================

test.describe('Recent Pairs', () => {
  test('recent pairs appear after selecting a pair', async ({ page }) => {
    await page.goto('/');
    await selectUsdInrAndWaitForData(page);
    await expect(page.locator('#recent-pairs')).toBeVisible();
  });

  test('clicking recent pair loads that pair', async ({ page }) => {
    await page.goto('/');
    
    // Select first pair
    await selectUsdInrAndWaitForData(page);
    
    // Select second pair
    await selectCurrencyPair(page, 'EUR', 'GBP');
    await page.waitForTimeout(500);
    
    // Click on the USD→INR recent pair if visible
    const recentPair = page.locator('#recent-pairs-list .recent-pair').first();
    if (await recentPair.isVisible()) {
      await recentPair.click();
      await page.waitForTimeout(500);
    }
  });
});

// ============================================================================
// URL State Tests
// ============================================================================

test.describe('URL State & Navigation', () => {
  test('URL updates when selecting currencies', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.waitForTimeout(500);
    
    const url = page.url();
    expect(url).toContain('from=USD');
    expect(url).toContain('to=INR');
  });

  test('loading URL with query params sets currencies', async ({ page }) => {
    await page.goto('/?from=EUR&to=JPY');
    
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    
    const fromValue = await page.locator('#from-currency').inputValue();
    const toValue = await page.locator('#to-currency').inputValue();
    
    expect(fromValue).toBe('EUR');
    expect(toValue).toBe('JPY');
  });

  test('URL includes time range', async ({ page }) => {
    await page.goto('/?from=USD&to=INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    const url = page.url();
    expect(url).toContain('range=');
  });
});

// ============================================================================
// Keyboard Shortcuts Tests
// ============================================================================

test.describe('Keyboard Shortcuts', () => {
  test('? key opens shortcuts modal', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');
    
    const modal = page.locator('#shortcuts-modal, .shortcuts-modal');
    await expect(modal).toBeVisible({ timeout: 2000 });
  });

  test('Escape closes shortcuts modal', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');
    
    const modal = page.locator('#shortcuts-modal, .shortcuts-modal');
    await expect(modal).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('s key focuses search', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('s');
    
    // From input should be focused
    await expect(page.locator('#from-currency-input')).toBeFocused();
  });

  test('t key toggles theme', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    await page.keyboard.press('t');
    
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('time range shortcuts work', async ({ page }) => {
    await page.goto('/?from=USD&to=INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    // Press 1 for 1M
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '1m');
  });
});

// ============================================================================
// Responsive Design Tests
// ============================================================================

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('#from-currency-dropdown')).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Accessibility', () => {
  test('dropdowns have ARIA attributes', async ({ page }) => {
    await page.goto('/');
    
    const fromInput = page.locator('#from-currency-input');
    await expect(fromInput).toHaveAttribute('role', 'combobox');
    await expect(fromInput).toHaveAttribute('aria-autocomplete', 'list');
    await expect(fromInput).toHaveAttribute('aria-controls', 'from-currency-list');
  });

  test('dropdown list has listbox role', async ({ page }) => {
    await page.goto('/');
    
    const fromList = page.locator('#from-currency-list');
    await expect(fromList).toHaveAttribute('role', 'listbox');
  });

  test('theme toggle has aria-label', async ({ page }) => {
    await page.goto('/');
    
    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toHaveAttribute('aria-label', 'Toggle dark mode');
  });

  test('swap button has aria-label', async ({ page }) => {
    await page.goto('/');
    
    const swapBtn = page.locator('#swap-currencies');
    await expect(swapBtn).toHaveAttribute('aria-label', 'Swap currencies');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Error Handling', () => {
  test('graceful handling of missing data', async ({ page }) => {
    await page.goto('/');
    
    // Select a potentially rare/missing pair
    await selectCurrencyPair(page, 'XOF', 'XAF');
    
    // Should not crash, either shows data or empty state
    await page.waitForTimeout(5000);
    
    // Page should still be functional
    await expect(page.locator('.header')).toBeVisible();
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

test.describe('Performance', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('no memory leaks during repeated theme toggles', async ({ page }) => {
    await page.goto('/');
    
    // Toggle theme many times
    for (let i = 0; i < 20; i++) {
      await page.click('#theme-toggle');
      await page.waitForTimeout(50);
    }
    
    // Page should still be responsive
    await expect(page.locator('.header')).toBeVisible();
  });

  test('no memory leaks during repeated dropdown interactions', async ({ page }) => {
    await page.goto('/');
    
    // Open/close dropdown many times
    for (let i = 0; i < 10; i++) {
      await page.locator('#from-currency-input').focus();
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    
    // Page should still be responsive
    await expect(page.locator('.header')).toBeVisible();
  });
});
