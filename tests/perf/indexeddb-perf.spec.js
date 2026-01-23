// @ts-check
/**
 * IndexedDB Performance Tests (Browser)
 * 
 * These tests measure IndexedDB write and read performance in the browser.
 * Run with: bunx playwright test tests/perf/indexeddb-perf.spec.js
 * 
 * @module tests/perf/indexeddb-perf
 */
import { test, expect } from '@playwright/test';

/**
 * Generate test records for IndexedDB testing
 * @param {number} count - Number of records
 * @returns {import('../../shared/types.js').RateRecord[]}
 */
function generateRecords(count) {
  const records = [];
  const providers = ['VISA', 'MASTERCARD', 'ECB'];
  const targets = ['INR', 'EUR', 'GBP', 'JPY', 'CAD'];
  
  const startDate = new Date('2020-01-01');
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(i / (providers.length * targets.length)));
    
    const dateStr = date.toISOString().slice(0, 10);
    const provider = providers[i % providers.length];
    const toCurr = targets[Math.floor(i / providers.length) % targets.length];
    
    records.push({
      date: dateStr,
      from_curr: 'USD',
      to_curr: toCurr,
      provider,
      rate: 80 + Math.random() * 10,
      markup: provider === 'VISA' ? 0.4 + Math.random() * 0.1 : null
    });
  }
  
  return records;
}

test.describe('Performance: IndexedDB', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Clear IndexedDB before each test
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    });
  });

  test('writes 500 records in < 200ms', async ({ page }) => {
    const records = generateRecords(500);
    
    const duration = await page.evaluate(async (recs) => {
      // Import storage manager dynamically
      const { saveRates, openDB } = await import('/js/storage-manager.js');
      
      // Open DB first
      await openDB();
      
      const start = performance.now();
      await saveRates(recs);
      return performance.now() - start;
    }, records);
    
    console.log(`IndexedDB saveRates(500): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(200);
  });

  test('writes 1000 records in < 400ms', async ({ page }) => {
    const records = generateRecords(1000);
    
    const duration = await page.evaluate(async (recs) => {
      const { saveRates, openDB } = await import('/js/storage-manager.js');
      
      await openDB();
      
      const start = performance.now();
      await saveRates(recs);
      return performance.now() - start;
    }, records);
    
    console.log(`IndexedDB saveRates(1000): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(400);
  });

  test('reads 500 records in < 50ms', async ({ page }) => {
    const records = generateRecords(500);
    
    const duration = await page.evaluate(async (recs) => {
      const { saveRates, getRatesForPair, openDB } = await import('/js/storage-manager.js');
      
      await openDB();
      await saveRates(recs);
      
      const start = performance.now();
      const result = await getRatesForPair('USD', 'INR');
      const end = performance.now();
      
      return { duration: end - start, count: result.length };
    }, records);
    
    console.log(`IndexedDB getRatesForPair: ${duration.duration.toFixed(2)}ms, ${duration.count} records`);
    expect(duration.duration).toBeLessThan(50);
  });

  test('batch write is faster than individual writes', async ({ page }) => {
    const records = generateRecords(100);
    
    const result = await page.evaluate(async (recs) => {
      const { saveRate, saveRates, openDB, clearCache } = await import('/js/storage-manager.js');
      
      await openDB();
      
      // Measure batch write
      const batchStart = performance.now();
      await saveRates(recs);
      const batchDuration = performance.now() - batchStart;
      
      // Clear and measure individual writes
      await clearCache();
      
      const individualStart = performance.now();
      for (const rec of recs) {
        await saveRate(rec);
      }
      const individualDuration = performance.now() - individualStart;
      
      return { batchDuration, individualDuration };
    }, records);
    
    console.log(`Batch write: ${result.batchDuration.toFixed(2)}ms`);
    console.log(`Individual writes: ${result.individualDuration.toFixed(2)}ms`);
    
    // Batch should be significantly faster
    expect(result.batchDuration).toBeLessThan(result.individualDuration);
  });

  test('rateExists lookup is < 10ms', async ({ page }) => {
    const records = generateRecords(500);
    
    const duration = await page.evaluate(async (recs) => {
      const { saveRates, rateExists, openDB } = await import('/js/storage-manager.js');
      
      await openDB();
      await saveRates(recs);
      
      // Measure multiple lookups
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await rateExists('2020-01-05', 'USD', 'INR', 'VISA');
        times.push(performance.now() - start);
      }
      
      return {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times)
      };
    }, records);
    
    console.log(`rateExists: avg=${duration.avg.toFixed(2)}ms, min=${duration.min.toFixed(2)}ms, max=${duration.max.toFixed(2)}ms`);
    expect(duration.avg).toBeLessThan(10);
  });
});
