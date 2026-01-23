// @ts-check
import { describe, test, expect } from 'bun:test';
import { PROVIDER_CONFIG, USER_AGENTS, BACKFILL_DEFAULTS, LIVE_FETCH_TIMEOUT_MS } from '../../shared/constants.js';

describe('PROVIDER_CONFIG', () => {
  test('has all required provider keys', () => {
    expect(PROVIDER_CONFIG).toHaveProperty('VISA');
    expect(PROVIDER_CONFIG).toHaveProperty('MASTERCARD');
    expect(PROVIDER_CONFIG).toHaveProperty('ECB');
  });

  test('VISA has correct config keys', () => {
    expect(PROVIDER_CONFIG.VISA.maxParallelRequests).toBeDefined();
    expect(PROVIDER_CONFIG.VISA.batchDelayMs).toBeDefined();
  });

  test('MASTERCARD has rate limiting config', () => {
    expect(PROVIDER_CONFIG.MASTERCARD.maxParallelRequests).toBe(1);
    expect(PROVIDER_CONFIG.MASTERCARD.sessionRefreshInterval).toBeDefined();
    expect(PROVIDER_CONFIG.MASTERCARD.browserRestartInterval).toBeDefined();
    expect(PROVIDER_CONFIG.MASTERCARD.pauseOnForbiddenMs).toBeDefined();
  });

  test('rate limit values are positive numbers', () => {
    expect(PROVIDER_CONFIG.VISA.maxParallelRequests).toBeGreaterThan(0);
    expect(PROVIDER_CONFIG.VISA.batchDelayMs).toBeGreaterThan(0);
    expect(PROVIDER_CONFIG.MASTERCARD.sessionRefreshInterval).toBeGreaterThan(0);
    expect(PROVIDER_CONFIG.MASTERCARD.browserRestartInterval).toBeGreaterThan(0);
    expect(PROVIDER_CONFIG.MASTERCARD.pauseOnForbiddenMs).toBeGreaterThan(0);
  });

  test('ECB config exists (can be empty)', () => {
    expect(PROVIDER_CONFIG.ECB).toBeDefined();
    expect(typeof PROVIDER_CONFIG.ECB).toBe('object');
  });
});

describe('USER_AGENTS', () => {
  test('is non-empty array', () => {
    expect(Array.isArray(USER_AGENTS)).toBe(true);
    expect(USER_AGENTS.length).toBeGreaterThan(0);
  });

  test('contains valid browser user agent strings', () => {
    for (const ua of USER_AGENTS) {
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(50); // Real UAs are long
      expect(ua).toContain('Mozilla'); // All modern browsers include this
    }
  });
});

describe('BACKFILL_DEFAULTS', () => {
  test('has required properties', () => {
    expect(BACKFILL_DEFAULTS.days).toBeDefined();
    expect(BACKFILL_DEFAULTS.provider).toBeDefined();
  });

  test('days is positive number', () => {
    expect(BACKFILL_DEFAULTS.days).toBeGreaterThan(0);
  });

  test('provider is valid option', () => {
    expect(['all', 'visa', 'mastercard']).toContain(BACKFILL_DEFAULTS.provider);
  });
});

describe('LIVE_FETCH_TIMEOUT_MS', () => {
  test('is positive number', () => {
    expect(LIVE_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  test('is reasonable timeout (< 30 seconds)', () => {
    expect(LIVE_FETCH_TIMEOUT_MS).toBeLessThan(30000);
  });
});
