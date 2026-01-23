import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// URL State & Navigation Tests
// ============================================================================

test.describe('URL State & Navigation', () => {
  test('URL updates when selecting currencies', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    
    // Wait for URL to update (state-based)
    await expect(page).toHaveURL(/from=USD/);
    await expect(page).toHaveURL(/to=INR/);
  });

  test('loading URL with query params sets currencies', async ({ page }) => {
    // Use USD/INR which is known to have data
    await page.goto('/?from=USD&to=INR');
    
    await page.locator('#stats-bar').waitFor({ state: 'visible', timeout: 30000 });
    
    const fromValue = await page.locator('#from-currency').inputValue();
    const toValue = await page.locator('#to-currency').inputValue();
    
    expect(fromValue).toBe('USD');
    expect(toValue).toBe('INR');
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

  test('/ key focuses search', async ({ page }) => {
    await page.goto('/');
    // Click body to ensure focus is on the page
    await page.locator('body').click();
    await page.keyboard.press('/');
    
    // From input should be focused
    await expect(page.locator('#from-currency-input')).toBeFocused();
  });

  test('s key triggers swap', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Click body to ensure focus is on the page
    await page.locator('body').click();
    await page.keyboard.press('s');
    
    // Values should be swapped (state-based wait)
    await expect(page.locator('#from-currency')).toHaveValue('EUR');
    await expect(page.locator('#to-currency')).toHaveValue('USD');
  });

  test('time range shortcuts work', async ({ page }) => {
    await page.goto('/?from=USD&to=INR');
    await page.locator('#time-range-selector').waitFor({ state: 'visible', timeout: 30000 });
    
    // Press 1 for 1M
    await page.keyboard.press('1');
    
    // Wait for button to become active (state-based)
    await expect(page.locator('.time-range-btn[data-range="1m"]')).toHaveClass(/active/);
  });
});
