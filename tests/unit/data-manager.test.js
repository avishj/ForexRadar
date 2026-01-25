// @ts-check
import { describe, test, expect } from 'bun:test';
import { calculateStats, calculateMultiProviderStats } from '../../js/data-manager.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

describe('calculateStats', () => {
  test('returns null values for empty records', () => {
    const stats = calculateStats([]);
    
    expect(stats.high).toBeNull();
    expect(stats.low).toBeNull();
    expect(stats.current).toBeNull();
    expect(stats.avgMarkup).toBeNull();
    expect(stats.dateRange.start).toBeNull();
    expect(stats.dateRange.end).toBeNull();
  });

  test('calculates high, low, current correctly', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 85.0, markup: 0.45 },
      { date: '2024-01-17', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.2, markup: 0.42 }
    ];

    const stats = calculateStats(records);

    expect(stats.high).toBe(85.0);
    expect(stats.low).toBe(83.5);
    expect(stats.current).toBe(84.2); // Last record's rate
  });

  test('calculates avgMarkup correctly', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.3 },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.0, markup: 0.5 }
    ];

    const stats = calculateStats(records);

    expect(stats.avgMarkup).toBe(0.4); // (0.3 + 0.5) / 2
  });

  test('returns null avgMarkup when all markups are null', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 83.5, markup: null },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 84.0, markup: null }
    ];

    const stats = calculateStats(records);

    expect(stats.avgMarkup).toBeNull();
  });

  test('calculates avgMarkup ignoring null/undefined markups', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 84.0, markup: null },
      { date: '2024-01-17', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.5, markup: 0.6 }
    ];

    const stats = calculateStats(records);

    expect(stats.avgMarkup).toBe(0.5); // (0.4 + 0.6) / 2, ignoring null
  });

  test('calculates date range correctly', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 },
      { date: '2024-01-20', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.0, markup: 0.45 }
    ];

    const stats = calculateStats(records);

    expect(stats.dateRange.start).toBe('2024-01-15');
    expect(stats.dateRange.end).toBe('2024-01-20');
  });

  test('handles single record', () => {
    /** @type {RateRecord[]} */
    const records = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 }
    ];

    const stats = calculateStats(records);

    expect(stats.high).toBe(83.5);
    expect(stats.low).toBe(83.5);
    expect(stats.current).toBe(83.5);
    expect(stats.avgMarkup).toBe(0.4);
    expect(stats.dateRange.start).toBe('2024-01-15');
    expect(stats.dateRange.end).toBe('2024-01-15');
  });
});

describe('calculateMultiProviderStats', () => {
  test('returns stats for each provider', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.8, markup: null }
    ];
    /** @type {RateRecord[]} */
    const ecbRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 83.0, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, ecbRecords);

    expect(stats.visa.current).toBe(83.5);
    expect(stats.mastercard.current).toBe(83.8);
    expect(stats.ecb.current).toBe(83.0);
  });

  test('calculates avgSpread correctly (MC - Visa)', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 84.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    // Spread on 01-15: 83.5 - 83.0 = 0.5
    // Spread on 01-16: 84.5 - 84.0 = 0.5
    // avgSpread = (0.5 + 0.5) / 2 = 0.5
    expect(stats.avgSpread).toBe(0.5);
  });

  test('calculates currentSpread from most recent overlapping date', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 },
      { date: '2024-01-17', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 85.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.2, markup: null },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 84.0, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    // Most recent date with both: 2024-01-15
    // currentSpread = 83.2 - 83.0 = 0.2
    expect(stats.currentSpread).toBeCloseTo(0.2);
  });

  test('returns null spread when no overlapping dates', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.avgSpread).toBeNull();
    expect(stats.currentSpread).toBeNull();
  });

  test('betterRateProvider is VISA when Visa rate is lower', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.betterRateProvider).toBe('VISA');
  });

  test('betterRateProvider is MASTERCARD when MC rate is lower', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 84.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.betterRateProvider).toBe('MASTERCARD');
  });

  test('betterRateProvider is null when rates are equal', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.5, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.betterRateProvider).toBeNull();
  });

  test('betterRateProvider is null when no overlapping dates', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.betterRateProvider).toBeNull();
  });

  test('calculates combined dateRange from all providers', () => {
    /** @type {RateRecord[]} */
    const visaRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 83.0, markup: 0.4 }
    ];
    /** @type {RateRecord[]} */
    const mcRecords = [
      { date: '2024-01-20', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 83.5, markup: null }
    ];

    const stats = calculateMultiProviderStats(visaRecords, mcRecords, []);

    expect(stats.dateRange.start).toBe('2024-01-15');
    expect(stats.dateRange.end).toBe('2024-01-20');
  });

  test('handles empty provider arrays', () => {
    const stats = calculateMultiProviderStats([], [], []);

    expect(stats.visa.current).toBeNull();
    expect(stats.mastercard.current).toBeNull();
    expect(stats.ecb.current).toBeNull();
    expect(stats.avgSpread).toBeNull();
    expect(stats.currentSpread).toBeNull();
    expect(stats.betterRateProvider).toBeNull();
    expect(stats.dateRange.start).toBeNull();
    expect(stats.dateRange.end).toBeNull();
  });

  test('handles ECB records in stats', () => {
    /** @type {RateRecord[]} */
    const ecbRecords = [
      { date: '2024-01-15', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 82.5, markup: null },
      { date: '2024-01-16', from_curr: /** @type {any} */ ('INR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 83.0, markup: null }
    ];

    const stats = calculateMultiProviderStats([], [], ecbRecords);

    expect(stats.ecb.high).toBe(83.0);
    expect(stats.ecb.low).toBe(82.5);
    expect(stats.ecb.current).toBe(83.0);
    expect(stats.ecb.avgMarkup).toBeNull();
  });
});
