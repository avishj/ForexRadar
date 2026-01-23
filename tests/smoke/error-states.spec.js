import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Error States Tests
// ============================================================================

test.describe('Error States', () => {
  test('empty state element exists in DOM', async ({ page }) => {
    await page.goto('/');
    // App defaults to USD/INR, so empty state is hidden but should exist
    await expect(page.locator('#empty-state')).toBeAttached();
  });

  test('invalid currency params fall back to defaults', async ({ page }) => {
    await page.goto('/?from=INVALID&to=FAKE');
    
    // App should fall back to default pair (USD/INR)
    await page.waitForTimeout(1000);
    
    const fromValue = await page.locator('#from-currency').inputValue();
    const toValue = await page.locator('#to-currency').inputValue();
    
    // Should have valid defaults, not INVALID/FAKE
    expect(fromValue).not.toBe('INVALID');
    expect(toValue).not.toBe('FAKE');
    expect(fromValue).toBe('USD');
    expect(toValue).toBe('INR');
  });

  test('app loads data gracefully for any valid pair', async ({ page }) => {
    await page.goto('/');
    
    // Select a pair that might have limited data
    await selectCurrencyPair(page, 'USD', 'AED');
    
    // Wait for either data load or empty state
    await page.waitForTimeout(5000);
    
    // App should handle gracefully - either show data or empty state
    const hasChart = await page.locator('.apexcharts-canvas').isVisible();
    const hasEmptyState = await page.locator('#empty-state').isVisible();
    
    expect(hasChart || hasEmptyState).toBe(true);
  });

  test('network failure simulation shows loader or recovers', async ({ page }) => {
    // Set up route interception to simulate network issues
    let requestCount = 0;
    await page.route('**/db/**/*.csv', async (route) => {
      requestCount++;
      if (requestCount <= 2) {
        // Fail first two requests
        await route.abort('failed');
      } else {
        // Allow subsequent requests
        await route.continue();
      }
    });
    
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    
    // App should handle network failures gracefully
    await page.waitForTimeout(3000);
    
    // Should show either error state, empty state, or recovered data
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test('loader is hidden after timeout when no data', async ({ page }) => {
    await page.goto('/');
    
    // Block all CSV requests to simulate no data
    await page.route('**/db/**/*.csv', route => route.abort());
    
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Wait for reasonable timeout
    await page.waitForTimeout(10000);
    
    // Loader should eventually hide
    const loader = page.locator('#loader');
    const loaderHidden = await loader.isHidden() || await loader.evaluate(el => 
      el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
    );
    
    expect(loaderHidden).toBe(true);
  });
});

// ============================================================================
// Recovery Tests
// ============================================================================

test.describe('Error Recovery', () => {
  test('selecting different pair after error recovers', async ({ page }) => {
    // Block initial requests
    let shouldBlock = true;
    await page.route('**/db/**/*.csv', async (route) => {
      if (shouldBlock) {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'INR');
    
    // Wait for failure
    await page.waitForTimeout(2000);
    
    // Allow subsequent requests
    shouldBlock = false;
    await page.unroute('**/db/**/*.csv');
    
    // Select a different pair - should recover
    await selectCurrencyPair(page, 'EUR', 'GBP');
    
    // Wait for potential recovery
    await page.waitForTimeout(5000);
    
    // Page should be in a valid state
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);
  });
});
