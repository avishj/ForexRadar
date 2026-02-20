/**
 * Forex Radar - Main Application
 * 
 * Orchestrates all UI modules and handles data flow.
 * Supports multi-provider data (Visa, Mastercard, ECB).
 * 
 * @module app
 */

import { currencies } from './currencies.js';
import * as DataManager from './data-manager.js';
import * as ChartManager from './chart-manager.js';

import { SearchableDropdown } from './ui/dropdown.js';
import { initNotifications, showNotification } from './ui/notifications.js';
import { showShortcutsModal, hideShortcutsModal, isShortcutsModalOpen } from './ui/shortcuts-modal.js';
import { initRecentPairs, saveRecentPair, renderRecentPairs } from './ui/recent-pairs.js';
import { initTimeRange, updateActiveButton, deactivateAllButtons, parseTimeRange, isValidTimeRange, triggerRangeByKey, refreshIndicatorPosition } from './ui/time-range.js';
import { initSeriestoggles, updateToggleVisibility, getVisibilityFromData } from './ui/series-toggles.js';
import { initActions, triggerCopyRate, triggerShareUrl, triggerDownloadChart } from './ui/actions.js';
import { setOdometerValue } from './ui/odometer.js';

/** @typedef {import('../../shared/types.js').RateRecord} RateRecord */
/** @typedef {import('../../shared/types.js').MultiProviderStats} MultiProviderStats */
/** @typedef {import('../../shared/types.js').CurrencyCode} CurrencyCode */
/** @typedef {import('./ui/time-range.js').TimeRangeKey} TimeRangeKey */

// ============================================================================
// DOM Elements
// ============================================================================

/** @type {SearchableDropdown} */
let fromSelect;
/** @type {SearchableDropdown} */
let toSelect;
/** @type {HTMLButtonElement} */
const swapButton = /** @type {HTMLButtonElement} */ (document.getElementById('swap-currencies'));
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

// Stats elements
const statCurrent = document.getElementById('stat-current');
const statPercentile = document.getElementById('stat-percentile');
const statHigh = document.getElementById('stat-high');
const statLow = document.getElementById('stat-low');
const statMarkup = document.getElementById('stat-markup');
const statSpread = document.getElementById('stat-spread');
const statBetterProvider = document.getElementById('stat-better-provider');

// ============================================================================
// State
// ============================================================================

/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null;
const DEBOUNCE_MS = 300;

/** @type {boolean} Flag to prevent URL updates during initialization */
let isInitializing = true;

/** @type {RateRecord[]} */
let currentVisaRecords = [];
/** @type {RateRecord[]} */
let currentMcRecords = [];
/** @type {RateRecord[]} */
let currentEcbRecords = [];

/** @type {TimeRangeKey} */
let currentTimeRange = '1y';

// ============================================================================
// URL Deep-Linking
// ============================================================================

/**
 * Parses URL query parameters for currency pair and time range
 * @returns {{ from: string|null, to: string|null, range: string|null }}
 */
function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    from: params.get('from')?.toUpperCase() || null,
    to: params.get('to')?.toUpperCase() || null,
    range: params.get('range')?.toLowerCase() || null
  };
}

/**
 * Updates URL query parameters without page reload
 */
function updateURL() {
  if (isInitializing) return;
  
  const fromCurr = fromSelect.value;
  const toCurr = toSelect.value;
  
  if (!fromCurr || !toCurr) return;
  
  const url = new URL(window.location.href);
  url.searchParams.set('from', fromCurr);
  url.searchParams.set('to', toCurr);
  url.searchParams.set('range', currentTimeRange);
  
  history.replaceState({ from: fromCurr, to: toCurr, range: currentTimeRange }, '', url);
}

/**
 * Validates if a currency code exists in our currency list
 * @param {string} code
 * @returns {boolean}
 */
function isValidCurrency(code) {
  return currencies.some(c => c.code === code);
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Shows the loader with a message
 * @param {string} message
 */
function showLoader(message = 'Loading...') {
  loaderText.textContent = message;
  loader.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

function hideLoader() {
  loader.classList.add('hidden');
}

function showResults() {
  statsBar.classList.remove('hidden');
  chartContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  if (timeRangeSection) {
    timeRangeSection.classList.remove('hidden');
    // Refresh indicator position now that section is visible
    requestAnimationFrame(() => refreshIndicatorPosition());
  }
  
  if (seriesTogglesSection) {
    seriesTogglesSection.classList.remove('hidden');
  }
  
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach((/** @type {HTMLElement} */ card, i) => {
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = `stat-card-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards ${0.1 * (i + 1)}s`;
  });
}

function showEmptyState() {
  statsBar.classList.add('hidden');
  chartContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  
  if (timeRangeSection) {
    timeRangeSection.classList.add('hidden');
  }
  
  if (seriesTogglesSection) {
    seriesTogglesSection.classList.add('hidden');
  }
}



/**
 * Calculates the percentile rank of the current rate
 * @param {number} currentRate
 * @param {RateRecord[]} allRecords
 * @returns {number|null}
 */
function calculateRatePercentile(currentRate, allRecords) {
	if (currentRate == null || allRecords.length < 2) return null;
  
  const rates = allRecords.map(r => r.rate).filter(r => r !== null && r !== undefined);
  if (rates.length < 2) return null;
  
  const betterCount = rates.filter(r => r > currentRate).length;
  const percentile = (betterCount / rates.length) * 100;
  
  return Math.round(percentile);
}

/**
 * Updates the percentile stat card display
 * @param {number|null} percentile
 */
function updatePercentileBadge(percentile) {
  if (!statPercentile) return;
  
  if (percentile === null || isNaN(percentile)) {
    statPercentile.textContent = '-';
    statPercentile.classList.remove('excellent', 'good', 'average', 'poor');
    return;
  }
  
  statPercentile.textContent = `${percentile}%ile`;
  statPercentile.classList.remove('excellent', 'good', 'average', 'poor');
  
  if (percentile >= 75) {
    statPercentile.classList.add('excellent');
  } else if (percentile >= 50) {
    statPercentile.classList.add('good');
  } else if (percentile >= 25) {
    statPercentile.classList.add('average');
  } else {
    statPercentile.classList.add('poor');
  }
}

/** @type {RateRecord[]} */
let _cachedRecordsForPercentile = [];

/**
 * Updates the stats display for multi-provider data
 * @param {MultiProviderStats} stats
 */
function updateStats(stats) {
  const currentRate = stats.visa.current ?? stats.mastercard.current;
  setOdometerValue(statCurrent, currentRate, 4);
  
	const allHighs = [stats.visa.high, stats.mastercard.high].filter(v => typeof v === 'number');
	const allLows = [stats.visa.low, stats.mastercard.low].filter(v => typeof v === 'number');
  const high = allHighs.length > 0 ? Math.max(.../** @type {number[]} */ (allHighs)) : null;
  const low = allLows.length > 0 ? Math.min(.../** @type {number[]} */ (allLows)) : null;
  
  setOdometerValue(statHigh, high, 4);
  setOdometerValue(statLow, low, 4);
  setOdometerValue(statMarkup, stats.visa.avgMarkup, 3, '%');
  
  if (statSpread) {
    if (stats.currentSpread !== null) {
      const spreadSign = stats.currentSpread >= 0 ? '+' : '';
      setOdometerValue(statSpread, stats.currentSpread, 4, '', spreadSign);
      statSpread.className = 'stat-value ' + (stats.currentSpread >= 0 ? 'low' : 'high');
    } else {
      setOdometerValue(statSpread, null, 4);
      statSpread.className = 'stat-value';
    }
  }
  
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
 * @param {string} dateStr
 */
function updateLastUpdated(dateStr) {
  if (dateStr) {
    lastUpdated.textContent = `Last data: ${dateStr}`;
  } else {
    lastUpdated.textContent = '';
  }
}

/**
 * Updates the Request Archiving link visibility
 * @param {string} fromCurr
 * @param {string} toCurr
 * @param {boolean} isArchivedOnServer
 */
function updateArchivingLink(fromCurr, toCurr, isArchivedOnServer = false) {
  if (isArchivedOnServer) {
    archivingSection.classList.add('hidden');
  } else {
    archivingSection.classList.remove('hidden');
    const title = encodeURIComponent(`Add pair: ${fromCurr}/${toCurr}`);
    const body = encodeURIComponent(`Please add server-side archiving for the ${fromCurr}/${toCurr} currency pair.`);
    requestArchivingLink.href = `https://github.com/avishj/ForexRadar/issues/new?title=${title}&body=${body}`;
  }
}

/**
 * Handles chart zoom/pan events to update stats
 * @param {string} minDate
 * @param {string} maxDate
 */
function handleChartZoom(minDate, maxDate) {
  if (currentVisaRecords.length === 0 && currentMcRecords.length === 0 && currentEcbRecords.length === 0) return;
  
  deactivateAllButtons();
  
  const { visaRecords, mastercardRecords, ecbRecords } = ChartManager.getVisibleRecordsByProvider(
    currentVisaRecords, 
    currentMcRecords,
    currentEcbRecords,
    minDate, 
    maxDate
  );
  
  updateToggleVisibility(visaRecords, mastercardRecords, ecbRecords);
  
  const visibility = getVisibilityFromData(visaRecords, mastercardRecords, ecbRecords);
  ChartManager.setSeriesVisibility(visibility);
  
  if (visaRecords.length > 0 || mastercardRecords.length > 0 || ecbRecords.length > 0) {
    const stats = DataManager.calculateMultiProviderStats(visaRecords, mastercardRecords, ecbRecords);
    updateStats(stats);
    
    const allRecords = [...visaRecords, ...mastercardRecords];
    _cachedRecordsForPercentile = allRecords;
    const currentRate = stats.visa.current ?? stats.mastercard.current;
    const percentile = calculateRatePercentile(currentRate, allRecords);
    updatePercentileBadge(percentile);
  }
}

// ============================================================================
// Core Logic
// ============================================================================

async function loadCurrencyPair() {
  const fromCurr = fromSelect.value;
  const toCurr = toSelect.value;

  if (!fromCurr || !toCurr) {
    showEmptyState();
    return;
  }

  if (fromCurr === toCurr) {
    showNotification('Please select different currencies', 'warning');
    return;
  }

  showLoader('Fetching history...');

  try {
    const range = parseTimeRange(currentTimeRange);
    
    const result = await DataManager.fetchRates(
      /** @type {CurrencyCode} */ (fromCurr),
      /** @type {CurrencyCode} */ (toCurr),
      range,
      {
        onProgress: (/** @type {string} */ _stage, /** @type {string} */ message) => {
          loaderText.textContent = message;
        }
      }
    );

    if (result.records.length === 0) {
      hideLoader();
      showEmptyState();
      updateArchivingLink(fromCurr, toCurr, false);
      showNotification('No data available for this pair', 'warning');
      return;
    }

    currentVisaRecords = result.visaRecords;
    currentMcRecords = result.mastercardRecords;
    currentEcbRecords = result.ecbRecords;

    const isArchivedOnServer = result.stats.hasServerData;
    updateArchivingLink(fromCurr, toCurr, isArchivedOnServer);

    const stats = DataManager.calculateMultiProviderStats(result.visaRecords, result.mastercardRecords, result.ecbRecords);

    hideLoader();
    showResults();
    updateStats(stats);
    updateLastUpdated(stats.dateRange.end);

    const allRecords = [...result.visaRecords, ...result.mastercardRecords];
    const currentRate = stats.visa.current ?? stats.mastercard.current;
    const percentile = calculateRatePercentile(currentRate, allRecords);
    updatePercentileBadge(percentile);

    ChartManager.setZoomCallback(handleChartZoom);

    if (ChartManager.isChartInitialized()) {
      ChartManager.updateChart(result.visaRecords, result.mastercardRecords, result.ecbRecords, fromCurr, toCurr);
    } else {
      ChartManager.initChart('chart', result.visaRecords, result.mastercardRecords, result.ecbRecords, fromCurr, toCurr);
    }
    
    updateToggleVisibility(result.visaRecords, result.mastercardRecords, result.ecbRecords);
    
    const visibility = getVisibilityFromData(result.visaRecords, result.mastercardRecords, result.ecbRecords);
    ChartManager.setSeriesVisibility(visibility);

    const { fromCache, fromServer, fromLive, visaCount, mastercardCount, ecbCount } = result.stats;
    const source = [];
    if (fromCache > 0) source.push(`${fromCache} cached`);
    if (fromServer > 0) source.push(`${fromServer} from server`);
    if (fromLive > 0) source.push(`${fromLive} live`);
    
    if (!isArchivedOnServer) {
      showNotification(`This pair is not archived on server. Only showing last ~7 days of data.`, 'warning', 6000);
    }
    
    const providerSummary = [];
    if (visaCount > 0) providerSummary.push(`${visaCount} Visa`);
    if (mastercardCount > 0) providerSummary.push(`${mastercardCount} MC`);
    if (ecbCount > 0) providerSummary.push(`${ecbCount} ECB`);
    
    showNotification(`Loaded ${providerSummary.join(' + ')} records (${source.join(', ')})`, 'success');

  } catch (error) {
    hideLoader();
    showEmptyState();
    showNotification(`Error: ${/** @type {Error} */ (error).message}`, 'error');
    console.error('Failed to load currency pair:', error);
  }
}

function handleSelectionChange() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;
    if (fromCurr && toCurr) {
      localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from: fromCurr, to: toCurr }));
      saveRecentPair(fromCurr, toCurr);
      updateURL();
    }
    loadCurrencyPair();
  }, DEBOUNCE_MS);
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
    
    if (e.key === 'Escape') {
      if (isShortcutsModalOpen()) {
        hideShortcutsModal();
        e.preventDefault();
        return;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }
    
    if (isInputField) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    
    const key = e.key.toLowerCase();
    
    switch (key) {
      case 's':
        e.preventDefault();
        swapButton?.click();
        break;
        
      case '/': {
        if (e.shiftKey) {
          e.preventDefault();
          showShortcutsModal();
          break;
        }
        e.preventDefault();
        const fromInput = document.getElementById('from-currency-input');
        if (fromInput) {
          fromInput.focus();
          /** @type {HTMLInputElement} */ (fromInput).select();
        }
        break;
      }
        
      case 'c':
        e.preventDefault();
        triggerCopyRate();
        break;
        
      case 'l':
        e.preventDefault();
        triggerShareUrl();
        break;
        
      case 'd':
        e.preventDefault();
        triggerDownloadChart();
        break;
        
      case '?':
        e.preventDefault();
        showShortcutsModal();
        break;
        
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        e.preventDefault();
        triggerRangeByKey(key);
        break;
    }
  });
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
  const fromDropdownContainer = document.getElementById('from-currency-dropdown');
  const toDropdownContainer = document.getElementById('to-currency-dropdown');
  
  if (fromDropdownContainer && toDropdownContainer) {
    fromSelect = new SearchableDropdown(fromDropdownContainer, currencies);
    toSelect = new SearchableDropdown(toDropdownContainer, currencies);
  }

  const notificationContainer = document.getElementById('notification-container');
  if (notificationContainer) {
    initNotifications(notificationContainer);
  }

  const recentPairsContainer = document.getElementById('recent-pairs');
  const recentPairsList = document.getElementById('recent-pairs-list');
  if (recentPairsContainer && recentPairsList) {
    initRecentPairs(
      { container: recentPairsContainer, list: recentPairsList },
      {
        isValidCurrency,
        getFromValue: () => fromSelect.value,
        getToValue: () => toSelect.value,
        onPairSelect: (from, to) => {
          fromSelect.value = from;
          toSelect.value = to;
          localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from, to }));
          updateURL();
          loadCurrencyPair();
        }
      }
    );
  }

  initTimeRange({
    getCurrentRange: () => currentTimeRange,
    onRangeChange: (range) => {
      currentTimeRange = range;
      localStorage.setItem('forexRadar_timeRange', range);
      updateURL();
      loadCurrencyPair();
    }
  });

  initSeriestoggles((visibility) => {
    ChartManager.setSeriesVisibility(visibility);
  });

  initActions({
    getFromCurrency: () => fromSelect.value,
    getToCurrency: () => toSelect.value,
    getCurrentRate: () => statCurrent?.textContent || '-',
    getTimeRange: () => currentTimeRange,
    isChartReady: () => ChartManager.isChartInitialized(),
    exportChart: (filename) => ChartManager.exportChartAsPng(filename)
  });

  const urlParams = parseURLParams();
  let selectedFrom = null;
  let selectedTo = null;
  let selectedRange = null;
  
  if (urlParams.from && urlParams.to && isValidCurrency(urlParams.from) && isValidCurrency(urlParams.to)) {
    selectedFrom = urlParams.from;
    selectedTo = urlParams.to;
  }
  if (urlParams.range && isValidTimeRange(urlParams.range)) {
    selectedRange = /** @type {TimeRangeKey} */ (urlParams.range);
  }
  
  if (!selectedFrom || !selectedTo) {
    try {
      const lastPair = localStorage.getItem('forexRadar_lastPair');
      if (lastPair) {
        const { from, to } = JSON.parse(lastPair);
        if (isValidCurrency(from) && isValidCurrency(to)) {
          selectedFrom = selectedFrom || from;
          selectedTo = selectedTo || to;
        }
      }
    } catch (error) {
      console.error('Error restoring last pair:', error);
    }
  }
  
  if (!selectedRange) {
    try {
      const savedRange = localStorage.getItem('forexRadar_timeRange');
      if (savedRange && isValidTimeRange(savedRange)) {
        selectedRange = /** @type {TimeRangeKey} */ (savedRange);
      }
    } catch (error) {
      console.error('Error restoring time range:', error);
    }
  }
  
  fromSelect.value = selectedFrom || 'USD';
  toSelect.value = selectedTo || 'INR';
  currentTimeRange = selectedRange || '1y';

  fromSelect.addEventListener('change', handleSelectionChange);
  toSelect.addEventListener('change', handleSelectionChange);
  
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.from && event.state.to) {
      if (isValidCurrency(event.state.from) && isValidCurrency(event.state.to)) {
        fromSelect.value = event.state.from;
        toSelect.value = event.state.to;
        if (event.state.range && isValidTimeRange(event.state.range)) {
          currentTimeRange = event.state.range;
          updateActiveButton(currentTimeRange);
        }
        loadCurrencyPair();
      }
    }
  });

  if (swapButton) {
    swapButton.addEventListener('click', () => {
      const fromCurr = fromSelect.value;
      const toCurr = toSelect.value;
      
      if (!fromCurr || !toCurr) return;
      
      swapButton.classList.add('swapping');
      swapButton.addEventListener('animationend', () => {
        swapButton.classList.remove('swapping');
      }, { once: true });
      
      const selectorGrid = document.querySelector('.selector-grid');
      const selectorGroups = selectorGrid?.querySelectorAll('.selector-group');
      const fromGroup = /** @type {HTMLElement|undefined} */ (selectorGroups?.[0]);
      const toGroup = /** @type {HTMLElement|undefined} */ (selectorGroups?.[1]);
      
      if (fromGroup && toGroup && window.matchMedia('(min-width: 769px)').matches) {
        const fromRect = fromGroup.getBoundingClientRect();
        const toRect = toGroup.getBoundingClientRect();
        const distance = toRect.left - fromRect.left;
        
        const DURATION = 500;
        const ARC_HEIGHT = 50;
        
        const leftKeyframes = [
          { transform: 'translate3d(0, 0, 0)', offset: 0 },
          { transform: `translate3d(${distance * 0.5}px, -${ARC_HEIGHT}px, 0)`, offset: 0.5 },
          { transform: `translate3d(${distance}px, 0, 0)`, offset: 1 }
        ];
        
        const rightKeyframes = [
          { transform: 'translate3d(0, 0, 0)', offset: 0 },
          { transform: `translate3d(${-distance * 0.5}px, ${ARC_HEIGHT}px, 0)`, offset: 0.5 },
          { transform: `translate3d(${-distance}px, 0, 0)`, offset: 1 }
        ];
        
        const options = {
          duration: DURATION,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: /** @type {FillMode} */ ('forwards')
        };
        
        fromGroup.style.zIndex = '2';
        toGroup.style.zIndex = '1';
        
        const leftAnim = fromGroup.animate(leftKeyframes, options);
        const rightAnim = toGroup.animate(rightKeyframes, options);
        
        const cleanup = () => {
          leftAnim.cancel();
          rightAnim.cancel();
          fromGroup.style.zIndex = '';
          toGroup.style.zIndex = '';
          fromSelect.value = toCurr;
          toSelect.value = fromCurr;
          localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from: toCurr, to: fromCurr }));
          saveRecentPair(toCurr, fromCurr);
          updateURL();
          loadCurrencyPair();
        };
        
        leftAnim.onfinish = cleanup;
        leftAnim.oncancel = cleanup;
      } else {
        fromSelect.value = toCurr;
        toSelect.value = fromCurr;
        localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from: toCurr, to: fromCurr }));
        saveRecentPair(toCurr, fromCurr);
        updateURL();
        loadCurrencyPair();
      }
    });
  }

  window.addEventListener('themechange', () => {
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;
    if (fromCurr && toCurr && ChartManager.isChartInitialized()) {
      ChartManager.refreshChartTheme(fromCurr, toCurr);
    }
  });

  if (fromSelect.value && toSelect.value) {
    const url = new URL(window.location.href);
    url.searchParams.set('from', fromSelect.value);
    url.searchParams.set('to', toSelect.value);
    url.searchParams.set('range', currentTimeRange);
    history.replaceState({ from: fromSelect.value, to: toSelect.value, range: currentTimeRange }, '', url);
  }

  setupKeyboardShortcuts();
  
  const shortcutsBtn = document.getElementById('show-shortcuts-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => showShortcutsModal());
  }
  
  updateActiveButton(currentTimeRange);
  
  isInitializing = false;
  
  renderRecentPairs();
  
  loadCurrencyPair();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
