// @ts-check
import { test as base, expect } from '@playwright/test';

/**
 * Shared test utilities for ForexRadar UI tests.
 * @module helpers/forex-app
 */

/**
 * Select a currency from the specified dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {'from' | 'to'} side - Which dropdown to use
 * @param {string} code - Currency code (e.g., 'USD', 'EUR')
 */
export async function selectCurrency(page, side, code) {
  const input = page.locator(`#${side}-currency-input`);
  await input.focus();
  await input.fill('');
  await page.click(`#${side}-currency-list .dropdown-item[data-code="${code}"]`);
}

/**
 * Select a currency pair.
 * @param {import('@playwright/test').Page} page
 * @param {string} fromCode - Source currency code
 * @param {string} toCode - Target currency code
 */
export async function selectCurrencyPair(page, fromCode, toCode) {
  await selectCurrency(page, 'from', fromCode);
  await selectCurrency(page, 'to', toCode);
}

/**
 * Select a currency pair and wait for data to load.
 * @param {import('@playwright/test').Page} page
 * @param {string} fromCode - Source currency code
 * @param {string} toCode - Target currency code
 */
export async function selectPairAndWait(page, fromCode, toCode) {
  await selectCurrencyPair(page, fromCode, toCode);
  await expect(page.locator('#stats-bar')).toBeVisible({ timeout: 30000 });
}

/**
 * Extended test fixture that ensures fresh environment per test.
 * Clears cookies and storage before each test to guarantee atomicity.
 */
export const test = base.extend({
  page: async ({ context, page }, use) => {
    await context.clearCookies();
    
    // Clear storage BEFORE the app loads (via init script)
    // This is critical because the app reads localStorage during boot
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await use(page);
  },
});

export { expect };
