#!/usr/bin/env node

/**
 * Backfill Script
 *
 * Fetches historical exchange rate data from Visa/Mastercard APIs and stores in CSV.
 *
 * Usage:
 *   node backfill.js --from=USD --to=INR
 *   node backfill.js --from=USD --to=INR --provider=visa --days=180
 *   node backfill.js --from=USD --to=INR --parallel=5 --days=30
 *
 * @module backfill
 */

import { parseBackfillArgs, formatProvider } from './cli.js';
import { store } from './csv-store.js';
import * as VisaClient from './visa-client.js';
import * as MastercardClient from './mastercard-client.js';
import { formatDate, getLatestAvailableDate } from '../shared/utils.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').Provider} Provider */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('../shared/types.js').ProviderBackfillResult} ProviderBackfillResult */

const BATCH_DELAY_MS = 100;

const CLIENTS = { VISA: VisaClient, MASTERCARD: MastercardClient };

/** @type {Provider[]} */
const PROVIDERS = ['VISA', 'MASTERCARD'];

/**
 * @param {Provider} provider
 * @param {string} date
 * @param {RateRecord|null} record
 * @param {boolean} inserted
 */
function logRateResult(provider, date, record, inserted) {
  if (!record) return;

  if (!inserted) {
    console.log(`[${provider}] ${date}: ⊘ Already exists`);
    return;
  }
  const markup = provider === 'VISA' && record.markup !== null
    ? `(markup: ${record.markup}%)`
    : '';
  console.log(`[${provider}] ${date}: ✓ ${record.rate} ${markup}`);
}

/**
 * @param {string} from
 * @param {string} to
 * @param {Provider} provider
 * @param {Date} startDate
 * @param {Date} stopDate
 * @param {number} batchSize
 * @returns {Promise<ProviderBackfillResult>}
 */
async function backfillProvider(from, to, provider, startDate, stopDate, batchSize) {
  console.log(`\n--- Backfilling ${provider} ---`);

  const client = CLIENTS[provider];
  const fromCurr = /** @type {CurrencyCode} */ (from);
  const toCurr = /** @type {CurrencyCode} */ (to);
  let inserted = 0;
  let skipped = 0;
  let currentDate = new Date(startDate);

  while (currentDate >= stopDate) {
    // Build batch of dates needing fetch
    const batch = [];
    const tempDate = new Date(currentDate);
    for (let i = 0; i < batchSize && tempDate >= stopDate; i++) {
      const dateStr = formatDate(tempDate);
      if (store.has(dateStr, fromCurr, toCurr, provider)) {
        skipped++;
      } else {
        batch.push(new Date(tempDate));
      }
      tempDate.setDate(tempDate.getDate() - 1);
    }
    currentDate = tempDate;
    if (batch.length === 0) continue;
    console.log(`[${provider}] Fetching ${batch.length} dates...`);
    const results = await Promise.allSettled(
      batch.map(async (date) => ({
        date: formatDate(date),
        record: await client.fetchRate(date, from, to)
      }))
    );
    let endOfHistory = false;
    for (const result of results) {
      if (result.status === 'rejected') {
        console.log(`[${provider}] Error: ${result.reason?.message || result.reason}`);
        continue;
      }
      const { date, record } = result.value;
      if (record === null) {
        console.log(`[${provider}] ${date}: End of history`);
        endOfHistory = true;
        break;
      }

      const wasInserted = store.add(record) > 0;
      wasInserted ? inserted++ : skipped++;
      logRateResult(provider, date, record, wasInserted);
    }

    if (endOfHistory) break;
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  return { inserted, skipped };
}

/** @param {typeof VisaClient} client */
async function safeCloseBrowser(client) {
  try { await client.closeBrowser(); } catch { /* ignore */ }
}

/**
 * Determines which providers to run based on CLI option.
 * @param option
 * @returns {Provider[]}
 */
function getProvidersToRun(option) {
  if (option === 'all') return PROVIDERS;
  return [/** @type {Provider} */ (option.toUpperCase())];
}

async function main() {
  const { from, to, provider, parallel, days } = parseBackfillArgs();

  console.log('=== ForexRadar Backfill ===');
  console.log(`Pair: ${from}/${to}`);
  console.log(`Provider(s): ${formatProvider(provider)}`);
  console.log(`Parallel: ${parallel}, Days: ${days}`);

  const startDate = getLatestAvailableDate();
  const stopDate = new Date(startDate);
  stopDate.setDate(stopDate.getDate() - days);
  
  console.log(`Date range: ${formatDate(stopDate)} → ${formatDate(startDate)}`);
  
  /** @type {Partial<Record<Provider, ProviderBackfillResult>>} */
  const results = {};

  if (provider === 'all' || provider === 'visa') {
    results.VISA = await backfillProvider(from, to, 'VISA', startDate, stopDate, parallel);
    await safeCloseBrowser(VisaClient);
  }

  if (provider === 'all' || provider === 'mastercard') {
    results.MASTERCARD = await backfillProvider(from, to, 'MASTERCARD', startDate, stopDate, parallel);
    await safeCloseBrowser(MastercardClient);
  }

  const totalRecords = store.count(/** @type {CurrencyCode} */ (from), /** @type {CurrencyCode} */ (to));

  console.log('\n=== Summary ===');
  for (const [name, res] of Object.entries(results)) {
    console.log(`${name}: ${res.inserted} inserted, ${res.skipped} skipped`);
  }
  console.log(`Total records: ${totalRecords}`);

  process.exit(0);
}

main().catch(async (error) => {
  console.error(`Backfill failed: ${error.message}`);
  await safeCloseBrowser(VisaClient);
  await safeCloseBrowser(MastercardClient);
  process.exit(1);
});
