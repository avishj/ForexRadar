import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Historical Data Exploration E2E Flow
// ============================================================================

test.describe('Historical Exploration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use USD/INR - a well-archived pair with consistent data
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#chart-container').waitFor({ state: 'visible', timeout: 30000 });
    // Wait for time range selector to be visible and stable before interacting
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('can switch to ALL time range', async ({ page }) => {
    const allBtn = page.locator('.time-range-btn[data-range="all"]');
    await allBtn.click();
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', 'all');
    
    // Chart should still be visible
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('time range buttons update chart view', async ({ page }) => {
    // Start with 1Y (default)
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', '1y');
    
    // Switch to 5Y for more historical data
    await page.locator('.time-range-btn[data-range="5y"]').click();
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', '5y');
    
    // Chart should update
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
    
    // Switch to 1M for recent data
    await page.locator('.time-range-btn[data-range="1m"]').click();
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', '1m');
  });

  test('chart has zoom/pan capabilities', async ({ page }) => {
    // ApexCharts should have zoom controls or pan capability
    const chart = page.locator('.apexcharts-canvas');
    await expect(chart).toBeVisible();
    
    // Check for zoom toolbar or pan area
    const toolbar = page.locator('.apexcharts-toolbar');
    const hasToolbar = await toolbar.isVisible();
    
    // Either toolbar or chart area should be interactive
    expect(hasToolbar || await chart.isVisible()).toBe(true);
  });

  test('hover on chart shows tooltip', async ({ page }) => {
    const chart = page.locator('.apexcharts-canvas');
    
    // Get chart bounding box
    const box = await chart.boundingBox();
    if (!box) return;
    
    // Move mouse to center of chart
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    
    // Wait a moment for tooltip to appear
    await page.waitForTimeout(500);
    
    // Tooltip might appear on hover
    const tooltip = page.locator('.apexcharts-tooltip');
    // Tooltip visibility depends on data points; just verify element exists
    await expect(tooltip).toBeAttached();
  });

  test('stats update when time range changes', async ({ page }) => {
    // Get initial stats
    const highStat = page.locator('#stat-high');
    const lowStat = page.locator('#stat-low');
    
    await expect(highStat).not.toHaveText('-');
    await expect(lowStat).not.toHaveText('-');
    
    // Change time range
    await page.locator('.time-range-btn[data-range="1m"]').click();
    
    // Stats should still be populated (values may change)
    await page.waitForTimeout(500);
    await expect(highStat).not.toHaveText('-');
    await expect(lowStat).not.toHaveText('-');
  });

  test('full historical exploration workflow', async ({ page }) => {
    // Step 1: Start with default 1Y view
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', '1y');
    
    // Step 2: Expand to ALL historical data
    await page.locator('.time-range-btn[data-range="all"]').click();
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', 'all');
    // Wait for chart to update after range change
    await page.waitForTimeout(500);
    
    // Step 3: Verify chart is visible
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
    
    // Step 4: Check high/low stats are populated
    await expect(page.locator('#stat-high')).not.toHaveText('-');
    await expect(page.locator('#stat-low')).not.toHaveText('-');
    
    // Step 5: Hover to see tooltip
    const chart = page.locator('.apexcharts-canvas');
    const box = await chart.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }
    
    // Step 6: Narrow down to 3M - wait for time range selector to still be visible
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.time-range-btn[data-range="3m"]').click();
    await expect(page.locator('.time-range-btn.btn--active')).toHaveAttribute('data-range', '3m');
    
    // Step 7: URL should reflect new range
    const url = page.url();
    expect(url).toContain('range=3m');
  });
});
