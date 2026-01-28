import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// URL State Persistence Tests
// ============================================================================

test.describe('URL State - Currency Pair', () => {
  test('URL params pre-select currency pair', async ({ page }) => {
    await page.goto('/?from=EUR&to=GBP');
    
    // Wait for dropdowns to initialize
    await page.waitForTimeout(1000);
    
    // Check that currencies are pre-selected
    const fromInput = page.locator('#from-currency');
    const toInput = page.locator('#to-currency');
    
    await expect(fromInput).toHaveValue('EUR');
    await expect(toInput).toHaveValue('GBP');
  });

  test('selecting pair updates URL', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    
    // Wait for URL to update
    await page.waitForTimeout(1000);
    
    const url = page.url();
    expect(url).toContain('from=USD');
    expect(url).toContain('to=INR');
  });

  test('URL state persists on reload', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'GBP', 'JPY');
    
    // Wait for data and URL update
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    
    // Wait for URL to update
    await page.waitForTimeout(500);
    
    // Get the current URL (should have from=GBP&to=JPY)
    const urlBefore = page.url();
    expect(urlBefore).toContain('from=GBP');
    expect(urlBefore).toContain('to=JPY');
    
    // Reload page - URL params should restore state
    await page.reload();
    
    // Wait for initialization
    await page.waitForTimeout(1000);
    
    // Check values are preserved via URL params
    const fromInput = page.locator('#from-currency');
    const toInput = page.locator('#to-currency');
    
    await expect(fromInput).toHaveValue('GBP');
    await expect(toInput).toHaveValue('JPY');
  });
});

// ============================================================================
// URL State - Time Range
// ============================================================================

test.describe('URL State - Time Range', () => {
  test('range param sets time range', async ({ page }) => {
    await page.goto('/?from=USD&to=INR&range=3m');
    
    // Wait for data to load
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    // Check that 3m is active
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '3m');
  });

  test('clicking time range updates URL', async ({ page }) => {
    await page.goto('/?from=USD&to=INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    await page.click('.time-range-btn[data-range="6m"]');
    
    // Wait for URL update
    await page.waitForTimeout(500);
    
    const url = page.url();
    expect(url).toContain('range=6m');
  });

  test('time range persists on reload via URL', async ({ page }) => {
    await page.goto('/?from=USD&to=EUR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    await page.click('.time-range-btn[data-range="1m"]');
    await page.waitForTimeout(500);
    
    await page.reload();
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '1m');
  });
});

// ============================================================================
// URL State - Invalid Parameters
// ============================================================================

test.describe('URL State - Invalid Parameters', () => {
  test('invalid from currency falls back to default', async ({ page }) => {
    await page.goto('/?from=INVALID&to=EUR');
    
    await page.waitForTimeout(1000);
    
    // App falls back to defaults when ANY invalid currency provided
    const fromInput = page.locator('#from-currency');
    const value = await fromInput.inputValue();
    
    // Should not be 'INVALID', should be USD (default)
    expect(value).not.toBe('INVALID');
    expect(value).toBe('USD');
  });

  test('invalid to currency falls back to default', async ({ page }) => {
    await page.goto('/?from=USD&to=FAKE');
    
    await page.waitForTimeout(1000);
    
    // App falls back to defaults when ANY invalid currency provided
    const toInput = page.locator('#to-currency');
    const value = await toInput.inputValue();
    
    expect(value).not.toBe('FAKE');
    expect(value).toBe('INR');
  });

  test('invalid range falls back to default', async ({ page }) => {
    await page.goto('/?from=USD&to=INR&range=invalid');
    
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    // Should fall back to default (1y)
    const activeBtn = page.locator('.time-range-btn.btn--active');
    const range = await activeBtn.getAttribute('data-range');
    
    // Should be a valid range, not 'invalid'
    expect(['1m', '3m', '6m', '1y', '5y', 'all']).toContain(range);
  });

  test('missing params use default pair', async ({ page }) => {
    await page.goto('/');
    
    // Without params, app defaults to USD/INR and loads data
    await page.waitForTimeout(1000);
    
    const fromValue = await page.locator('#from-currency').inputValue();
    const toValue = await page.locator('#to-currency').inputValue();
    
    expect(fromValue).toBe('USD');
    expect(toValue).toBe('INR');
  });
});

// ============================================================================
// URL State - Shareable Links
// ============================================================================

test.describe('URL State - Shareable Links', () => {
  test('complete URL state is shareable', async ({ page }) => {
    // Set up a complete state via URL
    await page.goto('/?from=EUR&to=JPY&range=6m');
    
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    // Verify all state is applied
    await expect(page.locator('#from-currency')).toHaveValue('EUR');
    await expect(page.locator('#to-currency')).toHaveValue('JPY');
    
    const activeBtn = page.locator('.time-range-btn.btn--active');
    await expect(activeBtn).toHaveAttribute('data-range', '6m');
  });

  test('share button copies current URL', async ({ page, browserName }) => {
    if (browserName !== 'firefox') {
      await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
    }
    
    await page.goto('/?from=USD&to=INR');
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    
    await page.click('#share-url-btn');
    
    // Notification should appear
    const notification = page.locator('#notification-container .notification').filter({ hasText: 'Link copied' });
    await expect(notification).toBeVisible({ timeout: 5000 });
  });
});
