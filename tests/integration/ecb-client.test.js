// @ts-check
import { describe, test, expect, mock, beforeAll, afterAll } from 'bun:test';
import { fetchAllRates } from '../../backend/ecb-client.js';

/** @typedef {import('../../shared/types.js').ECBRateData} ECBRateData */

const SAMPLE_ECB_HTML = `
<!DOCTYPE html>
<html>
<head><title>EUR/USD</title></head>
<body>
<script>
var chartData = [];
var chartDataInverse = [];
chartData.push({date: new Date(2024,0,15), rate: 1.0892});
chartData.push({date: new Date(2024,0,16), rate: 1.0901});
chartData.push({date: new Date(2024,0,17), rate: 1.0856});
chartDataInverse.push({date: new Date(2024,0,15), rate: 0.9181});
chartDataInverse.push({date: new Date(2024,0,16), rate: 0.9173});
chartDataInverse.push({date: new Date(2024,0,17), rate: 0.9212});
</script>
</body>
</html>
`;

const EMPTY_ECB_HTML = `
<!DOCTYPE html>
<html>
<head><title>EUR/XYZ</title></head>
<body>
<script>
var chartData = [];
var chartDataInverse = [];
</script>
</body>
</html>
`;

describe('ECB Client Integration', () => {
  describe('fetchAllRates() with mocked responses', () => {
    const originalFetch = globalThis.fetch;

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    test('parses ECB HTML response correctly', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result).not.toBeNull();
      expect(result?.eurTo).toHaveLength(3);
      expect(result?.toEur).toHaveLength(3);
    });

    test('returns bidirectional rates (EUR→X and X→EUR)', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result?.eurTo[0].from_curr).toBe('EUR');
      expect(result?.eurTo[0].to_curr).toBe('USD');
      expect(result?.toEur[0].from_curr).toBe('USD');
      expect(result?.toEur[0].to_curr).toBe('EUR');
    });

    test('parses dates correctly (JS month is 0-indexed)', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result?.eurTo[0].date).toBe('2024-01-15');
      expect(result?.eurTo[1].date).toBe('2024-01-16');
      expect(result?.eurTo[2].date).toBe('2024-01-17');
    });

    test('sets provider to ECB', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result?.eurTo[0].provider).toBe('ECB');
      expect(result?.toEur[0].provider).toBe('ECB');
    });

    test('sets markup to null (ECB has no markup)', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result?.eurTo[0].markup).toBeNull();
      expect(result?.toEur[0].markup).toBeNull();
    });

    test('parses rate values correctly', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(SAMPLE_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result?.eurTo[0].rate).toBe(1.0892);
      expect(result?.toEur[0].rate).toBe(0.9181);
    });

    test('returns null for missing currencies (no data)', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response(EMPTY_ECB_HTML, { status: 200 })));

      const result = await fetchAllRates(/** @type {any} */ ('XYZ'));

      expect(result).toBeNull();
    });

    test('returns null on HTTP error', async () => {
      globalThis.fetch = mock(() => Promise.resolve(new Response('Not Found', { status: 404 })));

      const result = await fetchAllRates(/** @type {any} */ ('XYZ'));

      expect(result).toBeNull();
    });

    test('returns null on network error', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error')));

      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result).toBeNull();
    });
  });

  describe('fetchAllRates() live (optional)', () => {
    test.skipIf(!process.env.TEST_LIVE_ECB)('fetches live EUR/USD rates', async () => {
      const result = await fetchAllRates(/** @type {any} */ ('USD'));

      expect(result).not.toBeNull();
      expect(result?.eurTo.length).toBeGreaterThan(0);
      expect(result?.toEur.length).toBeGreaterThan(0);

      const eurToUsd = result?.eurTo[0];
      expect(eurToUsd?.from_curr).toBe('EUR');
      expect(eurToUsd?.to_curr).toBe('USD');
      expect(eurToUsd?.provider).toBe('ECB');
      expect(eurToUsd?.rate).toBeGreaterThan(0);
      expect(eurToUsd?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test.skipIf(!process.env.TEST_LIVE_ECB)('fetches live EUR/GBP rates', async () => {
      const result = await fetchAllRates(/** @type {any} */ ('GBP'));

      expect(result).not.toBeNull();
      expect(result?.eurTo.length).toBeGreaterThan(0);
      expect(result?.toEur.length).toBeGreaterThan(0);
    });
  });
});
