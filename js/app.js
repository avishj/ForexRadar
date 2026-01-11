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
/** @typedef {import('../shared/types.js').DateRange} DateRange */
/** @typedef {import('../shared/types.js').CurrencyCode} CurrencyCode */

// ============================================================================
// Searchable Dropdown Class
// ============================================================================

/** Top currencies to show first */
const TOP_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'CNY', 'MXN'];

/**
 * Searchable dropdown component with type-ahead filtering
 */
class SearchableDropdown {
  /**
   * @param {HTMLElement} container - The dropdown container element
   * @param {Array<{code: string, name: string}>} items - Currency items
   */
  constructor(container, items) {
    this.container = container;
    this.items = items;
    this.input = /** @type {HTMLInputElement} */ (container.querySelector('.searchable-input'));
    this.hiddenInput = /** @type {HTMLInputElement} */ (container.querySelector('input[type="hidden"]'));
    this.list = /** @type {HTMLElement} */ (container.querySelector('.dropdown-list'));
    this.highlightedIndex = -1;
    this.isOpen = false;
    this.filteredItems = [];
    
    this.init();
  }
  
  init() {
    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '×';
    clearBtn.setAttribute('aria-label', 'Clear selection');
    clearBtn.tabIndex = -1;
    this.container.appendChild(clearBtn);
    this.clearBtn = clearBtn;
    
    // Build initial list
    this.renderList('');
    
    // Event listeners
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('blur', (e) => this.handleBlur(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    clearBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      this.clear();
    });
    
    this.list.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
    });
    
    this.list.addEventListener('click', (e) => {
      const item = /** @type {HTMLElement} */ (e.target).closest('.dropdown-item');
      if (item) {
        const code = item.dataset.code;
        if (code) this.select(code);
      }
    });
    
    // Handle hover
    this.list.addEventListener('mouseover', (e) => {
      const item = /** @type {HTMLElement} */ (e.target).closest('.dropdown-item');
      if (item) {
        const index = parseInt(item.dataset.index || '-1', 10);
        if (index >= 0) this.highlight(index);
      }
    });
  }
  
  /** Get the current value */
  get value() {
    return this.hiddenInput.value;
  }
  
  /** Set the current value */
  set value(code) {
    this.hiddenInput.value = code;
    const currency = this.items.find(c => c.code === code);
    if (currency) {
      this.input.value = `${currency.code} – ${currency.name}`;
      this.container.classList.add('has-value');
    } else {
      this.input.value = '';
      this.container.classList.remove('has-value');
    }
  }
  
  /**
   * Add event listener (mimics HTMLElement interface)
   * @param {string} event 
   * @param {EventListener} handler 
   */
  addEventListener(event, handler) {
    this.hiddenInput.addEventListener(event, handler);
  }
  
  /**
   * Dispatch a change event
   */
  dispatchChange() {
    const event = new Event('change', { bubbles: true });
    this.hiddenInput.dispatchEvent(event);
  }
  
  /**
   * Render the dropdown list
   * @param {string} query - Search query
   */
  renderList(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Filter items
    if (lowerQuery) {
      this.filteredItems = this.items.filter(item => 
        item.code.toLowerCase().includes(lowerQuery) ||
        item.name.toLowerCase().includes(lowerQuery)
      );
    } else {
      this.filteredItems = [...this.items];
    }
    
    // Build HTML
    let html = '';
    
    if (this.filteredItems.length === 0) {
      html = '<div class="dropdown-no-results">No currencies found</div>';
    } else {
      // Split into popular and other
      const popular = this.filteredItems.filter(c => TOP_CURRENCIES.includes(c.code));
      const other = this.filteredItems.filter(c => !TOP_CURRENCIES.includes(c.code));
      
      // Sort popular by TOP_CURRENCIES order
      popular.sort((a, b) => TOP_CURRENCIES.indexOf(a.code) - TOP_CURRENCIES.indexOf(b.code));
      
      let globalIndex = 0;
      
      if (popular.length > 0 && !lowerQuery) {
        html += '<div class="dropdown-group-header">★ Popular</div>';
        popular.forEach(item => {
          html += this.renderItem(item, globalIndex++, lowerQuery);
        });
      } else if (popular.length > 0 && lowerQuery) {
        // When searching, mix popular with results
        const combined = [...popular, ...other];
        combined.forEach(item => {
          html += this.renderItem(item, globalIndex++, lowerQuery);
        });
        this.filteredItems = combined;
        this.list.innerHTML = html;
        return;
      }
      
      if (other.length > 0 && !lowerQuery) {
        html += '<div class="dropdown-group-header">All Currencies</div>';
      }
      other.forEach(item => {
        html += this.renderItem(item, globalIndex++, lowerQuery);
      });
      
      // Update filteredItems to match render order
      this.filteredItems = [...popular, ...other];
    }
    
    this.list.innerHTML = html;
  }
  
  /**
   * Render a single item
   * @param {{code: string, name: string}} item 
   * @param {number} index 
   * @param {string} query 
   * @returns {string}
   */
  renderItem(item, index, query) {
    const isSelected = item.code === this.value;
    const code = query ? this.highlightMatch(item.code, query) : item.code;
    const name = query ? this.highlightMatch(item.name, query) : item.name;
    
    return `
      <div class="dropdown-item${isSelected ? ' selected' : ''}" 
           data-code="${item.code}" 
           data-index="${index}"
           role="option"
           aria-selected="${isSelected}">
        <span class="dropdown-item-code">${code}</span>
        <span class="dropdown-item-name">${name}</span>
      </div>
    `;
  }
  
  /**
   * Highlight matching text
   * @param {string} text 
   * @param {string} query 
   * @returns {string}
   */
  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
  
  handleInput() {
    const query = this.input.value;
    this.renderList(query);
    this.highlightedIndex = -1;
    if (!this.isOpen) this.open();
  }
  
  /**
   * @param {FocusEvent} e 
   */
  handleBlur(e) {
    // Small delay to allow click events on dropdown items
    setTimeout(() => {
      this.close();
      // Restore display value if input was cleared but value exists
      if (this.value && !this.input.value.includes(this.value)) {
        const currency = this.items.find(c => c.code === this.value);
        if (currency) {
          this.input.value = `${currency.code} – ${currency.name}`;
        }
      }
    }, 150);
  }
  
  /**
   * @param {KeyboardEvent} e 
   */
  handleKeydown(e) {
    const items = this.list.querySelectorAll('.dropdown-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.highlight(Math.min(this.highlightedIndex + 1, items.length - 1));
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.highlight(Math.max(this.highlightedIndex - 1, 0));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.highlightedIndex >= 0 && this.filteredItems[this.highlightedIndex]) {
          this.select(this.filteredItems[this.highlightedIndex].code);
        } else if (this.filteredItems.length === 1) {
          // Auto-select if only one result
          this.select(this.filteredItems[0].code);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.close();
        this.input.blur();
        break;
        
      case 'Tab':
        this.close();
        break;
    }
  }
  
  /**
   * Highlight an item
   * @param {number} index 
   */
  highlight(index) {
    const items = this.list.querySelectorAll('.dropdown-item');
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });
    this.highlightedIndex = index;
    
    // Scroll into view
    const highlighted = items[index];
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
  }
  
  /**
   * Select a currency
   * @param {string} code 
   */
  select(code) {
    const prevValue = this.value;
    this.value = code;
    this.close();
    this.input.blur();
    
    if (prevValue !== code) {
      this.dispatchChange();
    }
  }
  
  /** Clear selection */
  clear() {
    this.hiddenInput.value = '';
    this.input.value = '';
    this.container.classList.remove('has-value');
    this.renderList('');
    this.input.focus();
  }
  
  /** Open the dropdown */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.list.classList.add('open');
    this.input.setAttribute('aria-expanded', 'true');
    this.renderList(this.input.value);
    
    // If value is set, scroll to it
    if (this.value) {
      setTimeout(() => {
        const selected = this.list.querySelector('.selected');
        if (selected) {
          selected.scrollIntoView({ block: 'center' });
        }
      }, 50);
    }
  }
  
  /** Close the dropdown */
  close() {
    this.isOpen = false;
    this.list.classList.remove('open');
    this.input.setAttribute('aria-expanded', 'false');
    this.highlightedIndex = -1;
  }
}

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
/** @type {HTMLElement} */
const notificationContainer = /** @type {HTMLElement} */ (document.getElementById('notification-container'));
/** @type {HTMLElement} */
const recentPairsContainer = /** @type {HTMLElement} */ (document.getElementById('recent-pairs'));
/** @type {HTMLElement} */
const recentPairsList = /** @type {HTMLElement} */ (document.getElementById('recent-pairs-list'));

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

/** @type {boolean} Flag to prevent URL updates during initialization */
let isInitializing = true;

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
 * @returns {DateRange}
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
 * Uses replaceState to avoid cluttering browser history
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
 * @param {string} code - Currency code to validate
 * @returns {boolean}
 */
function isValidCurrency(code) {
  return currencies.some(c => c.code === code);
}

/**
 * Validates if a time range key is valid
 * @param {string} range - Time range key to validate
 * @returns {boolean}
 */
function isValidTimeRange(range) {
  return ['1m', '3m', '6m', '1y', '5y', 'all'].includes(range);
}

// ============================================================================
// Recent Pairs History
// ============================================================================

const RECENT_PAIRS_KEY = 'forexRadar_recentPairs';
const MAX_RECENT_PAIRS = 5;

/**
 * @typedef {Object} RecentPair
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 */

/**
 * Loads recent pairs from localStorage
 * @returns {RecentPair[]}
 */
function loadRecentPairs() {
  try {
    const stored = localStorage.getItem(RECENT_PAIRS_KEY);
    if (stored) {
      const pairs = JSON.parse(stored);
      // Validate and filter invalid entries
      return pairs.filter(p => p.from && p.to && isValidCurrency(p.from) && isValidCurrency(p.to));
    }
  } catch (error) {
    console.error('Error loading recent pairs:', error);
  }
  return [];
}

/**
 * Saves a pair to recent pairs history
 * Adds to front, deduplicates, and limits to MAX_RECENT_PAIRS
 * @param {string} from - Source currency code
 * @param {string} to - Target currency code
 */
function saveRecentPair(from, to) {
  if (!from || !to) return;
  
  const recentPairs = loadRecentPairs();
  
  // Remove existing duplicate (same pair in same direction)
  const filtered = recentPairs.filter(p => !(p.from === from && p.to === to));
  
  // Add new pair to front
  filtered.unshift({ from, to });
  
  // Limit to max pairs
  const limited = filtered.slice(0, MAX_RECENT_PAIRS);
  
  localStorage.setItem(RECENT_PAIRS_KEY, JSON.stringify(limited));
  
  // Render updated list
  renderRecentPairs(limited);
}

/**
 * Renders the recent pairs chips
 * @param {RecentPair[]} [pairs] - Pairs to render (loads from storage if not provided)
 */
function renderRecentPairs(pairs) {
  if (!recentPairsList || !recentPairsContainer) return;
  
  const recentPairs = pairs || loadRecentPairs();
  
  // Hide if no recent pairs
  if (recentPairs.length === 0) {
    recentPairsContainer.classList.add('hidden');
    return;
  }
  
  recentPairsContainer.classList.remove('hidden');
  
  // Get current selection to highlight active chip
  const currentFrom = fromSelect.value;
  const currentTo = toSelect.value;
  
  // Build chips HTML
  recentPairsList.innerHTML = recentPairs.map((pair, index) => {
    const isActive = pair.from === currentFrom && pair.to === currentTo;
    return `
      <button 
        class="recent-pair-chip ${isActive ? 'active' : ''}" 
        data-from="${pair.from}" 
        data-to="${pair.to}"
        type="button"
        aria-label="Load ${pair.from} to ${pair.to}"
      >
        ${pair.from} <span class="chip-arrow">→</span> ${pair.to}
      </button>
    `;
  }).join('');
  
  // Add click handlers
  recentPairsList.querySelectorAll('.recent-pair-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const from = chip.getAttribute('data-from');
      const to = chip.getAttribute('data-to');
      if (from && to) {
        fromSelect.value = from;
        toSelect.value = to;
        localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from, to }));
        updateURL();
        loadCurrencyPair();
        // Update active state immediately
        renderRecentPairs();
      }
    });
  });
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

// ============================================================================
// ANIMATED STAT TRANSITIONS
// ============================================================================

/** @type {Map<HTMLElement, number>} Track active animations by element */
const activeAnimations = new Map();

/** @type {Map<HTMLElement, number>} Track current displayed values */
const currentValues = new Map();

/**
 * Animates a numeric value from current to target with easing
 * @param {HTMLElement} element - The element to update
 * @param {number|null} targetValue - Target numeric value (null = show '-')
 * @param {number} decimals - Number of decimal places
 * @param {string} [suffix=''] - Optional suffix (e.g., '%')
 * @param {string} [prefix=''] - Optional prefix (e.g., '+' for positive spread)
 */
function animateValue(element, targetValue, decimals, suffix = '', prefix = '') {
  // Cancel any existing animation on this element
  const existingAnimation = activeAnimations.get(element);
  if (existingAnimation) {
    cancelAnimationFrame(existingAnimation);
    activeAnimations.delete(element);
  }
  
  // Handle null/undefined - just set to '-' immediately
  if (targetValue === null || targetValue === undefined) {
    element.textContent = '-';
    currentValues.delete(element);
    return;
  }
  
  // Get the current displayed value (or start from target if first load)
  const startValue = currentValues.get(element) ?? targetValue;
  
  // If values are the same, just ensure display is correct
  if (Math.abs(startValue - targetValue) < Math.pow(10, -(decimals + 1))) {
    const displayPrefix = prefix || (targetValue >= 0 && suffix === '' ? '' : '');
    element.textContent = `${displayPrefix}${targetValue.toFixed(decimals)}${suffix}`;
    currentValues.set(element, targetValue);
    return;
  }
  
  // Add the updating class for visual feedback
  element.classList.add('stat-updating');
  
  const duration = 400; // ms
  const startTime = performance.now();
  
  /**
   * Easing function (ease-out cubic)
   * @param {number} t - Progress 0-1
   * @returns {number} Eased progress
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  /**
   * Animation frame handler
   * @param {number} currentTime - Current timestamp
   */
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    
    const currentValue = startValue + (targetValue - startValue) * easedProgress;
    const displayPrefix = prefix || '';
    element.textContent = `${displayPrefix}${currentValue.toFixed(decimals)}${suffix}`;
    
    if (progress < 1) {
      const frameId = requestAnimationFrame(animate);
      activeAnimations.set(element, frameId);
    } else {
      // Animation complete
      activeAnimations.delete(element);
      currentValues.set(element, targetValue);
      
      // Remove the updating class after a short delay for the pulse effect
      setTimeout(() => {
        element.classList.remove('stat-updating');
      }, 150);
    }
  }
  
  const frameId = requestAnimationFrame(animate);
  activeAnimations.set(element, frameId);
}

/**
 * Updates the stats display for multi-provider data
 * @param {MultiProviderStats} stats - Multi-provider statistics object
 */
function updateStats(stats) {
  // Current rate - prefer Visa if available, else Mastercard
  const currentRate = stats.visa.current ?? stats.mastercard.current;
  animateValue(statCurrent, currentRate, 4);
  
  // High/Low across both providers
  const allHighs = [stats.visa.high, stats.mastercard.high].filter(v => v !== null);
  const allLows = [stats.visa.low, stats.mastercard.low].filter(v => v !== null);
  const high = allHighs.length > 0 ? Math.max(...allHighs) : null;
  const low = allLows.length > 0 ? Math.min(...allLows) : null;
  
  animateValue(statHigh, high, 4);
  animateValue(statLow, low, 4);
  
  // Visa markup (only Visa provides this)
  animateValue(statMarkup, stats.visa.avgMarkup, 3, '%');
  
  // Spread between MC and Visa
  if (statSpread) {
    if (stats.currentSpread !== null) {
      const spreadSign = stats.currentSpread >= 0 ? '+' : '';
      animateValue(statSpread, stats.currentSpread, 4, '', spreadSign);
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
 * @param {string} minDate - Minimum visible date (YYYY-MM-DD)
 * @param {string} maxDate - Maximum visible date (YYYY-MM-DD)
 */
function handleChartZoom(minDate, maxDate) {
  if (currentVisaRecords.length === 0 && currentMcRecords.length === 0 && currentEcbRecords.length === 0) return;
  
  // Deactivate time range buttons on manual zoom
  const timeRangeButtons = document.querySelectorAll('.time-range-btn');
  timeRangeButtons.forEach(btn => btn.classList.remove('active'));
  
  // Filter records to visible range for each provider
  const { visaRecords, mastercardRecords, ecbRecords } = ChartManager.getVisibleRecordsByProvider(
    currentVisaRecords, 
    currentMcRecords,
    currentEcbRecords,
    minDate, 
    maxDate
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
    const result = await DataManager.fetchRates(
      /** @type {CurrencyCode} */ (fromCurr),
      /** @type {CurrencyCode} */ (toCurr),
      range,
      {
        onProgress: (stage, message) => {
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
      saveRecentPair(fromCurr, toCurr);
      updateURL();
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
  // Initialize searchable dropdowns
  const fromDropdownContainer = document.getElementById('from-currency-dropdown');
  const toDropdownContainer = document.getElementById('to-currency-dropdown');
  
  if (fromDropdownContainer && toDropdownContainer) {
    fromSelect = new SearchableDropdown(fromDropdownContainer, currencies);
    toSelect = new SearchableDropdown(toDropdownContainer, currencies);
  }

  // Priority: URL params > localStorage > defaults
  const urlParams = parseURLParams();
  let selectedFrom = null;
  let selectedTo = null;
  let selectedRange = null;
  
  // 1. Check URL parameters first
  if (urlParams.from && urlParams.to && isValidCurrency(urlParams.from) && isValidCurrency(urlParams.to)) {
    selectedFrom = urlParams.from;
    selectedTo = urlParams.to;
  }
  if (urlParams.range && isValidTimeRange(urlParams.range)) {
    selectedRange = /** @type {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} */ (urlParams.range);
  }
  
  // 2. Fall back to localStorage if URL didn't provide values
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
        selectedRange = /** @type {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} */ (savedRange);
      }
    } catch (error) {
      console.error('Error restoring time range:', error);
    }
  }
  
  // 3. Apply defaults if still no values
  fromSelect.value = selectedFrom || 'USD';
  toSelect.value = selectedTo || 'INR';
  currentTimeRange = selectedRange || '1y';

  // Add event listeners with debouncing
  fromSelect.addEventListener('change', handleSelectionChange);
  toSelect.addEventListener('change', handleSelectionChange);
  
  // Handle browser back/forward navigation
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.from && event.state.to) {
      // Restore state from history
      if (isValidCurrency(event.state.from) && isValidCurrency(event.state.to)) {
        fromSelect.value = event.state.from;
        toSelect.value = event.state.to;
        if (event.state.range && isValidTimeRange(event.state.range)) {
          currentTimeRange = event.state.range;
          // Update time range button active state
          const timeRangeButtons = document.querySelectorAll('.time-range-btn');
          timeRangeButtons.forEach(btn => {
            if (btn.getAttribute('data-range') === event.state.range) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }
        loadCurrencyPair();
      }
    }
  });

  // Swap currencies button
  if (swapButton) {
    swapButton.addEventListener('click', () => {
      const fromCurr = fromSelect.value;
      const toCurr = toSelect.value;
      
      if (!fromCurr || !toCurr) return;
      
      // Trigger swap animation
      swapButton.classList.add('swapping');
      swapButton.addEventListener('animationend', () => {
        swapButton.classList.remove('swapping');
      }, { once: true });
      
      // Swap the values
      fromSelect.value = toCurr;
      toSelect.value = fromCurr;
      
      // Update localStorage, recent pairs, and URL, then reload
      localStorage.setItem('forexRadar_lastPair', JSON.stringify({ from: toCurr, to: fromCurr }));
      saveRecentPair(toCurr, fromCurr);
      updateURL();
      loadCurrencyPair();
    });
  }

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
        updateURL();
        loadCurrencyPair();
      }
    });
  });
  
  // Update time range button active state based on currentTimeRange (already set above)
  timeRangeButtons.forEach(btn => {
    if (btn.getAttribute('data-range') === currentTimeRange) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Listen for theme changes to update chart
  window.addEventListener('themechange', () => {
    const fromCurr = fromSelect.value;
    const toCurr = toSelect.value;
    if (fromCurr && toCurr && ChartManager.isChartInitialized()) {
      ChartManager.refreshChartTheme(fromCurr, toCurr);
    }
  });

  // Set initial URL state (only if we have valid currencies selected)
  if (fromSelect.value && toSelect.value) {
    // Use replaceState for initial load to set proper state without adding history entry
    const url = new URL(window.location.href);
    url.searchParams.set('from', fromSelect.value);
    url.searchParams.set('to', toSelect.value);
    url.searchParams.set('range', currentTimeRange);
    history.replaceState({ from: fromSelect.value, to: toSelect.value, range: currentTimeRange }, '', url);
  }
  
  // Mark initialization complete
  isInitializing = false;
  
  // Render recent pairs
  renderRecentPairs();
  
  // Initial load
  loadCurrencyPair();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
