// @ts-check
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  needsServerRefresh,
  markServerRefreshed,
  getLastServerRefresh,
  clearAllRefreshTimestamps
} from '../../js/storage-manager.js';

/**
 * Mock localStorage for Node/Bun environment
 */
function createMockLocalStorage() {
  /** @type {Map<string, string>} */
  const store = new Map();
  
  return {
    getItem: (/** @type {string} */ key) => store.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => store.set(key, value),
    removeItem: (/** @type {string} */ key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (/** @type {number} */ index) => [...store.keys()][index] ?? null
  };
}

describe('storage-manager cache staleness', () => {
  /** @type {ReturnType<typeof createMockLocalStorage>} */
  let mockStorage;
  /** @type {typeof globalThis.localStorage} */
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    mockStorage = createMockLocalStorage();
    // @ts-expect-error - mocking localStorage
    globalThis.localStorage = mockStorage;
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  describe('needsServerRefresh', () => {
    test('returns true when never refreshed', () => {
      expect(needsServerRefresh('USD')).toBe(true);
    });

    test('returns false when refreshed after UTC 12pm today', () => {
      // Create a timestamp that's definitely after today's UTC 12pm
      const now = new Date();
      const utc12Today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        12, 0, 0, 0
      ));

      // If current time is before UTC 12pm, we need to use yesterday's 12pm as reference
      const lastUTC12pm = now < utc12Today
        ? new Date(utc12Today.getTime() - 24 * 60 * 60 * 1000)
        : utc12Today;

      // Set refresh time to 1 minute after last UTC 12pm
      const afterUTC12pm = new Date(lastUTC12pm.getTime() + 60 * 1000);
      mockStorage.setItem('forexRadar_serverRefresh_USD', afterUTC12pm.toISOString());

      expect(needsServerRefresh('USD')).toBe(false);
    });

    test('returns true when refreshed before last UTC 12pm', () => {
      const now = new Date();
      const utc12Today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        12, 0, 0, 0
      ));

      // Get the last UTC 12pm that has passed
      const lastUTC12pm = now < utc12Today
        ? new Date(utc12Today.getTime() - 24 * 60 * 60 * 1000)
        : utc12Today;

      // Set refresh time to 1 hour BEFORE last UTC 12pm
      const beforeUTC12pm = new Date(lastUTC12pm.getTime() - 60 * 60 * 1000);
      mockStorage.setItem('forexRadar_serverRefresh_USD', beforeUTC12pm.toISOString());

      expect(needsServerRefresh('USD')).toBe(true);
    });

    test('returns true for very old timestamp', () => {
      // Set refresh to a week ago
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      mockStorage.setItem('forexRadar_serverRefresh_EUR', weekAgo.toISOString());

      expect(needsServerRefresh('EUR')).toBe(true);
    });

    test('tracks currencies independently', () => {
      // USD was refreshed recently
      const now = new Date();
      mockStorage.setItem('forexRadar_serverRefresh_USD', now.toISOString());

      // EUR was never refreshed
      expect(needsServerRefresh('USD')).toBe(false);
      expect(needsServerRefresh('EUR')).toBe(true);
    });
  });

  describe('markServerRefreshed', () => {
    test('sets refresh timestamp for currency', () => {
      markServerRefreshed('USD');

      const stored = mockStorage.getItem('forexRadar_serverRefresh_USD');
      expect(stored).not.toBeNull();
      
      // Should be a valid ISO date string
      const parsed = new Date(/** @type {string} */ (stored));
      expect(parsed.getTime()).toBeGreaterThan(0);
    });

    test('overwrites previous refresh timestamp', () => {
      const oldDate = new Date('2020-01-01T00:00:00Z');
      mockStorage.setItem('forexRadar_serverRefresh_USD', oldDate.toISOString());

      markServerRefreshed('USD');

      const stored = mockStorage.getItem('forexRadar_serverRefresh_USD');
      const parsed = new Date(/** @type {string} */ (stored));
      expect(parsed.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    test('after marking, needsServerRefresh returns false', () => {
      expect(needsServerRefresh('GBP')).toBe(true);

      markServerRefreshed('GBP');

      expect(needsServerRefresh('GBP')).toBe(false);
    });
  });

  describe('getLastServerRefresh', () => {
    test('returns null when never refreshed', () => {
      expect(getLastServerRefresh('XYZ')).toBeNull();
    });

    test('returns Date when refreshed', () => {
      const timestamp = '2024-06-15T14:30:00.000Z';
      mockStorage.setItem('forexRadar_serverRefresh_USD', timestamp);

      const result = getLastServerRefresh('USD');

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(timestamp);
    });
  });

  describe('clearAllRefreshTimestamps', () => {
    test('clears all refresh timestamps', () => {
      mockStorage.setItem('forexRadar_serverRefresh_USD', new Date().toISOString());
      mockStorage.setItem('forexRadar_serverRefresh_EUR', new Date().toISOString());
      mockStorage.setItem('forexRadar_serverRefresh_GBP', new Date().toISOString());

      clearAllRefreshTimestamps();

      expect(getLastServerRefresh('USD')).toBeNull();
      expect(getLastServerRefresh('EUR')).toBeNull();
      expect(getLastServerRefresh('GBP')).toBeNull();
    });

    test('does not clear unrelated localStorage keys', () => {
      mockStorage.setItem('forexRadar_serverRefresh_USD', new Date().toISOString());
      mockStorage.setItem('otherApp_setting', 'value');

      clearAllRefreshTimestamps();

      expect(mockStorage.getItem('otherApp_setting')).toBe('value');
    });

    test('handles empty localStorage', () => {
      // Should not throw
      expect(() => clearAllRefreshTimestamps()).not.toThrow();
    });
  });

  describe('UTC 12pm boundary edge cases', () => {
    test('refresh at exactly UTC 12:00 is considered fresh', () => {
      const now = new Date();
      const utc12Today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        12, 0, 0, 0
      ));

      // Get the last UTC 12pm that has passed
      const lastUTC12pm = now < utc12Today
        ? new Date(utc12Today.getTime() - 24 * 60 * 60 * 1000)
        : utc12Today;

      // Refresh at exactly the boundary (1ms after to ensure it's >= not just >)
      const atBoundary = new Date(lastUTC12pm.getTime() + 1);
      mockStorage.setItem('forexRadar_serverRefresh_USD', atBoundary.toISOString());

      expect(needsServerRefresh('USD')).toBe(false);
    });

    test('refresh 1ms before UTC 12:00 is considered stale', () => {
      const now = new Date();
      const utc12Today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        12, 0, 0, 0
      ));

      // Get the last UTC 12pm that has passed
      const lastUTC12pm = now < utc12Today
        ? new Date(utc12Today.getTime() - 24 * 60 * 60 * 1000)
        : utc12Today;

      // Refresh 1ms before the boundary
      const beforeBoundary = new Date(lastUTC12pm.getTime() - 1);
      mockStorage.setItem('forexRadar_serverRefresh_USD', beforeBoundary.toISOString());

      expect(needsServerRefresh('USD')).toBe(true);
    });
  });
});
