// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for ForexRadar performance tests.
 * These tests measure browser-based performance (IndexedDB, rendering, etc.)
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './perf',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // Run sequentially for consistent perf measurements
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for perf tests
  workers: 1, // Single worker for consistent measurements
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60000, // Longer timeout for perf tests
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off', // Disable tracing for perf tests
    screenshot: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'bun run preview -- --host --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
