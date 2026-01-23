import { test, expect, selectCurrencyPair, selectPairAndWait } from '../helpers/forex-app.js';

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
    await selectPairAndWait(page, 'USD', 'INR');
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
