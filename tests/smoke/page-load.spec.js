import { test, expect } from '../helpers/forex-app.js';

test.describe('Page Load & Initial State', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (e.g., network failures, CORS for external resources)
    const criticalErrors = errors.filter(
      (e) => !e.includes('net::ERR') && 
             !e.includes('Failed to load resource') &&
             !e.includes('CORS') &&
             !e.includes('Access-Control-Allow-Origin')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('dark mode is applied by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).not.toHaveClass(/light/);
  });

  test('header displays with logo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.logo-text')).toContainText('Forex Radar');
  });

  test('radar logo has animated rings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.radar-ring-1')).toBeVisible();
    await expect(page.locator('.radar-ring-2')).toBeVisible();
    await expect(page.locator('.radar-ring-3')).toBeVisible();
    await expect(page.locator('.radar-sweep')).toBeVisible();
  });

  test('hero section displays correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.hero-title')).toContainText('Decode the');
    await expect(page.locator('.gradient-text')).toContainText('hidden costs');
  });

  test('hero radar visualization with currency blips', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-radar-visual')).toBeVisible();
    
    // Check currency blips
    const blips = page.locator('.radar-blip');
    await expect(blips).toHaveCount(5);
    await expect(page.locator('[data-currency="EUR"]')).toContainText('€');
    await expect(page.locator('[data-currency="GBP"]')).toContainText('£');
    await expect(page.locator('[data-currency="JPY"]')).toContainText('¥');
    await expect(page.locator('[data-currency="INR"]')).toContainText('₹');
    await expect(page.locator('[data-currency="KRW"]')).toContainText('₩');
  });

  test('empty state exists in DOM', async ({ page }) => {
    // Note: App defaults to USD/INR on fresh load, so empty state will be hidden
    // This test just verifies the empty state element exists and has correct content
    await page.goto('/');
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeAttached();
    await expect(page.locator('.empty-title')).toContainText('Select a currency pair');
  });

  test('currency dropdowns have correct initial state', async ({ page }) => {
    await page.goto('/');
    const fromInput = page.locator('#from-currency-input');
    const toInput = page.locator('#to-currency-input');
    
    await expect(fromInput).toHaveAttribute('placeholder', 'Search currency...');
    await expect(toInput).toHaveAttribute('placeholder', 'Search currency...');
  });

  test('footer displays correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer.footer')).toBeVisible();
    await expect(page.locator('footer.footer')).toContainText('Data sourced from Visa and Mastercard');
  });

  test('theme toggle button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeVisible();
  });

  test('hero stats display', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-stat-number').first()).toContainText('150+');
    await expect(page.locator('.hero-stat-label').first()).toContainText('Currencies');
  });
});
