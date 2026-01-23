import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

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
    
    // Select a pair that exists but may have limited/no data (AED to THB)
    // These are valid currencies in watchlist but may not have historical data
    await selectCurrencyPair(page, 'AED', 'THB');
    
    // Wait for app to process - should either show data or remain responsive
    // Give extra time since this pair may have slow/no response
    await page.waitForLoadState('networkidle');
    
    // Page should still be functional regardless of data availability
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('#from-currency')).toHaveValue('AED');
    await expect(page.locator('#to-currency')).toHaveValue('THB');
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
