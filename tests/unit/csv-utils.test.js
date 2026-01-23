// @ts-check
import { describe, test, expect } from 'bun:test';
import {
  parseCSV,
  serializeCSV,
  makeUniqueKey,
  recordToUniqueKey,
  makeDatePairKey,
  filterByDateRange,
  filterByProvider,
  filterByTargetCurrency,
  splitByProvider,
  sortByDateAsc,
  sortByDateDesc,
  getLatestDateFromRecords,
  getOldestDateFromRecords,
  getUniqueTargets,
  countByProvider,
  CSV_HEADER
} from '../../shared/csv-utils.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */

const SAMPLE_CSV = `date,to_curr,provider,rate,markup
2024-01-15,USD,VISA,1.0892,0.45
2024-01-15,USD,ECB,1.0856,
2024-01-16,USD,VISA,1.0912,0.42
2024-01-16,USD,MASTERCARD,1.0901,`;

const SAMPLE_CSV_NO_HEADER = `2024-01-15,USD,VISA,1.0892,0.45
2024-01-15,USD,ECB,1.0856,`;

describe('parseCSV', () => {
  test('parses valid 5-column format with header', () => {
    const records = parseCSV(SAMPLE_CSV, /** @type {any} */ ('EUR'));
    expect(records).toHaveLength(4);
    expect(records[0]).toEqual({
      date: '2024-01-15',
      from_curr: 'EUR',
      to_curr: 'USD',
      provider: 'VISA',
      rate: 1.0892,
      markup: 0.45
    });
  });

  test('handles missing markup (ECB format)', () => {
    const records = parseCSV(SAMPLE_CSV, /** @type {any} */ ('EUR'));
    const ecbRecord = records.find(r => r.provider === 'ECB');
    expect(ecbRecord?.markup).toBeNull();
  });

  test('ignores blank lines', () => {
    const csvWithBlanks = `${CSV_HEADER}

2024-01-15,USD,VISA,1.0892,0.45

2024-01-16,USD,ECB,1.0856,
`;
    const records = parseCSV(csvWithBlanks, /** @type {any} */ ('EUR'));
    expect(records).toHaveLength(2);
  });

  test('ignores header row', () => {
    const records = parseCSV(SAMPLE_CSV, /** @type {any} */ ('EUR'));
    const hasHeader = records.some(r => r.date === 'date');
    expect(hasHeader).toBe(false);
  });

  test('returns empty array for malformed lines', () => {
    const malformed = `not,enough,columns
invalid`;
    const records = parseCSV(malformed, /** @type {any} */ ('EUR'));
    expect(records).toEqual([]);
  });

  test('handles CSV without header', () => {
    const records = parseCSV(SAMPLE_CSV_NO_HEADER, /** @type {any} */ ('EUR'));
    expect(records).toHaveLength(2);
  });

  test('parses rate as number', () => {
    const records = parseCSV(SAMPLE_CSV, /** @type {any} */ ('EUR'));
    expect(typeof records[0].rate).toBe('number');
    expect(records[0].rate).toBe(1.0892);
  });

  test('handles trailing whitespace', () => {
    const csvWithWhitespace = `2024-01-15, USD , VISA , 1.0892 , 0.45 `;
    const records = parseCSV(csvWithWhitespace, /** @type {any} */ ('EUR'));
    expect(records[0].to_curr).toBe('USD');
    expect(records[0].provider).toBe('VISA');
  });
});

describe('serializeCSV', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-16', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.0912, markup: 0.42 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.0892, markup: 0.45 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('GBP'), provider: 'ECB', rate: 0.8601, markup: null }
  ];

  test('includes header row', () => {
    const csv = serializeCSV(records);
    expect(csv.startsWith(CSV_HEADER)).toBe(true);
  });

  test('sorts by date, then to_curr, then provider', () => {
    const csv = serializeCSV(records);
    const lines = csv.trim().split('\n');
    // Skip header
    expect(lines[1]).toContain('2024-01-15');
    expect(lines[1]).toContain('GBP'); // GBP before USD alphabetically
    expect(lines[2]).toContain('2024-01-15');
    expect(lines[2]).toContain('USD');
    expect(lines[3]).toContain('2024-01-16');
  });

  test('ends with trailing newline', () => {
    const csv = serializeCSV(records);
    expect(csv.endsWith('\n')).toBe(true);
  });

  test('handles null markup as empty string', () => {
    const csv = serializeCSV(records);
    const ecbLine = csv.split('\n').find(l => l.includes('ECB'));
    expect(ecbLine?.endsWith(',')).toBe(true);
  });

  test('returns just header for empty records', () => {
    const csv = serializeCSV([]);
    expect(csv).toBe(CSV_HEADER + '\n');
  });

  test('roundtrips with parseCSV', () => {
    const csv = serializeCSV(records);
    const parsed = parseCSV(csv, /** @type {any} */ ('EUR'));
    expect(parsed).toHaveLength(records.length);
    // Check first record after sorting
    expect(parsed[0].date).toBe('2024-01-15');
    expect(parsed[0].to_curr).toBe('GBP');
  });
});

describe('makeUniqueKey', () => {
  test('creates deterministic key', () => {
    expect(makeUniqueKey('2024-01-15', 'USD', 'VISA')).toBe('2024-01-15|USD|VISA');
  });

  test('different inputs produce different keys', () => {
    const key1 = makeUniqueKey('2024-01-15', 'USD', 'VISA');
    const key2 = makeUniqueKey('2024-01-15', 'USD', 'ECB');
    const key3 = makeUniqueKey('2024-01-16', 'USD', 'VISA');
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});

describe('recordToUniqueKey', () => {
  test('creates key from record', () => {
    /** @type {RateRecord} */
    const record = {
      date: '2024-01-15',
      from_curr: /** @type {any} */ ('EUR'),
      to_curr: /** @type {any} */ ('USD'),
      provider: 'VISA',
      rate: 1.0892,
      markup: 0.45
    };
    expect(recordToUniqueKey(record)).toBe('2024-01-15|USD|VISA');
  });
});

describe('makeDatePairKey', () => {
  test('creates key without provider', () => {
    expect(makeDatePairKey('2024-01-15', 'USD')).toBe('2024-01-15|USD');
  });
});

describe('filterByDateRange', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-01', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 },
    { date: '2024-01-31', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.10, markup: 0.4 },
    { date: '2024-02-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.11, markup: 0.4 }
  ];

  test('includes start date (inclusive)', () => {
    const filtered = filterByDateRange(records, '2024-01-15', '2024-02-01');
    expect(filtered.some(r => r.date === '2024-01-15')).toBe(true);
  });

  test('includes end date (inclusive)', () => {
    const filtered = filterByDateRange(records, '2024-01-01', '2024-01-31');
    expect(filtered.some(r => r.date === '2024-01-31')).toBe(true);
  });

  test('excludes dates outside range', () => {
    const filtered = filterByDateRange(records, '2024-01-10', '2024-01-20');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2024-01-15');
  });

  test('handles exact single-day range', () => {
    const filtered = filterByDateRange(records, '2024-01-15', '2024-01-15');
    expect(filtered).toHaveLength(1);
  });

  test('returns empty array when no matches', () => {
    const filtered = filterByDateRange(records, '2025-01-01', '2025-12-31');
    expect(filtered).toEqual([]);
  });
});

describe('filterByProvider', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 1.07, markup: null },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 1.075, markup: null }
  ];

  test('filters to single provider', () => {
    const visa = filterByProvider(records, 'VISA');
    expect(visa).toHaveLength(1);
    expect(visa[0].provider).toBe('VISA');
  });

  test('returns empty when provider not found', () => {
    // @ts-expect-error testing invalid provider
    const filtered = filterByProvider(records, 'UNKNOWN');
    expect(filtered).toEqual([]);
  });
});

describe('filterByTargetCurrency', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('GBP'), provider: 'VISA', rate: 0.86, markup: 0.4 }
  ];

  test('filters to target currency', () => {
    const usd = filterByTargetCurrency(records, /** @type {any} */ ('USD'));
    expect(usd).toHaveLength(1);
    expect(usd[0].to_curr).toBe('USD');
  });
});

describe('splitByProvider', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 1.07, markup: null },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'MASTERCARD', rate: 1.075, markup: null },
    { date: '2024-01-16', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 }
  ];

  test('groups records by provider', () => {
    const split = splitByProvider(records);
    expect(split.visa).toHaveLength(2);
    expect(split.mastercard).toHaveLength(1);
    expect(split.ecb).toHaveLength(1);
  });

  test('returns empty arrays for missing providers', () => {
    const visaOnly = [records[0], records[3]];
    const split = splitByProvider(visaOnly);
    expect(split.mastercard).toEqual([]);
    expect(split.ecb).toEqual([]);
  });
});

describe('sortByDateAsc', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-31', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.10, markup: 0.4 },
    { date: '2024-01-01', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 }
  ];

  test('sorts oldest first', () => {
    const sorted = sortByDateAsc(records);
    expect(sorted[0].date).toBe('2024-01-01');
    expect(sorted[1].date).toBe('2024-01-15');
    expect(sorted[2].date).toBe('2024-01-31');
  });

  test('does not mutate original array', () => {
    const original = [...records];
    sortByDateAsc(records);
    expect(records).toEqual(original);
  });
});

describe('sortByDateDesc', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-01', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-31', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.10, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 }
  ];

  test('sorts newest first', () => {
    const sorted = sortByDateDesc(records);
    expect(sorted[0].date).toBe('2024-01-31');
    expect(sorted[1].date).toBe('2024-01-15');
    expect(sorted[2].date).toBe('2024-01-01');
  });
});

describe('getLatestDateFromRecords', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-02-28', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 },
    { date: '2024-01-01', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.07, markup: 0.4 }
  ];

  test('finds most recent date', () => {
    expect(getLatestDateFromRecords(records)).toBe('2024-02-28');
  });

  test('returns null for empty array', () => {
    expect(getLatestDateFromRecords([])).toBeNull();
  });
});

describe('getOldestDateFromRecords', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-02-28', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 },
    { date: '2024-01-01', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.07, markup: 0.4 }
  ];

  test('finds oldest date', () => {
    expect(getOldestDateFromRecords(records)).toBe('2024-01-01');
  });

  test('returns null for empty array', () => {
    expect(getOldestDateFromRecords([])).toBeNull();
  });
});

describe('getUniqueTargets', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('GBP'), provider: 'VISA', rate: 0.86, markup: 0.4 },
    { date: '2024-01-16', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 }
  ];

  test('returns unique currencies sorted', () => {
    const targets = getUniqueTargets(records);
    expect(targets).toEqual(['GBP', 'USD']);
  });

  test('returns empty for no records', () => {
    expect(getUniqueTargets([])).toEqual([]);
  });
});

describe('countByProvider', () => {
  /** @type {RateRecord[]} */
  const records = [
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.08, markup: 0.4 },
    { date: '2024-01-16', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'VISA', rate: 1.09, markup: 0.4 },
    { date: '2024-01-15', from_curr: /** @type {any} */ ('EUR'), to_curr: /** @type {any} */ ('USD'), provider: 'ECB', rate: 1.07, markup: null }
  ];

  test('counts records per provider', () => {
    const counts = countByProvider(records);
    expect(counts.VISA).toBe(2);
    expect(counts.ECB).toBe(1);
    expect(counts.MASTERCARD).toBe(0);
  });

  test('returns zeros for empty array', () => {
    const counts = countByProvider([]);
    expect(counts).toEqual({ VISA: 0, MASTERCARD: 0, ECB: 0 });
  });
});
