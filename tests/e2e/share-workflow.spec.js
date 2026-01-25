import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Share Workflow E2E Flow
// ============================================================================

test.describe('Share Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use USD/INR - a well-archived pair with consistent data
    await selectCurrencyPair(page, 'USD', 'INR');
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    // Wait for time range selector to be visible and stable before interacting
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('share button is visible after data loads', async ({ page }) => {
    await expect(page.locator('#share-url-btn')).toBeVisible();
  });

  test('share button copies URL to clipboard', async ({ page, browserName }) => {
    if (browserName !== 'firefox') {
      await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    }
    
    await page.click('#share-url-btn');
    
    // Notification should appear
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'Link copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('URL contains current state', async ({ page }) => {
    // Wait for URL to update after data loads
    await page.waitForTimeout(500);
    
    const url = page.url();
    
    expect(url).toContain('from=USD');
    expect(url).toContain('to=INR');
  });

  test('shared URL loads same state in new tab', async ({ page }) => {
    // Change time range to make state more specific
    await page.locator('.time-range-btn[data-range="6m"]').click();
    await page.waitForTimeout(500);
    
    // Get current URL
    const shareUrl = page.url();
    expect(shareUrl).toContain('from=USD');
    expect(shareUrl).toContain('to=INR');
    expect(shareUrl).toContain('range=6m');
    
    // Navigate to the shared URL (simulates opening link)
    await page.goto(shareUrl);
    
    // Wait for data to load
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify same state is restored from URL
    await expect(page.locator('#from-currency')).toHaveValue('USD');
    await expect(page.locator('#to-currency')).toHaveValue('INR');
    
    const activeBtn = page.locator('.time-range-btn.active');
    await expect(activeBtn).toHaveAttribute('data-range', '6m');
  });

  test('download button downloads chart image', async ({ page }) => {
    // Ensure chart is loaded before download
    await page.locator('.apexcharts-canvas').waitFor({ state: 'visible', timeout: 30000 });
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('#download-chart-btn');
    
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    
    expect(filename).toContain('forex-USD-INR');
    expect(filename).toMatch(/\.(png|jpg|jpeg|svg)$/i);
  });

  test('copy rate button copies current rate', async ({ page, browserName }) => {
    if (browserName !== 'firefox') {
      await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    }
    
    await page.click('#copy-rate-btn');
    
    // Notification should appear
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('full share workflow', async ({ page, browserName }) => {
    // Step 1: Set up specific view state
    await page.locator('.time-range-btn[data-range="3m"]').click();
    await page.waitForTimeout(500);
    
    // Step 2: Verify URL has state
    let url = page.url();
    expect(url).toContain('from=USD');
    expect(url).toContain('to=INR');
    expect(url).toContain('range=3m');
    
    // Step 3: Click share button
    if (browserName !== 'firefox') {
      await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    }
    await page.locator('#share-url-btn').click();
    
    // Step 4: Verify notification appears
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'Link copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
    
    // Step 5: Navigate to shared URL (simulate recipient opening link)
    const shareUrl = page.url();
    await page.goto(shareUrl);
    
    // Step 6: Verify state is restored from URL
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#from-currency')).toHaveValue('USD');
    await expect(page.locator('#to-currency')).toHaveValue('INR');
    await expect(page.locator('.time-range-btn.active')).toHaveAttribute('data-range', '3m');
  });
});
