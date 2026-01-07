/**
 * Forex Radar - Main Application
 * 
 * Wires together all modules and handles user interactions.
 * Supports multi-provider data (Visa and Mastercard).
 * 
 * @module app
 */

import { currencies } from './currencies.js';
import * as DataManager from './data-manager.js';
import * as ChartManager from './chart-manager.js';

/** @typedef {import('../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../shared/types.js').MultiProviderStats} MultiProviderStats */

// ============================================================================
// DOM Elements
// ============================================================================

/** @type {HTMLSelectElement} */
const fromSelect = /** @type {HTMLSelectElement} */ (document.getElementById('from-currency'));
/** @type {HTMLSelectElement} */
const toSelect = /** @type {HTMLSelectElement} */ (document.getElementById('to-currency'));
/** @type {HTMLElement} */
const loader = /** @type {HTMLElement} */ (document.getElementById('loader'));
/** @type {HTMLElement} */
const loaderText = /** @type {HTMLElement} */ (document.getElementById('loader-text'));
/** @type {HTMLElement} */
const statsBar = /** @type {HTMLElement} */ (document.getElementById('stats-bar'));
/** @type {HTMLElement} */
const chartContainer = /** @type {HTMLElement} */ (document.getElementById('chart-container'));
/** @type {HTMLElement} */
const emptyState = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
/** @type {HTMLElement} */
const lastUpdated = /** @type {HTMLElement} */ (document.getElementById('last-updated'));
/** @type {HTMLAnchorElement} */
const requestArchivingLink = /** @type {HTMLAnchorElement} */ (document.getElementById('request-archiving'));
/** @type {HTMLElement} */
const archivingSection = /** @type {HTMLElement} */ (document.getElementById('archiving-section'));
/** @type {HTMLElement} */
const seriesTogglesSection = /** @type {HTMLElement} */ (document.getElementById('series-toggles'));
/** @type {HTMLElement} */
const timeRangeSection = /** @type {HTMLElement} */ (document.getElementById('time-range-selector'));
/** @type {HTMLElement} */
const notificationContainer = /** @type {HTMLElement} */ (document.getElementById('notification-container'));

// Stats elements
const statCurrent = document.getElementById('stat-current');
const statHigh = document.getElementById('stat-high');
const statLow = document.getElementById('stat-low');
const statMarkup = document.getElementById('stat-markup');
const statSpread = document.getElementById('stat-spread');
const statBetterProvider = document.getElementById('stat-better-provider');

// Series toggle checkboxes
const toggleVisaRate = /** @type {HTMLInputElement} */ (document.getElementById('toggle-visa-rate'));
const toggleMcRate = /** @type {HTMLInputElement} */ (document.getElementById('toggle-mc-rate'));
const toggleEcbRate = /** @type {HTMLInputElement} */ (document.getElementById('toggle-ecb-rate'));
const toggleVisaMarkup = /** @type {HTMLInputElement} */ (document.getElementById('toggle-visa-markup'));

// Series toggle containers (parent labels)
const toggleVisaRateContainer = toggleVisaRate?.closest('.series-toggle');
const toggleMcRateContainer = toggleMcRate?.closest('.series-toggle');
const toggleEcbRateContainer = toggleEcbRate?.closest('.series-toggle');
const toggleVisaMarkupContainer = toggleVisaMarkup?.closest('.series-toggle');

// ============================================================================
// State
// ============================================================================

let debounceTimer = null;
const DEBOUNCE_MS = 300;

// Track current data for stats recalculation on zoom
/** @type {RateRecord[]} */
let currentVisaRecords = [];
/** @type {RateRecord[]} */
let currentMcRecords = [];
/** @type {RateRecord[]} */
let currentEcbRecords = [];
let currentFromCurr = '';
let currentToCurr = '';

/** 
 * Current time range selection
 * @type {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} 
 */
let currentTimeRange = '1y';

/**
 * Converts time range key to DateRange object for data-manager
 * @param {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} rangeKey
 * @returns {import('../shared/types.js').DateRange}
 */
function parseTimeRange(rangeKey) {
  switch (rangeKey) {
    case '1m': return { months: 1 };
    case '3m': return { months: 3 };
    case '6m': return { months: 6 };
    case '1y': return { years: 1 };
    case '5y': return { years: 5 };
    case 'all': return { all: true };
    default: return { years: 1 };
  }
}

// ============================================================================
// Notifications
// ============================================================================

// Track notification count for staggering
let notificationCount = 0;

/**
 * Shows a notification toast
 * @param {string} message - Message to display
 * @param {'info'|'success'|'error'|'warning'} type - Notification type
 * @param {number} duration - Duration in ms (0 = persistent)
 */
function showNotification(message, type = 'info', duration = 4000) {
  // Ensure message ends with period
  const finalMessage = message.endsWith('.') || message.endsWith('!') || message.endsWith('?') 
    ? message 
    : message + '.';

  const icons = {
    info: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    success: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
  };

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    ${icons[type]}
    <span class="notif-message">${finalMessage}</span>
    <button class="notif-close" aria-label="Dismiss">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  // Add close button functionality
  const closeBtn = notification.querySelector('.notif-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });

  notificationContainer.appendChild(notification);

  // Stagger animation based on existing notifications
  const existingNotifs = notificationContainer.querySelectorAll('.notification');
  const staggerDelay = (existingNotifs.length - 1) * 100;
  
  // Trigger animation with stagger
  setTimeout(() => {
    notification.classList.add('show');
  }, staggerDelay);

  if (duration > 0) {
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration + staggerDelay);
  }

  return notification;
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Top 10 most commonly used currencies
 */
const TOP_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN'];

/**
 * Populates a select element with currency options
 * Top currencies are listed first, followed by a separator and remaining currencies
 * @param {HTMLSelectElement} select - Select element
 */
function populateCurrencyDropdown(select) {
  // Keep the first placeholder option
  const placeholder = select.options[0];
  select.innerHTML = '';
  select.appendChild(placeholder);

  // Add top currencies group
  const topGroup = document.createElement('optgroup');
  topGroup.label = '★ Popular';
  
  for (const code of TOP_CURRENCIES) {
    const currency = currencies.find(c => c.code === code);
    if (currency) {
      const option = document.createElement('option');
      option.value = currency.code;
      option.textContent = `${currency.name} (${currency.code})`;
      topGroup.appendChild(option);
    }
  }
  select.appendChild(topGroup);

  // Add remaining currencies group
  const otherGroup = document.createElement('optgroup');
  otherGroup.label = 'All Currencies';
  
  for (const currency of currencies) {
    if (!TOP_CURRENCIES.includes(currency.code)) {
      const option = document.createElement('option');
      option.value = currency.code;
      option.textContent = `${currency.name} (${currency.code})`;
      otherGroup.appendChild(option);
    }
  }
  select.appendChild(otherGroup);
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
 * Shows the results UI (stats + chart + toggles)
 */
function showResults() {
  statsBar.classList.remove('hidden');
  chartContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  // Show time range selector
  if (timeRangeSection) {
    timeRangeSection.classList.remove('hidden');
  }
  
  // Show series toggles
  if (seriesTogglesSection) {
    seriesTogglesSection.classList.remove('hidden');
  }
  
  // Re-trigger stat card animations
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach((/** @type {HTMLElement} */ card, i) => {
    card.style.animation = 'none';
    card.offsetHeight; // Force reflow
    card.style.animation = `stat-card-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards ${0.1 * (i + 1)}s`;
  });
}

/**
 * Shows the empty state
 */
function showEmptyState() {
  statsBar.classList.add('hidden');
  chartContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  
  // Hide time range selector
  if (timeRangeSection) {
    timeRangeSection.classList.add('hidden');
  }
  
  // Hide series toggles
  if (seriesTogglesSection) {
    seriesTogglesSection.classList.add('hidden');
  }
}

/**
 * Updates the stats display for multi-provider data
 * @param {MultiProviderStats} stats - Multi-provider statistics object
 */
function updateStats(stats) {
  // Current rate - prefer Visa if available, else Mastercard
  const currentRate = stats.visa.current ?? stats.mastercard.current;
  statCurrent.textContent = currentRate?.toFixed(4) ?? '-';
  
  // High/Low across both providers
  const allHighs = [stats.visa.high, stats.mastercard.high].filter(v => v !== null);
  const allLows = [stats.visa.low, stats.mastercard.low].filter(v => v !== null);
  const high = allHighs.length > 0 ? Math.max(...allHighs) : null;
  const low = allLows.length > 0 ? Math.min(...allLows) : null;
  
  statHigh.textContent = high?.toFixed(4) ?? '-';
  statLow.textContent = low?.toFixed(4) ?? '-';
  
  // Visa markup (only Visa provides this)
  statMarkup.textContent = (stats.visa.avgMarkup === null || stats.visa.avgMarkup === undefined)
    ? '-'
    : `${stats.visa.avgMarkup.toFixed(3)}%`;
  
  // Spread between MC and Visa
  if (statSpread) {
    if (stats.currentSpread !== null) {
      const spreadSign = stats.currentSpread >= 0 ? '+' : '';
      statSpread.textContent = `${spreadSign}${stats.currentSpread.toFixed(4)}`;
      statSpread.className = 'stat-value ' + (stats.currentSpread >= 0 ? 'low' : 'high');
    } else {
      statSpread.textContent = '-';
      statSpread.className = 'stat-value';
    }
  }
  
  // Better provider indicator
  if (statBetterProvider) {
    if (stats.betterRateProvider) {
      statBetterProvider.textContent = stats.betterRateProvider === 'VISA' ? 'Visa' : 'MC';
      statBetterProvider.className = 'stat-value ' + (stats.betterRateProvider === 'VISA' ? 'high' : 'accent');
    } else {
      statBetterProvider.textContent = '-';
      statBetterProvider.className = 'stat-value';
    }
  }
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
 * Updates provider toggle visibility based on available data
 * @param {RateRecord[]} visaRecords - Visible Visa records
 * @param {RateRecord[]} mastercardRecords - Visible Mastercard records
 * @param {RateRecord[]} ecbRecords - Visible ECB records
 */
function updateToggleVisibility(visaRecords, mastercardRecords, ecbRecords) {
  const hasVisa = visaRecords.length > 0;
  const hasMc = mastercardRecords.length > 0;
  const hasEcb = ecbRecords.length > 0;
  const hasVisaMarkup = visaRecords.some(r => r.markup !== null && r.markup !== undefined);
  
  // Show/hide toggle containers
  if (toggleVisaRateContainer) {
    /** @type {HTMLElement} */ (toggleVisaRateContainer).style.display = hasVisa ? '' : 'none';
  }
  if (toggleMcRateContainer) {
    /** @type {HTMLElement} */ (toggleMcRateContainer).style.display = hasMc ? '' : 'none';
  }
  if (toggleEcbRateContainer) {
    /** @type {HTMLElement} */ (toggleEcbRateContainer).style.display = hasEcb ? '' : 'none';
  }
  if (toggleVisaMarkupContainer) {
    /** @type {HTMLElement} */ (toggleVisaMarkupContainer).style.display = hasVisaMarkup ? '' : 'none';
  }
}

/**
 * Updates the Request Archiving link and visibility based on server availability
 * @param {string} fromCurr - Source currency
 * @param {string} toCurr - Target currency
 * @param {boolean} isArchivedOnServer - Whether this pair exists in server database
 */
function updateArchivingLink(fromCurr, toCurr, isArchivedOnServer = false) {
  if (isArchivedOnServer) {
    // Hide the archiving request section if pair is archived
    archivingSection.style.display = 'none';
  } else {
    // Show the archiving request section with explanation
    archivingSection.style.display = 'block';
    const title = encodeURIComponent(`Add pair: ${fromCurr}/${toCurr}`);
    const body = encodeURIComponent(`Please add server-side archiving for the ${fromCurr}/${toCurr} currency pair.`);
    requestArchivingLink.href = `https://github.com/avishj/ForexRadar/issues/new?title=${title}&body=${body}`;
  }
}

/**
 * Handles chart zoom/pan events to update stats based on visible data range
 * @param {number} minTimestamp - Minimum visible timestamp (ms)
 * @param {number} maxTimestamp - Maximum visible timestamp (ms)
 */
function handleChartZoom(minTimestamp, maxTimestamp) {
  if (currentVisaRecords.length === 0 && currentMcRecords.length === 0 && currentEcbRecords.length === 0) return;
  
  // Deactivate time range buttons on manual zoom
  const timeRangeButtons = document.querySelectorAll('.time-range-btn');
  timeRangeButtons.forEach(btn => btn.classList.remove('active'));
  
  // Filter records to visible range for each provider
  const { visaRecords, mastercardRecords, ecbRecords } = ChartManager.getVisibleRecordsByProvider(
    currentVisaRecords, 
    currentMcRecords,
    currentEcbRecords,
    minTimestamp, 
    maxTimestamp
  );
  
  // Check data availability in visible range
  const hasVisa = visaRecords.length > 0;
  const hasMc = mastercardRecords.length > 0;
  const hasEcb = ecbRecords.length > 0;
  const hasVisaMarkup = visaRecords.some(r => r.markup !== null && r.markup !== undefined);
  
  // Update toggle visibility based on visible data
  updateToggleVisibility(visaRecords, mastercardRecords, ecbRecords);
  
  // Update chart legend visibility to match data availability
  ChartManager.setSeriesVisibility({
    visaRate: hasVisa,
    mastercardRate: hasMc,
    ecbRate: hasEcb,
    visaMarkup: hasVisaMarkup
  });
  
  if (visaRecords.length > 0 || mastercardRecords.length > 0 || ecbRecords.length > 0) {
    // Recalculate multi-provider stats for visible data
    const stats = DataManager.calculateMultiProviderStats(visaRecords, mastercardRecords, ecbRecords);
    updateStats(stats);
  }
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

  // Show loader
  showLoader('Fetching history...');

  try {
    // Convert time range key to DateRange object
    const range = parseTimeRange(currentTimeRange);
    
    // Fetch data with progress updates (fetches all providers)
    const result = await DataManager.fetchRates(fromCurr, toCurr, range, {
      onProgress: (stage, message) => {
        loaderText.textContent = message;
      }
    });

    if (result.records.length === 0) {
      hideLoader();
      showEmptyState();
      updateArchivingLink(fromCurr, toCurr, false);
      showNotification('No data available for this pair', 'warning');
      return;
    }

    // Store datasets for zoom stats updates
    currentVisaRecords = result.visaRecords;
    currentMcRecords = result.mastercardRecords;
    currentEcbRecords = result.ecbRecords;
    currentFromCurr = fromCurr;
    currentToCurr = toCurr;

    // Check if pair is archived on server (has server data)
    const isArchivedOnServer = result.stats.hasServerData;
    
    // Update archiving link visibility
    updateArchivingLink(fromCurr, toCurr, isArchivedOnServer);

    // Calculate multi-provider stats
    const stats = DataManager.calculateMultiProviderStats(result.visaRecords, result.mastercardRecords, result.ecbRecords);

    // Update UI
    hideLoader();
    showResults();
    updateStats(stats);
    updateLastUpdated(stats.dateRange.end);

    // Set up zoom callback before initializing/updating chart
    ChartManager.setZoomCallback(handleChartZoom);

    // Render chart with all providers
    if (ChartManager.isChartInitialized()) {
      ChartManager.updateChart(result.visaRecords, result.mastercardRecords, result.ecbRecords, fromCurr, toCurr);
    } else {
      ChartManager.initChart('chart', result.visaRecords, result.mastercardRecords, result.ecbRecords, fromCurr, toCurr);
    }
    
    // Update toggle visibility based on available data for full range
    updateToggleVisibility(result.visaRecords, result.mastercardRecords, result.ecbRecords);
    
    // Restore full series visibility based on full data availability
    const hasVisa = result.visaRecords.length > 0;
    const hasMc = result.mastercardRecords.length > 0;
    const hasEcb = result.ecbRecords.length > 0;
    const hasVisaMarkup = result.visaRecords.some(r => r.markup !== null && r.markup !== undefined);
    ChartManager.setSeriesVisibility({
      visaRate: hasVisa,
      mastercardRate: hasMc,
      ecbRate: hasEcb,
      visaMarkup: hasVisaMarkup
    });

    // Show summary notification
    const { fromCache, fromServer, fromLive, visaCount, mastercardCount, ecbCount } = result.stats;
    let source = [];
    if (fromCache > 0) source.push(`${fromCache} cached`);
    if (fromServer > 0) source.push(`${fromServer} from server`);
    if (fromLive > 0) source.push(`${fromLive} live`);
    
    // Show special notification if not archived on server
    if (!isArchivedOnServer) {
      showNotification(`This pair is not archived on server. Only showing last ~7 days of data.`, 'warning', 6000);
    }
    
    // Build provider summary
    const providerSummary = [];
    if (visaCount > 0) providerSummary.push(`${visaCount} Visa`);
    if (mastercardCount > 0) providerSummary.push(`${mastercardCount} MC`);
    if (ecbCount > 0) providerSummary.push(`${ecbCount} ECB`);
    
    showNotification(`Loaded ${providerSummary.join(' + ')} records (${source.join(', ')})`, 'success');

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
    // Save selection to localStorage
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;
    if (fromCurr && toCurr) {
      localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from: fromCurr, to: toCurr }));
    }
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

  // Restore last selected pair or use defaults (USD -> INR)
  try {
    const lastPair = localStorage.getItem('forexRadar_lastPair');
    if (lastPair) {
      const { from, to } = JSON.parse(lastPair);
      // Validate that the currencies exist in our list
      const validFrom = currencies.find(c => c.code === from);
      const validTo = currencies.find(c => c.code === to);
      if (validFrom && validTo) {
        fromSelect.value = from;
        toSelect.value = to;
      } else {
        // Invalid saved pair, use defaults
        fromSelect.value = 'USD';
        toSelect.value = 'INR';
      }
    } else {
      // No saved pair, use defaults
      fromSelect.value = 'USD';
      toSelect.value = 'INR';
    }
  } catch (error) {
    // Error parsing saved pair, use defaults
    console.error('Error restoring last pair:', error);
    fromSelect.value = 'USD';
    toSelect.value = 'INR';
  }

  // Add event listeners with debouncing
  fromSelect.addEventListener('change', handleSelectionChange);
  toSelect.addEventListener('change', handleSelectionChange);

  // Series toggle event listeners
  if (toggleVisaRate) {
    toggleVisaRate.addEventListener('change', () => {
      ChartManager.setSeriesVisibility({ visaRate: toggleVisaRate.checked });
    });
  }
  if (toggleMcRate) {
    toggleMcRate.addEventListener('change', () => {
      ChartManager.setSeriesVisibility({ mastercardRate: toggleMcRate.checked });
    });
  }
  if (toggleEcbRate) {
    toggleEcbRate.addEventListener('change', () => {
      ChartManager.setSeriesVisibility({ ecbRate: toggleEcbRate.checked });
    });
  }
  if (toggleVisaMarkup) {
    toggleVisaMarkup.addEventListener('change', () => {
      ChartManager.setSeriesVisibility({ visaMarkup: toggleVisaMarkup.checked });
    });
  }

  // Time range button event listeners
  const timeRangeButtons = document.querySelectorAll('.time-range-btn');
  timeRangeButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      timeRangeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update current range and reload
      const rangeKey = /** @type {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} */ (button.getAttribute('data-range'));
      if (rangeKey && rangeKey !== currentTimeRange) {
        currentTimeRange = rangeKey;
        localStorage.setItem('forexRadar_timeRange', rangeKey);
        loadCurrencyPair();
      }
    });
  });
  
  // Restore last time range selection
  try {
    const savedRange = localStorage.getItem('forexRadar_timeRange');
    if (savedRange && ['1m', '3m', '6m', '1y', '5y', 'all'].includes(savedRange)) {
      currentTimeRange = /** @type {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} */ (savedRange);
      // Update button active state
      timeRangeButtons.forEach(btn => {
        if (btn.getAttribute('data-range') === savedRange) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  } catch (error) {
    console.error('Error restoring time range:', error);
  }

  // Listen for theme changes to update chart
  window.addEventListener('themechange', () => {
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;
    if (fromCurr && toCurr && ChartManager.isChartInitialized()) {
      ChartManager.refreshChartTheme(fromCurr, toCurr);
    }
  });

  // Initial load
  loadCurrencyPair();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
