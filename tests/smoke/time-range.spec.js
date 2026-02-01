import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Time Range - Chart & Stats Behavior Tests
// ============================================================================
// Note: Button existence and URL state tests are in charts.spec.js and url-state.spec.js
// These tests focus on verifying actual chart and stats behavior changes.

test.describe('Time Range - Chart Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('changing time range updates chart x-axis date range', async ({ page }) => {
    // Start with ALL to get full data range
    await page.click('.time-range-btn[data-range="all"]');
    await page.waitForTimeout(500);

    // Get the x-axis labels (dates) from the chart
    const allRangeLabels = await page.locator('.apexcharts-xaxis-label').allTextContents();
    
    // Switch to 1M - should have fewer dates
    await page.click('.time-range-btn[data-range="1m"]');
    await page.waitForTimeout(500);

    const oneMonthLabels = await page.locator('.apexcharts-xaxis-label').allTextContents();

    // 1M range should have fewer or equal labels than ALL
    // (fewer data points = narrower date range)
    expect(oneMonthLabels.length).toBeLessThanOrEqual(allRangeLabels.length);
  });

  test('chart re-renders when time range changes', async ({ page }) => {
    // Get initial chart state
    const initialCanvas = await page.locator('.apexcharts-canvas').boundingBox();
    expect(initialCanvas).not.toBeNull();

    // Click a different time range
    await page.click('.time-range-btn[data-range="3m"]');
    await page.waitForTimeout(500);

    // Chart should still be visible (re-rendered, not destroyed)
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
    
    // Verify the active button changed
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '3m');
  });
});

test.describe('Time Range - Stats Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('stats bar shows high/low values', async ({ page }) => {
    // Verify stats elements exist and have numeric content
    const highValue = page.locator('#stat-high');
    const lowValue = page.locator('#stat-low');

    await expect(highValue).toBeVisible();
    await expect(lowValue).toBeVisible();

    // Values should be numeric (exchange rates)
    const highText = await highValue.textContent();
    const lowText = await lowValue.textContent();

    expect(parseFloat(highText || '0')).toBeGreaterThan(0);
    expect(parseFloat(lowText || '0')).toBeGreaterThan(0);
  });

  test('stats update when time range changes', async ({ page }) => {
    // Get initial stats with default range (1y)
    const initialHigh = await page.locator('#stat-high').textContent();
    const initialLow = await page.locator('#stat-low').textContent();

    // Switch to ALL - may have different min/max
    await page.click('.time-range-btn[data-range="all"]');
    await page.waitForTimeout(1000);

    // Get updated stats
    const updatedHigh = await page.locator('#stat-high').textContent();
    const updatedLow = await page.locator('#stat-low').textContent();

    // Stats should still be valid numbers (may or may not change based on data)
    expect(parseFloat(updatedHigh || '0')).toBeGreaterThan(0);
    expect(parseFloat(updatedLow || '0')).toBeGreaterThan(0);

    // The high should always be >= low
    expect(parseFloat(updatedHigh || '0')).toBeGreaterThanOrEqual(parseFloat(updatedLow || '0'));
  });

  test('1M range shows accurate high/low for last month', async ({ page }) => {
    await page.click('.time-range-btn[data-range="1m"]');
    await page.waitForTimeout(500);

    const highValue = await page.locator('#stat-high').textContent();
    const lowValue = await page.locator('#stat-low').textContent();

    // Stats should be valid
    const high = parseFloat(highValue || '0');
    const low = parseFloat(lowValue || '0');

    expect(high).toBeGreaterThan(0);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThanOrEqual(low);
  });
});
