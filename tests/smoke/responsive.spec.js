import { test, expect } from '../helpers/forex-app.js';

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('#from-currency-dropdown')).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });
});
