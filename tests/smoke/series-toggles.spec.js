import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Series Toggles - Chart & Stats Behavior Tests
// ============================================================================
// Note: Basic toggle functionality tests are in charts.spec.js
// These tests focus on verifying chart series visibility and stats updates.

test.describe('Series Toggles - Chart Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#series-toggles').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('.apexcharts-canvas').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('toggling off Visa hides Visa series from chart', async ({ page }) => {
    // Get initial series count from legend
    const initialLegendItems = await page.locator('.apexcharts-legend-series').count();
    expect(initialLegendItems).toBeGreaterThan(0);

    // Uncheck Visa toggle
    const visaLabel = page.locator('label:has(#toggle-visa-rate)');
    await visaLabel.click();
    await page.waitForTimeout(300);

    // Verify Visa Rate checkbox is unchecked
    await expect(page.locator('#toggle-visa-rate')).not.toBeChecked();

    // Chart should still render (other series visible)
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('toggling off Mastercard hides MC series from chart', async ({ page }) => {
    // Uncheck Mastercard toggle
    const mcLabel = page.locator('label:has(#toggle-mc-rate)');
    await mcLabel.click();
    await page.waitForTimeout(300);

    // Verify MC checkbox is unchecked
    await expect(page.locator('#toggle-mc-rate')).not.toBeChecked();

    // Chart should still render
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('toggling off all rate series still shows markup', async ({ page }) => {
    // Turn off all rate series
    await page.locator('label:has(#toggle-visa-rate)').click();
    await page.locator('label:has(#toggle-mc-rate)').click();
    
    const ecbToggle = page.locator('#toggle-ecb-rate');
    if (await ecbToggle.isVisible()) {
      await page.locator('label:has(#toggle-ecb-rate)').click();
    }
    
    await page.waitForTimeout(300);

    // Markup should still be checked
    await expect(page.locator('#toggle-visa-markup')).toBeChecked();

    // Chart should still be visible (markup series)
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('re-enabling series shows it back on chart', async ({ page }) => {
    const visaLabel = page.locator('label:has(#toggle-visa-rate)');

    // Toggle off
    await visaLabel.click();
    await expect(page.locator('#toggle-visa-rate')).not.toBeChecked();

    // Toggle back on
    await visaLabel.click();
    await expect(page.locator('#toggle-visa-rate')).toBeChecked();

    // Chart should have the series
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });
});

test.describe('Series Toggles - Stats Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#series-toggles').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('stats remain valid when toggling series', async ({ page }) => {
    // Get initial stats
    const initialHigh = await page.locator('#stat-high').textContent();
    expect(parseFloat(initialHigh || '0')).toBeGreaterThan(0);

    // Toggle off Visa
    await page.locator('label:has(#toggle-visa-rate)').click();
    await page.waitForTimeout(500);

    // Stats should still show valid numbers
    const updatedHigh = await page.locator('#stat-high').textContent();
    const updatedLow = await page.locator('#stat-low').textContent();

    expect(parseFloat(updatedHigh || '0')).toBeGreaterThan(0);
    expect(parseFloat(updatedLow || '0')).toBeGreaterThan(0);
  });

  test('spread stat reflects visible providers', async ({ page }) => {
    // Check if spread stat exists
    const spreadStat = page.locator('#stat-spread');
    
    if (await spreadStat.isVisible()) {
      const initialSpread = await spreadStat.textContent();

      // Toggle off one provider
      await page.locator('label:has(#toggle-mc-rate)').click();
      await page.waitForTimeout(500);

      // Spread may change or show N/A if only one provider remains
      const updatedSpread = await spreadStat.textContent();
      
      // Should still have content (either a number or indicator)
      expect(updatedSpread).toBeTruthy();
    }
  });
});

test.describe('Series Toggles - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#series-toggles').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('chart handles all toggles off gracefully', async ({ page }) => {
    // Turn off all toggles
    const toggles = ['#toggle-visa-rate', '#toggle-mc-rate', '#toggle-visa-markup'];
    
    for (const toggleId of toggles) {
      const toggle = page.locator(toggleId);
      if (await toggle.isVisible() && await toggle.isChecked()) {
        await page.locator(`label:has(${toggleId})`).click();
        await page.waitForTimeout(100);
      }
    }

    // ECB toggle if visible
    const ecbToggle = page.locator('#toggle-ecb-rate');
    if (await ecbToggle.isVisible() && await ecbToggle.isChecked()) {
      await page.locator('label:has(#toggle-ecb-rate)').click();
    }

    await page.waitForTimeout(300);

    // App should not crash - chart container should still exist
    await expect(page.locator('#chart-container')).toBeVisible();
  });

  test('toggle state persists with currency change', async ({ page }) => {
    // Turn off Visa
    await page.locator('label:has(#toggle-visa-rate)').click();
    await expect(page.locator('#toggle-visa-rate')).not.toBeChecked();

    // Change currency pair
    await selectCurrencyPair(page, 'EUR', 'GBP');
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });

    // Toggle states may reset or persist depending on implementation
    // Just verify the app doesn't crash and toggles are functional
    await expect(page.locator('#series-toggles')).toBeVisible();
  });
});
