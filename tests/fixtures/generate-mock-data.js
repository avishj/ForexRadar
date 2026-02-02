/**
 * Generate deterministic mock CSV data for visual regression tests.
 * Run with: bun tests/fixtures/generate-mock-data.js
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generate all dates in 2025
 * @returns {string[]}
 */
function getDates2025() {
  const dates = [];
  const start = new Date('2025-01-01');
  const end = new Date('2025-12-31');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Deterministic pseudo-random based on seed string
 * @param {string} seed
 * @returns {number} 0-1
 */
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(Math.sin(hash)) % 1;
}

/**
 * Generate rate with small daily variance
 * @param {number} baseRate
 * @param {string} date
 * @param {string} provider
 * @returns {number}
 */
function generateRate(baseRate, date, provider) {
  const variance = (seededRandom(date + provider) - 0.5) * 0.02; // ±1% variance
  return baseRate * (1 + variance);
}

// EUR -> INR: All 3 providers (VISA, MASTERCARD, ECB)
const EUR_INR_BASE = 89.5; // Realistic EUR->INR rate
const eurInrRows = ['date,to_curr,provider,rate,markup'];

for (const date of getDates2025()) {
  const visaRate = generateRate(EUR_INR_BASE, date, 'VISA');
  const mcRate = generateRate(EUR_INR_BASE, date, 'MC');
  const ecbRate = generateRate(EUR_INR_BASE, date, 'ECB');
  const visaMarkup = (seededRandom(date + 'markup') * 0.5).toFixed(2); // 0-0.5%
  
  eurInrRows.push(`${date},INR,VISA,${visaRate.toFixed(6)},${visaMarkup}`);
  eurInrRows.push(`${date},INR,MASTERCARD,${mcRate.toFixed(6)},`);
  eurInrRows.push(`${date},INR,ECB,${ecbRate.toFixed(6)},`);
}

// USD -> AED: VISA only (simulates pair without MC/ECB)
const USD_AED_BASE = 3.67; // Realistic USD->AED rate (pegged)
const usdAedRows = ['date,to_curr,provider,rate,markup'];

for (const date of getDates2025()) {
  const visaRate = generateRate(USD_AED_BASE, date, 'VISA');
  const visaMarkup = (seededRandom(date + 'markup-aed') * 0.3).toFixed(2);
  
  usdAedRows.push(`${date},AED,VISA,${visaRate.toFixed(6)},${visaMarkup}`);
}

// Write files
const eurPath = join(__dirname, 'db/EUR/2025.csv');
const usdPath = join(__dirname, 'db/USD/2025.csv');

mkdirSync(dirname(eurPath), { recursive: true });
mkdirSync(dirname(usdPath), { recursive: true });

writeFileSync(eurPath, eurInrRows.join('\n') + '\n');
writeFileSync(usdPath, usdAedRows.join('\n') + '\n');

console.log(`✓ Generated ${eurPath} (${eurInrRows.length - 1} rows)`);
console.log(`✓ Generated ${usdPath} (${usdAedRows.length - 1} rows)`);
