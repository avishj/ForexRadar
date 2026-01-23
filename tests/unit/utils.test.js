// @ts-check
import { describe, test, expect } from 'bun:test';
import {
  formatDate,
  parseDate,
  addDays,
  addMonths,
  getYearsInRange,
  getLatestAvailableDate,
  isCacheStale,
  resolveDateRange,
  getLastUTC12pm
} from '../../shared/utils.js';

describe('formatDate', () => {
  test('formats date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe('2024-01-15');
    expect(formatDate(new Date(2023, 11, 31))).toBe('2023-12-31');
  });

  test('pads single-digit month and day with zeros', () => {
    expect(formatDate(new Date(2024, 0, 1))).toBe('2024-01-01');
    expect(formatDate(new Date(2024, 5, 9))).toBe('2024-06-09');
  });
});

describe('parseDate', () => {
  test('parses YYYY-MM-DD string correctly', () => {
    const date = parseDate('2024-06-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // 0-indexed
    expect(date.getDate()).toBe(15);
  });

  test('roundtrips with formatDate', () => {
    const original = '2024-03-22';
    expect(formatDate(parseDate(original))).toBe(original);
  });

  test('handles year boundaries', () => {
    const date = parseDate('2025-01-01');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });
});

describe('addDays', () => {
  test('adds positive days within same month', () => {
    expect(addDays('2024-06-15', 5)).toBe('2024-06-20');
  });

  test('handles month boundary crossing', () => {
    expect(addDays('2024-02-28', 3)).toBe('2024-03-02');
  });

  test('handles year boundary crossing', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });

  test('subtracts days with negative value', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is leap year
  });

  test('handles leap year Feb 29', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  test('handles non-leap year Feb 28', () => {
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });
});

describe('addMonths', () => {
  test('adds months within same year', () => {
    expect(addMonths('2024-03-15', 2)).toBe('2024-05-15');
  });

  test('handles year boundary crossing', () => {
    expect(addMonths('2024-11-15', 3)).toBe('2025-02-15');
  });

  test('handles variable month lengths (Jan 31 + 1 month)', () => {
    // Jan 31 + 1 month = Feb 28/29 (day clamped to month length)
    const result = addMonths('2024-01-31', 1);
    // JS Date automatically clamps, so it becomes Mar 2 (31 days into Feb = Mar 2 in leap year)
    // Actually JS Date.setMonth behavior: adding 1 month to Jan 31 in leap year gives Mar 2
    expect(result).toBe('2024-03-02');
  });

  test('subtracts months with negative value', () => {
    expect(addMonths('2024-06-15', -3)).toBe('2024-03-15');
  });

  test('handles crossing multiple years', () => {
    expect(addMonths('2024-06-15', 24)).toBe('2026-06-15');
  });
});

describe('getYearsInRange', () => {
  test('returns single year for same-year range', () => {
    expect(getYearsInRange('2024-03-15', '2024-09-20')).toEqual([2024]);
  });

  test('spans multiple years', () => {
    expect(getYearsInRange('2023-12-15', '2025-02-01')).toEqual([2023, 2024, 2025]);
  });

  test('handles same start and end date', () => {
    expect(getYearsInRange('2024-06-15', '2024-06-15')).toEqual([2024]);
  });

  test('handles decade span', () => {
    const years = getYearsInRange('2020-01-01', '2025-12-31');
    expect(years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });
});

describe('getLatestAvailableDate', () => {
  test('returns a Date object', () => {
    const result = getLatestAvailableDate();
    expect(result).toBeInstanceOf(Date);
  });

  test('returns date at midnight', () => {
    const result = getLatestAvailableDate();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  test('returns today or yesterday based on ET time', () => {
    const result = getLatestAvailableDate();
    const now = new Date();
    // Result should be within 2 days of now
    const diffDays = Math.abs(now.getTime() - result.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(2);
  });
});

describe('isCacheStale', () => {
  test('returns true for timestamp before last UTC 12pm', () => {
    const lastUTC12 = getLastUTC12pm();
    const oldTimestamp = lastUTC12 - 1000 * 60 * 60; // 1 hour before
    expect(isCacheStale(oldTimestamp)).toBe(true);
  });

  test('returns false for timestamp after last UTC 12pm', () => {
    const lastUTC12 = getLastUTC12pm();
    const recentTimestamp = lastUTC12 + 1000 * 60; // 1 minute after
    expect(isCacheStale(recentTimestamp)).toBe(false);
  });

  test('returns true for very old timestamp', () => {
    const veryOld = Date.now() - 1000 * 60 * 60 * 24 * 7; // 7 days ago
    expect(isCacheStale(veryOld)).toBe(true);
  });

  test('returns false for current timestamp', () => {
    expect(isCacheStale(Date.now())).toBe(false);
  });
});

describe('resolveDateRange', () => {
  test('resolves { all: true } to wide range', () => {
    const result = resolveDateRange({ all: true });
    expect(result.start).toBe('1990-01-01');
    // end is today
    expect(result.end).toBe(formatDate(new Date()));
  });

  test('resolves absolute { start, end } directly', () => {
    const result = resolveDateRange({ start: '2024-01-01', end: '2024-06-30' });
    expect(result.start).toBe('2024-01-01');
    expect(result.end).toBe('2024-06-30');
  });

  test('resolves { months: 3 } to 3 months ago', () => {
    const result = resolveDateRange({ months: 3 });
    const today = formatDate(new Date());
    expect(result.end).toBe(today);
    // Start should be 3 months before today
    const expected = addMonths(today, -3);
    expect(result.start).toBe(expected);
  });

  test('resolves { years: 1 } to 12 months ago', () => {
    const result = resolveDateRange({ years: 1 });
    const today = formatDate(new Date());
    expect(result.end).toBe(today);
    const expected = addMonths(today, -12);
    expect(result.start).toBe(expected);
  });

  test('defaults to 1 year range when empty object', () => {
    const result = resolveDateRange({});
    const today = formatDate(new Date());
    expect(result.end).toBe(today);
    expect(result.start).toBe(addMonths(today, -12));
  });
});
