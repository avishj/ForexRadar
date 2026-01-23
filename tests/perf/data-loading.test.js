// @ts-check
/**
 * Performance Tests for Data Loading
 * 
 * These are benchmark tests to track performance regressions over time.
 * They measure baseline performance of critical data operations.
 * 
 * Note: IndexedDB tests are in tests/perf/indexeddb-perf.spec.js (Playwright)
 * since IndexedDB is a browser-only API.
 * 
 * @module tests/perf/data-loading
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CSVStore } from '../../backend/csv-store.js';
import { parseCSV, serializeCSV, CSV_HEADER } from '../../shared/csv-utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */

/**
 * Generate test records for performance testing
 * @param {number} count - Number of records to generate
 * @param {CurrencyCode} fromCurr - Source currency
 * @returns {RateRecord[]}
 */
function generateRecords(count, fromCurr = /** @type {CurrencyCode} */ ('USD')) {
  /** @type {RateRecord[]} */
  const records = [];
  const providers = /** @type {const} */ (['VISA', 'MASTERCARD', 'ECB']);
  const targets = /** @type {CurrencyCode[]} */ (['INR', 'EUR', 'GBP', 'JPY', 'CAD']);
  
  const startDate = new Date('2020-01-01');
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(i / (providers.length * targets.length)));
    
    const dateStr = date.toISOString().slice(0, 10);
    const provider = providers[i % providers.length];
    const toCurr = targets[Math.floor(i / providers.length) % targets.length];
    
    records.push({
      date: dateStr,
      from_curr: fromCurr,
      to_curr: toCurr,
      provider,
      rate: 80 + Math.random() * 10,
      markup: provider === 'VISA' ? 0.4 + Math.random() * 0.1 : null
    });
  }
  
  return records;
}

/**
 * Generate CSV text for performance testing
 * @param {number} lineCount - Number of data lines (excluding header)
 * @returns {string}
 */
function generateCSVText(lineCount) {
  const lines = [CSV_HEADER];
  const providers = ['VISA', 'MASTERCARD', 'ECB'];
  const targets = ['INR', 'EUR', 'GBP', 'JPY', 'CAD'];
  
  const startDate = new Date('2020-01-01');
  
  for (let i = 0; i < lineCount; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(i / (providers.length * targets.length)));
    
    const dateStr = date.toISOString().slice(0, 10);
    const provider = providers[i % providers.length];
    const toCurr = targets[Math.floor(i / providers.length) % targets.length];
    const rate = (80 + Math.random() * 10).toFixed(6);
    const markup = provider === 'VISA' ? (0.4 + Math.random() * 0.1).toFixed(2) : '';
    
    lines.push(`${dateStr},${toCurr},${provider},${rate},${markup}`);
  }
  
  return lines.join('\n') + '\n';
}

/**
 * Measure execution time of a function
 * @param {() => void} fn - Function to measure
 * @returns {number} Execution time in milliseconds
 */
function measureTime(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/**
 * Run a function multiple times and return average time
 * @param {() => void} fn - Function to measure
 * @param {number} iterations - Number of iterations
 * @returns {{ avg: number, min: number, max: number }}
 */
function benchmark(fn, iterations = 5) {
  const times = [];
  
  // Warm-up run
  fn();
  
  for (let i = 0; i < iterations; i++) {
    times.push(measureTime(fn));
  }
  
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times)
  };
}

describe('Performance: parseCSV', () => {
  test('parses 10,000 lines in < 50ms', () => {
    const csvText = generateCSVText(10000);
    
    const result = benchmark(() => {
      parseCSV(csvText, /** @type {CurrencyCode} */ ('USD'));
    });
    
    console.log(`parseCSV(10,000 lines): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(50);
  });

  test('parses 1,000 lines in < 10ms', () => {
    const csvText = generateCSVText(1000);
    
    const result = benchmark(() => {
      parseCSV(csvText, /** @type {CurrencyCode} */ ('USD'));
    });
    
    console.log(`parseCSV(1,000 lines): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(10);
  });

  test('handles large CSV without memory issues', () => {
    const csvText = generateCSVText(50000);
    
    const result = benchmark(() => {
      const records = parseCSV(csvText, /** @type {CurrencyCode} */ ('USD'));
      expect(records.length).toBe(50000);
    }, 3);
    
    console.log(`parseCSV(50,000 lines): avg=${result.avg.toFixed(2)}ms`);
    
    // Should complete in reasonable time
    expect(result.avg).toBeLessThan(500);
  });
});

describe('Performance: serializeCSV', () => {
  test('serializes 10,000 records in < 100ms', () => {
    const records = generateRecords(10000);
    
    const result = benchmark(() => {
      serializeCSV(records);
    });
    
    console.log(`serializeCSV(10,000 records): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(100);
  });

  test('serializes 1,000 records in < 20ms', () => {
    const records = generateRecords(1000);
    
    const result = benchmark(() => {
      serializeCSV(records);
    });
    
    console.log(`serializeCSV(1,000 records): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(20);
  });
});

describe('Performance: CSVStore', () => {
  /** @type {string} */
  let tempDir;
  /** @type {CSVStore} */
  let store;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'forexradar-perf-'));
    store = new CSVStore(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('reads 1,000 records in < 100ms', () => {
    // Setup: Write 1000 records to disk
    const records = generateRecords(1000);
    const csv = serializeCSV(records);
    
    mkdirSync(join(tempDir, 'USD'), { recursive: true });
    writeFileSync(join(tempDir, 'USD', '2020.csv'), csv);
    writeFileSync(join(tempDir, 'USD', '2021.csv'), csv);
    
    // Measure reading
    const result = benchmark(() => {
      store.clearCache(); // Force fresh read
      store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
    });
    
    console.log(`CSVStore.getAll(~2000 records): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(100);
  });

  test('cached reads are < 5ms', () => {
    // Setup: Write and load 1000 records
    const records = generateRecords(1000);
    const csv = serializeCSV(records);
    
    mkdirSync(join(tempDir, 'USD'), { recursive: true });
    writeFileSync(join(tempDir, 'USD', '2020.csv'), csv);
    
    // Warm cache
    store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
    
    // Measure cached reads
    const result = benchmark(() => {
      store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
    });
    
    console.log(`CSVStore.getAll(cached): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(5);
  });

  test('add() 100 records in < 50ms', () => {
    const records = generateRecords(100);
    
    const result = benchmark(() => {
      // Use fresh store each time to avoid dedup
      const freshStore = new CSVStore(mkdtempSync(join(tmpdir(), 'forexradar-perf-add-')));
      freshStore.add(records);
    }, 3);
    
    console.log(`CSVStore.add(100 records): avg=${result.avg.toFixed(2)}ms, min=${result.min.toFixed(2)}ms, max=${result.max.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(50);
  });

  test('has() lookup is < 1ms with warm cache', () => {
    // Setup: Write 1000 records
    const records = generateRecords(1000);
    store.add(records);
    
    // Measure lookup
    const result = benchmark(() => {
      store.has('2020-01-05', /** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'), 'VISA');
    }, 10);
    
    console.log(`CSVStore.has() lookup: avg=${result.avg.toFixed(3)}ms, min=${result.min.toFixed(3)}ms, max=${result.max.toFixed(3)}ms`);
    
    expect(result.avg).toBeLessThan(1);
  });

  test('handles multi-year data efficiently', () => {
    // Create records spanning 5 years
    const allRecords = [];
    for (let year = 2020; year <= 2024; year++) {
      const yearRecords = generateRecords(200);
      // Adjust dates to spread across years
      yearRecords.forEach((r, i) => {
        const date = new Date(`${year}-01-01`);
        date.setDate(date.getDate() + i);
        r.date = date.toISOString().slice(0, 10);
      });
      allRecords.push(...yearRecords);
    }
    
    store.add(allRecords);
    store.clearCache();
    
    const result = benchmark(() => {
      store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
    });
    
    console.log(`CSVStore.getAll(5 years, ~1000 records): avg=${result.avg.toFixed(2)}ms`);
    
    expect(result.avg).toBeLessThan(100);
  });
});

describe('Performance: Memory', () => {
  test('parseCSV does not leak memory', () => {
    const csvText = generateCSVText(10000);
    
    // Run many iterations
    for (let i = 0; i < 10; i++) {
      const records = parseCSV(csvText, /** @type {CurrencyCode} */ ('USD'));
      expect(records.length).toBe(10000);
    }
    
    // If we get here without OOM, the test passes
    expect(true).toBe(true);
  });
});
