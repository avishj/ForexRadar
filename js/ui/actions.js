/**
 * Action Buttons (Copy, Share, Download)
 * 
 * Handles stats bar action button functionality.
 * 
 * @module ui/actions
 */

import { showNotification } from './notifications.js';

/**
 * @typedef {Object} ActionCallbacks
 * @property {() => string} getFromCurrency - Gets current from currency
 * @property {() => string} getToCurrency - Gets current to currency
 * @property {() => string} getCurrentRate - Gets current rate text
 * @property {() => string} getTimeRange - Gets current time range
 * @property {() => boolean} isChartReady - Checks if chart is initialized
 * @property {(filename: string) => Promise<boolean>} exportChart - Exports chart as PNG
 */

/** @type {ActionCallbacks|null} */
let callbacks = null;

/**
 * Initialize action buttons
 * @param {ActionCallbacks} cbs - Callback functions
 */
export function initActions(cbs) {
  callbacks = cbs;
  
  const copyRateBtn = document.getElementById('copy-rate-btn');
  const shareUrlBtn = document.getElementById('share-url-btn');
  const downloadChartBtn = document.getElementById('download-chart-btn');
  
  if (copyRateBtn) {
    copyRateBtn.addEventListener('click', handleCopyRate);
  }
  
  if (shareUrlBtn) {
    shareUrlBtn.addEventListener('click', handleShareUrl);
  }
  
  if (downloadChartBtn) {
    downloadChartBtn.addEventListener('click', handleDownloadChart);
  }
}

async function handleCopyRate() {
  if (!callbacks) return;
  
  const rate = callbacks.getCurrentRate();
  if (!rate || rate === '-') {
    showNotification('No rate to copy', 'warning');
    return;
  }
  
  const fromCurr = callbacks.getFromCurrency();
  const toCurr = callbacks.getToCurrency();
  const textToCopy = `${fromCurr}/${toCurr}: ${rate}`;
  
  const btn = document.getElementById('copy-rate-btn');
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    btn?.classList.add('btn--success');
    showNotification('Rate copied to clipboard!', 'success', 2000);
    setTimeout(() => btn?.classList.remove('btn--success'), 1500);
  } catch (_err) {
    showNotification('Failed to copy', 'error');
  }
}

async function handleShareUrl() {
  if (!callbacks) return;
  
  const fromCurr = callbacks.getFromCurrency();
  const toCurr = callbacks.getToCurrency();
  
  if (!fromCurr || !toCurr) {
    showNotification('Select currencies first', 'warning');
    return;
  }
  
  const url = new URL(window.location.href);
  url.searchParams.set('from', fromCurr);
  url.searchParams.set('to', toCurr);
  url.searchParams.set('range', callbacks.getTimeRange());
  
  const btn = document.getElementById('share-url-btn');
  
  try {
    await navigator.clipboard.writeText(url.toString());
    btn?.classList.add('btn--success');
    showNotification('Link copied to clipboard!', 'success', 2000);
    setTimeout(() => btn?.classList.remove('btn--success'), 1500);
  } catch (_err) {
    showNotification('Failed to copy link', 'error');
  }
}

async function handleDownloadChart() {
  if (!callbacks) return;
  
  if (!callbacks.isChartReady()) {
    showNotification('No chart to download', 'warning');
    return;
  }
  
  const fromCurr = callbacks.getFromCurrency();
  const toCurr = callbacks.getToCurrency();
  const timeRange = callbacks.getTimeRange();
  const filename = `forex-${fromCurr}-${toCurr}-${timeRange}`;
  
  const btn = document.getElementById('download-chart-btn');
  btn?.classList.add('btn--success');
  
  const success = await callbacks.exportChart(filename);
  
  if (success) {
    showNotification('Chart downloaded!', 'success', 2000);
  } else {
    showNotification('Failed to download chart', 'error');
  }
  
  setTimeout(() => btn?.classList.remove('btn--success'), 1500);
}

/**
 * Programmatically trigger copy rate action
 */
export function triggerCopyRate() {
  document.getElementById('copy-rate-btn')?.click();
}

/**
 * Programmatically trigger share URL action
 */
export function triggerShareUrl() {
  document.getElementById('share-url-btn')?.click();
}

/**
 * Programmatically trigger download chart action
 */
export function triggerDownloadChart() {
  document.getElementById('download-chart-btn')?.click();
}
