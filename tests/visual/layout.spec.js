// @ts-check
import { test, expect, selectPairAndWait, VIEWPORTS } from '../helpers/visual-test.js';

test.describe('Desktop Layout Visual Tests', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('header matches baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header')).toHaveScreenshot('header-desktop.png');
  });

  test('hero section matches baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toHaveScreenshot('hero-desktop.png');
  });

  test('selector section matches baseline', async ({ page }) => {
    await page.goto('/');
    // Wait for dropdown lists to be populated
    await expect(page.locator('#from-currency-list .dropdown-item').first()).toBeAttached({ timeout: 10000 });
    await page.waitForTimeout(100);
    await expect(page.locator('.selector-container')).toHaveScreenshot('selector-desktop.png');
  });

  test('stats bar matches baseline', async ({ page }) => {
    await page.goto('/');
    await selectPairAndWait(page, 'EUR', 'INR');
    await expect(page.locator('#stats-bar')).toHaveScreenshot('stats-desktop.png');
  });

  test('chart matches baseline', async ({ page }) => {
    await page.goto('/');
    await selectPairAndWait(page, 'EUR', 'INR');
    // Wait for chart series to render (SVG paths)
    await expect(page.locator('.apexcharts-series path').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await expect(page.locator('#chart-container')).toHaveScreenshot('chart-desktop.png');
  });

  test('footer matches baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toHaveScreenshot('footer-desktop.png');
  });
});
