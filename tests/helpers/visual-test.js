// @ts-check
import { test as base, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures');

/**
 * Viewport configurations for responsive visual tests.
 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
};

/**
 * Fixed date for visual tests - app will think it's this date.
 * Using mid-December 2025 so we have ~11.5 months of fixture data visible.
 */
export const VISUAL_TEST_DATE = new Date('2025-12-15T12:00:00Z');

/**
 * Intercept CSV requests and serve from fixture directory.
 * Routes /db/{CURR}/{YEAR}.csv to tests/fixtures/db/{CURR}/{YEAR}.csv
 * 
 * @param {import('@playwright/test').Page} page
 */
export async function mockCSVData(page) {
  await page.route('**/db/**/*.csv', async (route) => {
    const url = new URL(route.request().url());
    const pathMatch = url.pathname.match(/\/db\/([A-Z]+)\/(\d+)\.csv$/);
    
    if (!pathMatch) {
      await route.abort('failed');
      return;
    }
    
    const [, currency, year] = pathMatch;
    const fixturePath = join(FIXTURES_DIR, 'db', currency, `${year}.csv`);
    
    if (!existsSync(fixturePath)) {
      await route.fulfill({
        status: 404,
        body: 'Not Found',
      });
      return;
    }
    
    const body = readFileSync(fixturePath, 'utf-8');
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body,
    });
  });
}

/**
 * CSS to disable all animations and transitions for deterministic screenshots.
 */
const DISABLE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
`;

/**
 * Prepare page for visual testing:
 * - Freeze time to VISUAL_TEST_DATE
 * - Disable animations
 * - Mock CSV data from fixtures
 * 
 * @param {import('@playwright/test').Page} page
 */
export async function prepareForVisualTest(page) {
  await page.clock.setFixedTime(VISUAL_TEST_DATE);
  await mockCSVData(page);
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
}

/**
 * Select a currency from the specified dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {'from' | 'to'} side
 * @param {string} code
 */
export async function selectCurrency(page, side, code) {
  const input = page.locator(`#${side}-currency-input`);
  await input.focus();
  await input.fill('');
  const item = page.locator(`#${side}-currency-list .dropdown-item[data-code="${code}"]`);
  await item.waitFor({ state: 'visible', timeout: 10000 });
  await item.click();
}

/**
 * Select a currency pair.
 * @param {import('@playwright/test').Page} page
 * @param {string} fromCode
 * @param {string} toCode
 */
export async function selectCurrencyPair(page, fromCode, toCode) {
  await selectCurrency(page, 'from', fromCode);
  await selectCurrency(page, 'to', toCode);
}

/**
 * Select a currency pair and wait for chart to render.
 * @param {import('@playwright/test').Page} page
 * @param {string} fromCode
 * @param {string} toCode
 */
export async function selectPairAndWait(page, fromCode, toCode) {
  await selectCurrencyPair(page, fromCode, toCode);
  await expect(page.locator('#stats-bar')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.apexcharts-canvas')).toBeVisible({ timeout: 30000 });
}

/**
 * Extended test fixture for visual regression tests.
 * - Clears storage
 * - Freezes time
 * - Disables animations
 * - Mocks CSV data
 */
export const test = base.extend({
  page: async ({ context, page }, use) => {
    await context.clearCookies();
    
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.clock.setFixedTime(VISUAL_TEST_DATE);
    await mockCSVData(page);
    
    await page.addInitScript((css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }, DISABLE_ANIMATIONS_CSS);
    
    await use(page);
  },
});

export { expect };
