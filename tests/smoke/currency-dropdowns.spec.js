import { test, expect, selectCurrencyPair } from '../helpers/forex-app.js';

// ============================================================================
// Currency Dropdowns Tests
// ============================================================================

test.describe('Currency Dropdowns', () => {
  test('dropdown does not pre-render options before interaction', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#from-currency-list .dropdown-item')).toHaveCount(0);
    await expect(page.locator('#to-currency-list .dropdown-item')).toHaveCount(0);
  });

  test('dropdown opens on input focus', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    await expect(fromList).not.toBeVisible();
    await fromInput.focus();
    await expect(fromList).toBeVisible();
  });

  test('dropdown shows popular currencies first', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    // Clear any default value to see full list
    await fromInput.focus();
    await fromInput.fill('');
    await page.waitForSelector('#from-currency-list .dropdown-item');
    
    const popularHeader = page.locator('#from-currency-list .dropdown-group-header').first();
    await expect(popularHeader).toContainText('★ Popular');
    
    // Check popular currencies are present
    const items = page.locator('#from-currency-list .dropdown-item');
    await expect(items.first()).toBeVisible();
  });

  test('typing filters currencies correctly', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.focus();
    await fromInput.fill('ind');
    
    // Should show INR - Indian Rupee
    const item = page.locator('#from-currency-list .dropdown-item').filter({ hasText: 'INR' });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Indian Rupee');
  });

  test('matching text is highlighted with mark tags', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.focus();
    await fromInput.fill('eur');
    
    const mark = page.locator('#from-currency-list .dropdown-item mark');
    await expect(mark.first()).toBeVisible();
  });

  test('no results message shows for invalid search', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    await fromInput.fill('xyz123invalidcurrency');
    
    await expect(page.locator('.dropdown-no-results')).toBeVisible();
    await expect(page.locator('.dropdown-no-results')).toContainText('No currencies found');
  });

  test('selecting currency updates input value', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    
    await expect(fromInput).toHaveValue(/EUR – Euro/);
  });

  test('clear button appears after selection', async ({ page }) => {
    await page.goto('/');
    const fromDropdown = page.locator('#from-currency-dropdown');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    
    await expect(fromDropdown.locator('.clear-btn')).toBeVisible();
  });

  test('clear button clears selection', async ({ page }) => {
    await page.goto('/');
    const fromDropdown = page.locator('#from-currency-dropdown');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="EUR"]').click();
    await expect(fromInput).toHaveValue(/EUR/);
    
    await fromDropdown.locator('.clear-btn').click();
    await expect(fromInput).toHaveValue('');
  });

  test('keyboard navigation with arrow keys', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await page.keyboard.press('ArrowDown');
    
    const highlighted = fromList.locator('.dropdown-item.highlighted');
    await expect(highlighted).toBeVisible();
  });

  test('Enter key selects highlighted item', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Should have selected a currency
    await expect(fromInput).not.toHaveValue('');
  });

  test('Escape key closes dropdown', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    await fromInput.focus();
    await expect(fromList).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(fromList).not.toBeVisible();
  });

  test('tab closes dropdown and preserves value', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const fromList = page.locator('#from-currency-list');
    
    // Clear input to see all options
    await fromInput.focus();
    await fromInput.fill('');
    await fromList.locator('.dropdown-item[data-code="GBP"]').click();
    await expect(fromInput).toHaveValue(/GBP/);
    
    await fromInput.focus();
    await page.keyboard.press('Tab');
    
    // Value should be preserved
    await expect(fromInput).toHaveValue(/GBP/);
  });
});

// ============================================================================
// Swap Currencies Tests
// ============================================================================

test.describe('Swap Currencies', () => {
  test('swap button swaps currency values', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Get initial values
    const fromBefore = await page.locator('#from-currency').inputValue();
    const toBefore = await page.locator('#to-currency').inputValue();
    
    expect(fromBefore).toBe('USD');
    expect(toBefore).toBe('EUR');
    
    // Click swap
    await page.click('#swap-currencies');
    
    // Check values swapped (state-based wait)
    await expect(page.locator('#from-currency')).toHaveValue('EUR');
    await expect(page.locator('#to-currency')).toHaveValue('USD');
  });

  test('swap button has animation class during swap', async ({ page }) => {
    await page.goto('/');
    await selectCurrencyPair(page, 'USD', 'EUR');
    
    // Start watching for class before clicking
    const swapButton = page.locator('#swap-currencies');
    await swapButton.click();
    
    // Class should be added (might be transient)
    await expect(swapButton).toHaveClass(/swapping/);
  });
});
