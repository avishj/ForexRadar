/**
 * Forex Radar - Main Application
 * 
 * Wires together all modules and handles user interactions.
 * 
 * @module app
 */

import { currencies } from './currencies.js';
import * as DataManager from './data-manager.js';
import * as ChartManager from './chart-manager.js';

// ============================================================================
// DOM Elements
// ============================================================================

const fromSelect = document.getElementById('from-currency');
const toSelect = document.getElementById('to-currency');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const statsBar = document.getElementById('stats-bar');
const chartContainer = document.getElementById('chart-container');
const emptyState = document.getElementById('empty-state');
const lastUpdated = document.getElementById('last-updated');
const requestArchivingLink = document.getElementById('request-archiving');
const notificationContainer = document.getElementById('notification-container');

// Stats elements
const statCurrent = document.getElementById('stat-current');
const statHigh = document.getElementById('stat-high');
const statLow = document.getElementById('stat-low');
const statMarkup = document.getElementById('stat-markup');

// ============================================================================
// State
// ============================================================================

let debounceTimer = null;
const DEBOUNCE_MS = 300;

// ============================================================================
// Notifications
// ============================================================================

/**
 * Shows a notification toast
 * @param {string} message - Message to display
 * @param {'info'|'success'|'error'|'warning'} type - Notification type
 * @param {number} duration - Duration in ms (0 = persistent)
 */
function showNotification(message, type = 'info', duration = 4000) {
  const colors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500'
  };

  const notification = document.createElement('div');
  notification.className = `notification ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm`;
  notification.textContent = message;

  notificationContainer.appendChild(notification);

  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });

  if (duration > 0) {
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  return notification;
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Populates a select element with currency options
 * @param {HTMLSelectElement} select - Select element
 */
function populateCurrencyDropdown(select) {
  // Keep the first placeholder option
  const placeholder = select.options[0];
  select.innerHTML = '';
  select.appendChild(placeholder);

  for (const currency of currencies) {
    const option = document.createElement('option');
    option.value = currency.code;
    option.textContent = `${currency.name} (${currency.code})`;
    select.appendChild(option);
  }
}

/**
 * Shows the loader with a message
 * @param {string} message - Loading message
 */
function showLoader(message = 'Loading...') {
  loaderText.textContent = message;
  loader.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

/**
 * Hides the loader
 */
function hideLoader() {
  loader.classList.add('hidden');
}

/**
 * Shows the results UI (stats + chart)
 */
function showResults() {
  statsBar.classList.remove('hidden');
  chartContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

/**
 * Shows the empty state
 */
function showEmptyState() {
  statsBar.classList.add('hidden');
  chartContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

/**
 * Updates the stats display
 * @param {Object} stats - Statistics object from DataManager
 */
function updateStats(stats) {
  statCurrent.textContent = stats.current?.toFixed(4) ?? '-';
  statHigh.textContent = stats.high?.toFixed(4) ?? '-';
  statLow.textContent = stats.low?.toFixed(4) ?? '-';
  statMarkup.textContent = stats.avgMarkup 
    ? `${(stats.avgMarkup * 100).toFixed(3)}%` 
    : '-';
}

/**
 * Updates the last updated display
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 */
function updateLastUpdated(dateStr) {
  if (dateStr) {
    lastUpdated.textContent = `Last data: ${dateStr}`;
  } else {
    lastUpdated.textContent = '';
  }
}

/**
 * Updates the Request Archiving link
 * @param {string} fromCurr - Source currency
 * @param {string} toCurr - Target currency
 */
function updateArchivingLink(fromCurr, toCurr) {
  const title = encodeURIComponent(`Add pair: ${fromCurr}/${toCurr}`);
  const body = encodeURIComponent(`Please add server-side archiving for the ${fromCurr}/${toCurr} currency pair.`);
  requestArchivingLink.href = `https://github.com/avishj/ForexRadar/issues/new?title=${title}&body=${body}`;
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Fetches and displays data for the selected currency pair
 */
async function loadCurrencyPair() {
  const fromCurr = fromSelect.value;
  const toCurr = toSelect.value;

  // Validate selection
  if (!fromCurr || !toCurr) {
    showEmptyState();
    return;
  }

  if (fromCurr === toCurr) {
    showNotification('Please select different currencies', 'warning');
    return;
  }

  // Update archiving link
  updateArchivingLink(fromCurr, toCurr);

  // Show loader
  showLoader('Fetching history...');

  try {
    // Fetch data with progress updates
    const result = await DataManager.fetchRates(fromCurr, toCurr, {
      onProgress: (stage, message) => {
        loaderText.textContent = message;
      }
    });

    if (result.records.length === 0) {
      hideLoader();
      showEmptyState();
      showNotification('No data available for this pair', 'warning');
      return;
    }

    // Calculate stats
    const stats = DataManager.calculateStats(result.records);

    // Update UI
    hideLoader();
    showResults();
    updateStats(stats);
    updateLastUpdated(stats.dateRange.end);

    // Render chart
    if (ChartManager.isChartInitialized()) {
      ChartManager.updateChart(result.records, fromCurr, toCurr);
    } else {
      ChartManager.initChart('chart', result.records, fromCurr, toCurr);
    }

    // Show summary notification
    const { fromServer, fromCache, fromLive, total } = result.stats;
    let source = [];
    if (fromServer > 0) source.push(`${fromServer} from server`);
    if (fromCache > 0) source.push(`${fromCache} cached`);
    if (fromLive > 0) source.push(`${fromLive} live`);
    
    showNotification(`Loaded ${total} data points (${source.join(', ')})`, 'success');

  } catch (error) {
    hideLoader();
    showEmptyState();
    showNotification(`Error: ${error.message}`, 'error');
    console.error('Failed to load currency pair:', error);
  }
}

/**
 * Debounced handler for currency selection changes
 */
function handleSelectionChange() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    loadCurrencyPair();
  }, DEBOUNCE_MS);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the application
 */
function init() {
  // Populate dropdowns
  populateCurrencyDropdown(fromSelect);
  populateCurrencyDropdown(toSelect);

  // Set defaults (USD -> INR)
  fromSelect.value = 'USD';
  toSelect.value = 'INR';

  // Add event listeners with debouncing
  fromSelect.addEventListener('change', handleSelectionChange);
  toSelect.addEventListener('change', handleSelectionChange);

  // Initial load
  loadCurrencyPair();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
