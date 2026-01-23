import { test, expect } from '../helpers/forex-app.js';

test.describe('Theme Toggle', () => {
  test('clicking toggle switches to light mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    await page.click('#theme-toggle');
    
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('clicking toggle again switches back to dark mode', async ({ page }) => {
    await page.goto('/');
    
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/light/);
    
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('theme persists on reload', async ({ browser }) => {
    // Use fresh context WITHOUT storage clearing to test persistence
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('/');
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveClass(/light/);
    
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/light/);
    
    await context.close();
  });

  test('themechange event fires without error', async ({ page }) => {
    await page.goto('/');
    
    const eventFired = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('themechange', (e) => {
          // @ts-ignore
          resolve(e.detail?.theme);
        }, { once: true });
        document.getElementById('theme-toggle')?.click();
      });
    });
    
    expect(eventFired).toBe('light');
  });
});
