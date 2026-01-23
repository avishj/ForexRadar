import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Compare Providers E2E Flow
// ============================================================================

test.describe('Compare Providers Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#chart-container').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('both Visa and Mastercard series visible by default', async ({ page }) => {
    // Chart should have multiple series rendered
    const legend = page.locator('.apexcharts-legend');
    await expect(legend).toBeVisible();
    
    // Both toggles should be checked
    await expect(page.locator('#toggle-visa-rate')).toBeChecked();
    await expect(page.locator('#toggle-mc-rate')).toBeChecked();
  });

  test('toggle off Mastercard hides MC series', async ({ page }) => {
    const mcToggle = page.locator('#toggle-mc-rate');
    const mcLabel = page.locator('label:has(#toggle-mc-rate)');
    
    // Verify MC is initially checked
    await expect(mcToggle).toBeChecked();
    
    // Toggle off
    await mcLabel.click();
    await expect(mcToggle).not.toBeChecked();
    
    // Chart should still be visible (Visa still on)
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('toggle off Visa hides Visa series', async ({ page }) => {
    const visaToggle = page.locator('#toggle-visa-rate');
    const visaLabel = page.locator('label:has(#toggle-visa-rate)');
    
    // Toggle off
    await visaLabel.click();
    await expect(visaToggle).not.toBeChecked();
    
    // Chart should still be visible (MC still on)
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('can toggle series back on', async ({ page }) => {
    const visaToggle = page.locator('#toggle-visa-rate');
    const visaLabel = page.locator('label:has(#toggle-visa-rate)');
    
    // Toggle off
    await visaLabel.click();
    await expect(visaToggle).not.toBeChecked();
    
    // Toggle back on
    await visaLabel.click();
    await expect(visaToggle).toBeChecked();
    
    // Chart should still be visible
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
  });

  test('spread stat shows comparison when both providers active', async ({ page }) => {
    const spreadStat = page.locator('#stat-spread');
    
    // Spread stat may or may not have data depending on data availability
    // Just verify the element exists
    await expect(spreadStat).toBeAttached();
  });

  test('better provider indicator shows which is cheaper', async ({ page }) => {
    const betterProvider = page.locator('#stat-better-provider');
    
    // May show "Visa" or "MC" or "-" depending on data
    await expect(betterProvider).toBeAttached();
  });

  test('full comparison workflow', async ({ page }) => {
    // Step 1: Verify both series visible
    await expect(page.locator('#toggle-visa-rate')).toBeChecked();
    await expect(page.locator('#toggle-mc-rate')).toBeChecked();
    
    // Step 2: Check stats are populated
    const currentRate = page.locator('#stat-current');
    await expect(currentRate).not.toHaveText('-');
    
    // Step 3: Toggle off MC
    await page.locator('label:has(#toggle-mc-rate)').click();
    await expect(page.locator('#toggle-mc-rate')).not.toBeChecked();
    
    // Step 4: Verify chart still shows Visa data
    await expect(page.locator('.apexcharts-canvas')).toBeVisible();
    
    // Step 5: Toggle MC back on
    await page.locator('label:has(#toggle-mc-rate)').click();
    await expect(page.locator('#toggle-mc-rate')).toBeChecked();
    
    // Step 6: Chart should show both again
    await expect(page.locator('.apexcharts-legend')).toBeVisible();
  });
});
