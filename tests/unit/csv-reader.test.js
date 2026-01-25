// @ts-check
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { CSVReader } from '../../js/csv-reader.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

const SAMPLE_CSV_2024 = `date,to_curr,provider,rate,markup
2024-01-15,USD,VISA,86.123456,0.45
2024-01-15,USD,ECB,85.987654,
2024-01-16,USD,MASTERCARD,86.012345,`;

const SAMPLE_CSV_2023 = `date,to_curr,provider,rate,markup
2023-12-28,USD,VISA,83.5,0.4
2023-12-29,USD,VISA,83.6,0.4`;

describe('CSVReader', () => {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchAllForCurrency', () => {
    test('fetches and parses CSV files for discovered years', async () => {
      const currentYear = new Date().getFullYear();
      
      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // HEAD requests for year discovery
        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }
        
        // GET requests for actual data
        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2024, { status: 200 }));
        }
        
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const records = await reader.fetchAllForCurrency(/** @type {any} */ ('INR'));

      expect(records.length).toBeGreaterThan(0);
      expect(records[0].from_curr).toBe('INR');
    });

    test('returns empty array when no year files exist', async () => {
      globalThis.fetch = mock(() => 
        Promise.resolve(new Response(null, { status: 404 }))
      );

      const reader = new CSVReader('./db');
      const records = await reader.fetchAllForCurrency(/** @type {any} */ ('XYZ'));

      expect(records).toEqual([]);
    });

    test('returns empty array on network error (does not throw)', async () => {
      globalThis.fetch = mock(() => 
        Promise.reject(new Error('Network error'))
      );

      const reader = new CSVReader('./db');
      const records = await reader.fetchAllForCurrency(/** @type {any} */ ('USD'));

      expect(records).toEqual([]);
    });

    test('fetches multiple years and merges records', async () => {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`) || urlStr.includes(`/${lastYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2024, { status: 200 }));
        }
        if (urlStr.includes(`/${lastYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2023, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const records = await reader.fetchAllForCurrency(/** @type {any} */ ('INR'));

      // Should have records from both years (3 from 2024 + 2 from 2023)
      expect(records.length).toBe(5);
    });

    test('returns records sorted by date ascending', async () => {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`) || urlStr.includes(`/${lastYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2024, { status: 200 }));
        }
        if (urlStr.includes(`/${lastYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2023, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const records = await reader.fetchAllForCurrency(/** @type {any} */ ('INR'));

      // Older records should come first
      expect(records[0].date).toBe('2023-12-28');
      expect(records[records.length - 1].date).toBe('2024-01-16');
    });
  });

  describe('fetchRatesForPair', () => {
    test('filters records by target currency', async () => {
      const currentYear = new Date().getFullYear();

      const mixedCurrencyCSV = `date,to_curr,provider,rate,markup
2024-01-15,USD,VISA,86.123456,0.45
2024-01-15,EUR,VISA,92.5,0.45
2024-01-16,USD,VISA,86.2,0.4`;

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(mixedCurrencyCSV, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const records = await reader.fetchRatesForPair(
        /** @type {any} */ ('INR'),
        /** @type {any} */ ('USD')
      );

      expect(records.length).toBe(2);
      expect(records.every(r => r.to_curr === 'USD')).toBe(true);
    });
  });

  describe('fetchRatesByProvider', () => {
    test('splits records by provider correctly', async () => {
      const currentYear = new Date().getFullYear();

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2024, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const { visa, mastercard, ecb } = await reader.fetchRatesByProvider(
        /** @type {any} */ ('INR'),
        /** @type {any} */ ('USD')
      );

      expect(visa.length).toBe(1);
      expect(mastercard.length).toBe(1);
      expect(ecb.length).toBe(1);
      expect(visa[0].provider).toBe('VISA');
      expect(mastercard[0].provider).toBe('MASTERCARD');
      expect(ecb[0].provider).toBe('ECB');
    });

    test('returns empty arrays when no records for provider', async () => {
      const currentYear = new Date().getFullYear();

      const visaOnlyCSV = `date,to_curr,provider,rate,markup
2024-01-15,USD,VISA,86.123456,0.45`;

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (options?.method === 'HEAD') {
          if (urlStr.includes(`/${currentYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(visaOnlyCSV, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const { visa, mastercard, ecb } = await reader.fetchRatesByProvider(
        /** @type {any} */ ('INR'),
        /** @type {any} */ ('USD')
      );

      expect(visa.length).toBe(1);
      expect(mastercard).toEqual([]);
      expect(ecb).toEqual([]);
    });
  });

  describe('hasDataForCurrency', () => {
    test('returns true when year files exist', async () => {
      const currentYear = new Date().getFullYear();

      globalThis.fetch = mock((url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const hasData = await reader.hasDataForCurrency(/** @type {any} */ ('USD'));

      expect(hasData).toBe(true);
    });

    test('returns false when no year files exist', async () => {
      globalThis.fetch = mock(() => 
        Promise.resolve(new Response(null, { status: 404 }))
      );

      const reader = new CSVReader('./db');
      const hasData = await reader.hasDataForCurrency(/** @type {any} */ ('XYZ'));

      expect(hasData).toBe(false);
    });

    test('returns false on network error', async () => {
      globalThis.fetch = mock(() => 
        Promise.reject(new Error('Network error'))
      );

      const reader = new CSVReader('./db');
      const hasData = await reader.hasDataForCurrency(/** @type {any} */ ('USD'));

      expect(hasData).toBe(false);
    });

    test('checks current year and previous 2 years', async () => {
      const currentYear = new Date().getFullYear();
      /** @type {string[]} */
      const checkedUrls = [];

      globalThis.fetch = mock((url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        checkedUrls.push(urlStr);
        
        // Only older year exists
        if (urlStr.includes(`/${currentYear - 2}.csv`)) {
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const reader = new CSVReader('./db');
      const hasData = await reader.hasDataForCurrency(/** @type {any} */ ('USD'));

      expect(hasData).toBe(true);
      expect(checkedUrls.length).toBe(3);
      expect(checkedUrls.some(u => u.includes(`/${currentYear}.csv`))).toBe(true);
      expect(checkedUrls.some(u => u.includes(`/${currentYear - 1}.csv`))).toBe(true);
      expect(checkedUrls.some(u => u.includes(`/${currentYear - 2}.csv`))).toBe(true);
    });
  });

  describe('basePath', () => {
    test('uses default basePath of ./db', () => {
      const reader = new CSVReader();
      expect(reader.basePath).toBe('./db');
    });

    test('uses custom basePath when provided', () => {
      const reader = new CSVReader('/custom/path');
      expect(reader.basePath).toBe('/custom/path');
    });

    test('constructs URLs using basePath', async () => {
      const currentYear = new Date().getFullYear();
      let requestedUrl = '';

      globalThis.fetch = mock((url) => {
        requestedUrl = typeof url === 'string' ? url : url.toString();
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const reader = new CSVReader('https://example.com/data');
      await reader.hasDataForCurrency(/** @type {any} */ ('USD'));

      expect(requestedUrl).toContain('https://example.com/data/USD/');
    });
  });

  describe('year discovery gap detection', () => {
    test('stops discovery after gap of years with no data', async () => {
      const currentYear = new Date().getFullYear();
      /** @type {number[]} */
      const requestedYears = [];

      globalThis.fetch = mock((url, options) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Track which years are checked
        const yearMatch = urlStr.match(/\/(\d{4})\.csv/);
        if (yearMatch && options?.method === 'HEAD') {
          requestedYears.push(parseInt(yearMatch[1]));
        }

        if (options?.method === 'HEAD') {
          // Only current year has data - simulate a large gap
          if (urlStr.includes(`/${currentYear}.csv`)) {
            return Promise.resolve(new Response(null, { status: 200 }));
          }
          return Promise.resolve(new Response(null, { status: 404 }));
        }

        if (urlStr.includes(`/${currentYear}.csv`)) {
          return Promise.resolve(new Response(SAMPLE_CSV_2024, { status: 200 }));
        }

        return Promise.resolve(new Response('Not Found', { status: 404 }));
      });

      const reader = new CSVReader('./db');
      await reader.fetchAllForCurrency(/** @type {any} */ ('USD'));

      // Should not check all years back to 1990 - gap detection should stop early
      // The exact number depends on batch size (5) and gap threshold (5+ years)
      expect(requestedYears.length).toBeLessThan(currentYear - 1990);
    });
  });
});
