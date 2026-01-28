import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Time Range Selector Tests
// ============================================================================

test.describe('Time Range Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('default selection is 1Y', async ({ page }) => {
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '1y');
  });

  test('clicking 1M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="1m"]');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '1m');
  });

  test('clicking 3M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="3m"]');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '3m');
  });

  test('clicking 6M changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="6m"]');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '6m');
  });

  test('clicking 5Y changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="5y"]');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '5y');
  });

  test('clicking All changes active state', async ({ page }) => {
    await page.click('.time-range-btn[data-range="all"]');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', 'all');
  });

  test('time range persists on reload', async ({ page }) => {
    await page.click('.time-range-btn[data-range="3m"]');
    await expect(page.locator('.time-range-btn[data-range="3m"]')).toHaveClass(/active/);
    
    await page.reload();
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
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
    const checkbox = page.locator('#toggle-visa-rate');
    const label = page.locator('label:has(#toggle-visa-rate)');
    await label.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('unchecking Mastercard Rate toggle works', async ({ page }) => {
    const checkbox = page.locator('#toggle-mc-rate');
    const label = page.locator('label:has(#toggle-mc-rate)');
    await label.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('unchecking ECB Rate toggle works', async ({ page }) => {
    const checkbox = page.locator('#toggle-ecb-rate');
    const label = page.locator('label:has(#toggle-ecb-rate)');
    // ECB toggle may not be visible if no ECB data exists for the pair
    if (await checkbox.isVisible()) {
      await label.click();
      await expect(checkbox).not.toBeChecked();
    }
  });

  test('unchecking Visa Markup toggle works', async ({ page }) => {
    const checkbox = page.locator('#toggle-visa-markup');
    const label = page.locator('label:has(#toggle-visa-markup)');
    await label.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('re-checking toggle works', async ({ page }) => {
    const checkbox = page.locator('#toggle-visa-rate');
    const label = page.locator('label:has(#toggle-visa-rate)');
    
    // Click label to uncheck
    await label.click();
    await expect(checkbox).not.toBeChecked();
    
    // Click label to re-check
    await label.click();
    await expect(checkbox).toBeChecked();
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
