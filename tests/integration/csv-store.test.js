// @ts-check
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CSVStore } from '../../backend/csv-store.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */

describe('CSVStore Integration', () => {
  /** @type {string} */
  let tempDir;
  /** @type {CSVStore} */
  let store;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'forexradar-test-'));
    store = new CSVStore(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('add()', () => {
    test('creates currency directory if missing', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('EUR'),
        provider: 'VISA',
        rate: 0.92,
        markup: 0.45
      };

      store.add(record);

      expect(existsSync(join(tempDir, 'USD'))).toBe(true);
    });

    test('writes to correct year file', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'VISA',
        rate: 83.25,
        markup: 0.45
      };

      store.add(record);

      const filePath = join(tempDir, 'USD', '2024.csv');
      expect(existsSync(filePath)).toBe(true);
      
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('2024-01-15');
      expect(content).toContain('INR');
    });

    test('deduplicates identical records', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'VISA',
        rate: 83.25,
        markup: 0.45
      };

      const added1 = store.add(record);
      const added2 = store.add(record);

      expect(added1).toBe(1);
      expect(added2).toBe(0);
      
      const records = store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
      expect(records).toHaveLength(1);
    });

    test('spans multiple years correctly', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-12-30',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.91,
          markup: 0.45
        },
        {
          date: '2025-01-02',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.92,
          markup: 0.45
        }
      ];

      const added = store.add(records);

      expect(added).toBe(2);
      expect(existsSync(join(tempDir, 'USD', '2024.csv'))).toBe(true);
      expect(existsSync(join(tempDir, 'USD', '2025.csv'))).toBe(true);
    });

    test('handles multiple providers for same date/pair', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'ECB',
          rate: 83.10,
          markup: null
        }
      ];

      const added = store.add(records);

      expect(added).toBe(2);
      const allRecords = store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
      expect(allRecords).toHaveLength(2);
    });

    test('returns 0 for empty array', () => {
      const added = store.add([]);
      expect(added).toBe(0);
    });
  });

  describe('has()', () => {
    test('returns true for existing record with specific provider', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'VISA',
        rate: 83.25,
        markup: 0.45
      };

      store.add(record);

      expect(store.has(
        '2024-01-15',
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR'),
        'VISA'
      )).toBe(true);
    });

    test('returns false for non-existing record', () => {
      expect(store.has(
        '2024-01-15',
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR'),
        'VISA'
      )).toBe(false);
    });

    test('with no provider checks any provider', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'ECB',
        rate: 83.10,
        markup: null
      };

      store.add(record);

      expect(store.has(
        '2024-01-15',
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      )).toBe(true);
    });

    test('returns false when provider does not match', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'VISA',
        rate: 83.25,
        markup: 0.45
      };

      store.add(record);

      expect(store.has(
        '2024-01-15',
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR'),
        'ECB'
      )).toBe(false);
    });
  });

  describe('getAll()', () => {
    test('returns sorted records by date ASC', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-20',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.50,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-18',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.40,
          markup: 0.45
        }
      ];

      store.add(records);

      const all = store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'));
      expect(all).toHaveLength(3);
      expect(all[0].date).toBe('2024-01-15');
      expect(all[1].date).toBe('2024-01-18');
      expect(all[2].date).toBe('2024-01-20');
    });

    test('returns empty array for non-existing pair', () => {
      const all = store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('XYZ'));
      expect(all).toEqual([]);
    });

    test('spans multiple years', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2023-12-31',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.90,
          markup: 0.45
        },
        {
          date: '2024-01-01',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.91,
          markup: 0.45
        },
        {
          date: '2025-06-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.95,
          markup: 0.45
        }
      ];

      store.add(records);

      const all = store.getAll(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('EUR'));
      expect(all).toHaveLength(3);
      expect(all[0].date).toBe('2023-12-31');
      expect(all[2].date).toBe('2025-06-15');
    });
  });

  describe('latestDate()', () => {
    test('finds most recent date', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-02-20',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.50,
          markup: 0.45
        }
      ];

      store.add(records);

      expect(store.latestDate(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      )).toBe('2024-02-20');
    });

    test('returns null when no data', () => {
      expect(store.latestDate(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      )).toBeNull();
    });
  });

  describe('oldestDate()', () => {
    test('finds earliest date', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-02-20',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.50,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        }
      ];

      store.add(records);

      expect(store.oldestDate(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      )).toBe('2024-01-15');
    });

    test('returns null when no data', () => {
      expect(store.oldestDate(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('XYZ')
      )).toBeNull();
    });
  });

  describe('targets()', () => {
    test('lists all target currencies', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.92,
          markup: 0.45
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('GBP'),
          provider: 'VISA',
          rate: 0.79,
          markup: 0.45
        }
      ];

      store.add(records);

      const targets = store.targets(/** @type {CurrencyCode} */ ('USD'));
      expect(targets).toContain('INR');
      expect(targets).toContain('EUR');
      expect(targets).toContain('GBP');
      expect(targets).toHaveLength(3);
    });

    test('returns empty array for non-existing source', () => {
      const targets = store.targets(/** @type {CurrencyCode} */ ('XYZ'));
      expect(targets).toEqual([]);
    });
  });

  describe('sources()', () => {
    test('lists all source currencies with CSV files', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('EUR'),
          to_curr: /** @type {CurrencyCode} */ ('GBP'),
          provider: 'ECB',
          rate: 0.86,
          markup: null
        }
      ];

      store.add(records);

      const sources = store.sources();
      expect(sources).toContain('USD');
      expect(sources).toContain('EUR');
      expect(sources).toHaveLength(2);
    });

    test('ignores directories without CSV files', () => {
      mkdirSync(join(tempDir, 'EMPTY'), { recursive: true });

      const sources = store.sources();
      expect(sources).not.toContain('EMPTY');
    });

    test('returns empty array when no data', () => {
      const sources = store.sources();
      expect(sources).toEqual([]);
    });

    test('ignores hidden directories', () => {
      mkdirSync(join(tempDir, '.hidden'), { recursive: true });
      writeFileSync(join(tempDir, '.hidden', '2024.csv'), 'date,to_curr,provider,rate,markup\n');

      const sources = store.sources();
      expect(sources).not.toContain('.hidden');
    });

    test('ignores underscore-prefixed directories', () => {
      mkdirSync(join(tempDir, '_meta'), { recursive: true });
      writeFileSync(join(tempDir, '_meta', '2024.csv'), 'date,to_curr,provider,rate,markup\n');

      const sources = store.sources();
      expect(sources).not.toContain('_meta');
    });
  });

  describe('countByProvider()', () => {
    test('tallies records per provider', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-16',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.30,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'ECB',
          rate: 83.10,
          markup: null
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'MASTERCARD',
          rate: 83.20,
          markup: null
        }
      ];

      store.add(records);

      const counts = store.countByProvider(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      );
      expect(counts.VISA).toBe(2);
      expect(counts.ECB).toBe(1);
      expect(counts.MASTERCARD).toBe(1);
    });

    test('returns zeros when no data', () => {
      const counts = store.countByProvider(
        /** @type {CurrencyCode} */ ('USD'),
        /** @type {CurrencyCode} */ ('INR')
      );
      expect(counts).toEqual({ VISA: 0, MASTERCARD: 0, ECB: 0 });
    });
  });

  describe('clearCache()', () => {
    test('invalidates in-memory index after external modification', () => {
      /** @type {RateRecord} */
      const record = {
        date: '2024-01-15',
        from_curr: /** @type {CurrencyCode} */ ('USD'),
        to_curr: /** @type {CurrencyCode} */ ('INR'),
        provider: 'VISA',
        rate: 83.25,
        markup: 0.45
      };

      store.add(record);
      expect(store.count(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'))).toBe(1);

      const filePath = join(tempDir, 'USD', '2024.csv');
      const content = readFileSync(filePath, 'utf-8');
      const updatedContent = content + '2024-01-16,INR,ECB,83.10,\n';
      writeFileSync(filePath, updatedContent);

      expect(store.count(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'))).toBe(1);

      store.clearCache();

      expect(store.count(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'))).toBe(2);
    });
  });

  describe('count()', () => {
    test('counts total records for currency pair', () => {
      /** @type {RateRecord[]} */
      const records = [
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'VISA',
          rate: 83.25,
          markup: 0.45
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('INR'),
          provider: 'ECB',
          rate: 83.10,
          markup: null
        },
        {
          date: '2024-01-15',
          from_curr: /** @type {CurrencyCode} */ ('USD'),
          to_curr: /** @type {CurrencyCode} */ ('EUR'),
          provider: 'VISA',
          rate: 0.92,
          markup: 0.45
        }
      ];

      store.add(records);

      expect(store.count(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('INR'))).toBe(2);
      expect(store.count(/** @type {CurrencyCode} */ ('USD'), /** @type {CurrencyCode} */ ('EUR'))).toBe(1);
    });
  });

  describe('basePath', () => {
    test('returns configured base path', () => {
      expect(store.basePath).toBe(tempDir);
    });
  });
});
