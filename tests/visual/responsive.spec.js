// @ts-check
import { test, expect, selectPairAndWait, VIEWPORTS } from '../helpers/visual-test.js';

const responsiveViewports = [
  { name: 'mobile', ...VIEWPORTS.mobile },
  { name: 'tablet', ...VIEWPORTS.tablet },
];

for (const vp of responsiveViewports) {
  test.describe(`${vp.name} viewport (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('header matches baseline', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.header')).toHaveScreenshot(`header-${vp.name}.png`);
    });

    test('hero section matches baseline', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.hero')).toHaveScreenshot(`hero-${vp.name}.png`);
    });

    test('selector section matches baseline', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.selector-container')).toHaveScreenshot(`selector-${vp.name}.png`);
    });

    test('stats bar matches baseline', async ({ page }) => {
      await page.goto('/');
      await selectPairAndWait(page, 'EUR', 'INR');
      await expect(page.locator('#stats-bar')).toHaveScreenshot(`stats-${vp.name}.png`);
    });

    test('chart matches baseline', async ({ page }) => {
      await page.goto('/');
      await selectPairAndWait(page, 'EUR', 'INR');
      await expect(page.locator('.apexcharts-series path').first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(300);
      await expect(page.locator('#chart-container')).toHaveScreenshot(`chart-${vp.name}.png`);
    });

    test('footer matches baseline', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('footer')).toHaveScreenshot(`footer-${vp.name}.png`);
    });
  });
}
