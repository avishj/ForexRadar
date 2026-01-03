#!/usr/bin/env node

/**
 * Mass Backfill Orchestrator
 *
 * Runs backfill.js for every currency pair in watchlist.json.
 * Each pair runs in a child process to isolate browser lifecycle.
 *
 * Usage:
 *   node mass-backfill.js
 *   node mass-backfill.js --provider=visa --days=30
 *   node mass-backfill.js --provider=mastercard --parallel=3 --days=180
 *
 * @module mass-backfill
 */

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMassBackfillArgs, loadWatchlist, formatProvider } from './cli.js';

/** @typedef {import('../shared/types.js').CurrencyPair} CurrencyPair */
/** @typedef {import('../shared/types.js').MassBackfillConfig} MassBackfillConfig */
/** @typedef {import('../shared/types.js').BackfillResult} BackfillResult */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEPARATOR = '='.repeat(60);
const SEPARATOR_LIGHT = '-'.repeat(60);

/**
 * @param {CurrencyPair} pair
 * @param {MassBackfillConfig} config
 * @returns {Promise<BackfillResult>}
 */
function runBackfillForPair(pair, config) {
  return new Promise((resolve) => {
    const args = [
      'backfill.js',
      `--from=${pair.from}`,
      `--to=${pair.to}`,
      `--provider=${config.provider}`,
      `--parallel=${config.parallel}`,
      `--days=${config.days}`
    ];

    const child = spawn('node', args, { cwd: __dirname, stdio: 'inherit' });

    child.on('close', (exitCode) => resolve({ success: exitCode === 0, exitCode }));
    child.on('error', (err) => {
      console.error(`Spawn error: ${err.message}`);
      resolve({ success: false, exitCode: null });
    });
  });
}

/** @param {MassBackfillConfig} config  @param {number} pairCount */
function printBanner(config, pairCount) {
  console.log(SEPARATOR);
  console.log('  ForexRadar Mass Backfill');
  console.log(SEPARATOR);
  console.log(`  Provider(s):  ${formatProvider(config.provider)}`);
  console.log(`  Parallel:     ${config.parallel}`);
  console.log(`  Days:         ${config.days}`);
  console.log(`  Pairs:        ${pairCount}`);
  console.log(SEPARATOR);
}

/** @param {number} index  @param {number} total  @param {CurrencyPair} pair */
function printProgress(index, total, pair) {
  const pct = Math.round(((index + 1) / total) * 100);
  console.log(`\n${SEPARATOR_LIGHT}`);
  console.log(`[${index + 1}/${total}] ${pair.from}/${pair.to} (${pct}%)`);
  console.log(SEPARATOR_LIGHT);
}

function printSummary(succeeded, failed, total) {
  console.log(`\n${SEPARATOR}`);
  console.log('  Summary');
  console.log(SEPARATOR);
  console.log(`  Total:      ${total}`);
  console.log(`  Succeeded:  ${succeeded}`);
  console.log(`  Failed:     ${failed}`);
  console.log(SEPARATOR);
}

async function main() {
  const config = parseMassBackfillArgs();
  const pairs = loadWatchlist();

  if (pairs.length === 0) {
    console.log('No pairs in watchlist.');
    return;
  }

  printBanner(config, pairs.length);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    printProgress(i, pairs.length, pair);

    const result = await runBackfillForPair(pair, config);

    if (result.success) {
      console.log(`✓ ${pair.from}/${pair.to} completed`);
      succeeded++;
    } else {
      console.error(`✗ ${pair.from}/${pair.to} failed (exit: ${result.exitCode})`);
      failed++;
    }
  }

  printSummary(succeeded, failed, pairs.length);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
