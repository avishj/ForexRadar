#!/usr/bin/env node

/**
 * Mass Backfill Script
 * 
 * Orchestrates backfill operations for all currency pairs in the watchlist.
 * Processes one pair at a time (serial execution) by spawning backfill.js
 * as a child process for each pair.
 * 
 * Usage: 
 *   node mass-backfill.js                                  # All pairs, both providers, parallel=1
 *   node mass-backfill.js --provider=visa                  # All pairs, Visa only, parallel=1
 *   node mass-backfill.js --parallel=5                     # All pairs, both providers, parallel=5
 *   node mass-backfill.js --provider=mastercard --parallel=3  # All pairs, Mastercard only, parallel=3
 * 
 * @module mass-backfill
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parses command line arguments
 * @returns {{provider: 'visa' | 'mastercard' | 'all', parallel: number}} Config
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string', default: 'all' },
      parallel: { type: 'string', default: '1' }
    }
  });

  const providerArg = (values.provider || 'all').toLowerCase();
  if (!['visa', 'mastercard', 'all'].includes(providerArg)) {
    console.error('Invalid provider. Use: visa, mastercard, or all');
    process.exit(1);
  }

  const parallelValue = parseInt(values.parallel || '1', 10);
  if (isNaN(parallelValue) || parallelValue < 1) {
    console.error('Invalid parallel value. Must be a positive integer.');
    process.exit(1);
  }

  return {
    provider: /** @type {'visa' | 'mastercard' | 'all'} */ (providerArg),
    parallel: parallelValue
  };
}

/**
 * Loads currency pairs from watchlist.json
 * @returns {Array<{from: string, to: string}>} Array of currency pairs
 */
function loadWatchlist() {
  try {
    const watchlistPath = join(__dirname, 'watchlist.json');
    const content = readFileSync(watchlistPath, 'utf8');
    const watchlist = JSON.parse(content);
    return watchlist.pairs || [];
  } catch (error) {
    console.error('Failed to load watchlist.json:', error.message);
    process.exit(1);
  }
}

/**
 * Runs backfill for a single currency pair
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @param {string} provider - Provider name
 * @param {number} parallel - Parallel batch size
 * @returns {Promise<{success: boolean, code: number | null}>}
 */
function runBackfill(from, to, provider, parallel) {
  return new Promise((resolve) => {
    const args = [
      'backfill.js',
      `--from=${from}`,
      `--to=${to}`,
      `--provider=${provider}`,
      `--parallel=${parallel}`
    ];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting: ${from}/${to} (provider: ${provider}, parallel: ${parallel})`);
    console.log('='.repeat(60));

    const child = spawn('node', args, {
      cwd: __dirname,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Completed: ${from}/${to}`);
        resolve({ success: true, code });
      } else {
        console.error(`✗ Failed: ${from}/${to} (exit code: ${code})`);
        resolve({ success: false, code });
      }
    });

    child.on('error', (error) => {
      console.error(`✗ Error running backfill for ${from}/${to}:`, error.message);
      resolve({ success: false, code: null });
    });
  });
}

/**
 * Main orchestration function
 */
async function main() {
  const { provider, parallel } = parseCliArgs();
  
  console.log('=== ForexRadar Mass Backfill ===');
  console.log(`Provider(s): ${provider === 'all' ? 'Visa + Mastercard' : provider.toUpperCase()}`);
  console.log(`Parallel batch size: ${parallel}`);
  
  const pairs = loadWatchlist();
  console.log(`Total pairs to process: ${pairs.length}`);
  
  if (pairs.length === 0) {
    console.log('No pairs found in watchlist. Exiting.');
    return;
  }

  const results = {
    success: 0,
    failed: 0,
    total: pairs.length
  };

  // Process each pair serially
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    console.log(`\n[${i + 1}/${pairs.length}] Processing ${pair.from}/${pair.to}...`);
    
    const result = await runBackfill(pair.from, pair.to, provider, parallel);
    
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('=== Final Summary ===');
  console.log(`Total pairs: ${results.total}`);
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Mass backfill failed:', error.message);
  process.exit(1);
});
