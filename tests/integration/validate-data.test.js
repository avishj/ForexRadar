// @ts-check
import { describe, test, expect } from 'bun:test';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseCSV } from '../../shared/csv-utils.js';
import { parseDate } from '../../shared/utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

/**
 * Find duplicate records (same date + to_curr + provider appearing multiple times)
 * @param {RateRecord[]} records
 * @returns {Array<{date: string, to_curr: string, provider: string, count: number}>}
 */
function findDuplicates(records) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  
  for (const record of records) {
    const key = `${record.date}|${record.to_curr}|${record.provider}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  
  /** @type {Array<{date: string, to_curr: string, provider: string, count: number}>} */
  const duplicates = [];
  
  for (const [key, count] of counts) {
    if (count > 1) {
      const [date, to_curr, provider] = key.split('|');
      duplicates.push({ date, to_curr, provider, count });
    }
  }
  
  return duplicates.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Find missing dates in a range
 * @param {string[]} dates - Sorted date strings (YYYY-MM-DD)
 * @returns {string[]}
 */
function findMissingDates(dates) {
  if (dates.length < 2) return [];
  
  const dateSet = new Set(dates);
  const missingDates = [];
  const start = parseDate(dates[0]);
  const end = parseDate(dates[dates.length - 1]);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!dateSet.has(dateStr)) {
      missingDates.push(dateStr);
    }
  }
  
  return missingDates;
}

describe('Validation Functions', () => {
  describe('findDuplicates()', () => {
    test('detects same date+to_curr+provider appearing multiple times', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.30,
          markup: 0.45
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.40,
          markup: 0.45
        }
      ];

      const duplicates = findDuplicates(records);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].date).toBe('2024-01-15');
      expect(duplicates[0].to_curr).toBe('INR');
      expect(duplicates[0].provider).toBe('VISA');
      expect(duplicates[0].count).toBe(2);
    });

    test('returns empty array when no duplicates', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'ECB',
          rate: 83.10,
          markup: null
        }
      ];

      const duplicates = findDuplicates(records);
      expect(duplicates).toEqual([]);
    });

    test('allows same date+provider for different target currencies', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('EUR'),
          provider: 'VISA',
          rate: 0.92,
          markup: 0.45
        }
      ];

      const duplicates = findDuplicates(records);
      expect(duplicates).toEqual([]);
    });

    test('detects multiple duplicate groups', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'VISA',
          rate: 83.30,
          markup: 0.45
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'ECB',
          rate: 83.10,
          markup: null
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'ECB',
          rate: 83.15,
          markup: null
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {any} */ ('USD'),
          to_curr: /** @type {any} */ ('INR'),
          provider: 'ECB',
          rate: 83.20,
          markup: null
        }
      ];

      const duplicates = findDuplicates(records);
      
      expect(duplicates).toHaveLength(2);
      const visaDup = duplicates.find(d => d.provider === 'VISA');
      const ecbDup = duplicates.find(d => d.provider === 'ECB');
      expect(visaDup?.count).toBe(2);
      expect(ecbDup?.count).toBe(3);
    });
  });

  describe('findMissingDates()', () => {
    test('identifies gaps in date range', () => {
      const dates = ['2024-01-01', '2024-01-02', '2024-01-05', '2024-01-06'];
      const missing = findMissingDates(dates);
      
      expect(missing).toContain('2024-01-03');
      expect(missing).toContain('2024-01-04');
      expect(missing).toHaveLength(2);
    });

    test('returns empty array for consecutive dates', () => {
      const dates = ['2024-01-01', '2024-01-02', '2024-01-03'];
      const missing = findMissingDates(dates);
      expect(missing).toEqual([]);
    });

    test('returns empty array for single date', () => {
      const dates = ['2024-01-15'];
      const missing = findMissingDates(dates);
      expect(missing).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      const missing = findMissingDates([]);
      expect(missing).toEqual([]);
    });

    test('handles month boundaries', () => {
      const dates = ['2024-01-30', '2024-02-02'];
      const missing = findMissingDates(dates);
      
      expect(missing).toContain('2024-01-31');
      expect(missing).toContain('2024-02-01');
      expect(missing).toHaveLength(2);
    });

    test('handles year boundaries', () => {
      const dates = ['2023-12-30', '2024-01-03'];
      const missing = findMissingDates(dates);
      
      expect(missing).toContain('2023-12-31');
      expect(missing).toContain('2024-01-01');
      expect(missing).toContain('2024-01-02');
      expect(missing).toHaveLength(3);
    });

    test('handles leap year February', () => {
      const dates = ['2024-02-28', '2024-03-01'];
      const missing = findMissingDates(dates);
      
      expect(missing).toContain('2024-02-29');
      expect(missing).toHaveLength(1);
    });

    test('handles non-leap year February', () => {
      const dates = ['2023-02-27', '2023-03-02'];
      const missing = findMissingDates(dates);
      
      expect(missing).toContain('2023-02-28');
      expect(missing).toContain('2023-03-01');
      expect(missing).toHaveLength(2);
    });
  });
});

describe('Real Data Validation', () => {
  const dbPath = join(import.meta.dir, '../../db');

  test('validates db/USD/2025.csv if exists', async () => {
    const usdPath = join(dbPath, 'USD');
    const filePath = join(usdPath, '2025.csv');
    
    if (!existsSync(filePath)) {
      console.log('Skipping: db/USD/2025.csv does not exist');
      return;
    }

    const content = await Bun.file(filePath).text();
    const records = parseCSV(content, /** @type {any} */ ('USD'));
    
    expect(records.length).toBeGreaterThan(0);
    
    const duplicates = findDuplicates(records);
    expect(duplicates).toEqual([]);
    
    for (const record of records) {
      expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.rate).toBeGreaterThan(0);
      expect(['VISA', 'MASTERCARD', 'ECB']).toContain(record.provider);
    }
  });

  test('validates all currencies have valid CSV structure', async () => {
    if (!existsSync(dbPath)) {
      console.log('Skipping: db/ directory does not exist');
      return;
    }

    const currencies = readdirSync(dbPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
      .map(d => d.name);

    if (currencies.length === 0) {
      console.log('Skipping: no currency directories found');
      return;
    }

    for (const currency of currencies) {
      const currencyPath = join(dbPath, currency);
      const csvFiles = readdirSync(currencyPath).filter(f => f.endsWith('.csv'));

      for (const csvFile of csvFiles) {
        const filePath = join(currencyPath, csvFile);
        const content = await Bun.file(filePath).text();
        const records = parseCSV(content, /** @type {any} */ (currency));
        
        for (const record of records) {
          expect(record.from_curr).toBe(currency);
          expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(typeof record.rate).toBe('number');
          expect(record.rate).toBeGreaterThan(0);
        }
      }
    }
  });
});
