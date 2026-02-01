/**
 * Recent Currency Pairs History
 * 
 * Manages localStorage-based recent pairs and renders clickable chips.
 * 
 * @module ui/recent-pairs
 */

const RECENT_PAIRS_KEY = 'forexRadar_recentPairs';
const MAX_RECENT_PAIRS = 5;

/**
 * @typedef {Object} RecentPair
 * @property {string} from - Source currency code
 * @property {string} to - Target currency code
 */

/**
 * @typedef {Object} RecentPairsElements
 * @property {HTMLElement} container - The recent-pairs container
 * @property {HTMLElement} list - The recent-pairs-list element
 */

/**
 * @typedef {Object} RecentPairsCallbacks
 * @property {(code: string) => boolean} isValidCurrency - Validates currency code
 * @property {() => string} getFromValue - Gets current from currency value
 * @property {() => string} getToValue - Gets current to currency value
 * @property {(from: string, to: string) => void} onPairSelect - Called when a pair chip is clicked
 */

/** @type {RecentPairsElements|null} */
let elements = null;

/** @type {RecentPairsCallbacks|null} */
let callbacks = null;

/**
 * Initialize the recent pairs module
 * @param {RecentPairsElements} els - DOM elements
 * @param {RecentPairsCallbacks} cbs - Callback functions
 * @returns {void}
 */
export function initRecentPairs(els, cbs) {
  elements = els;
  callbacks = cbs;
}

/**
 * Loads recent pairs from localStorage
 * @returns {RecentPair[]}
 */
export function loadRecentPairs() {
  if (!callbacks) return [];
  
  try {
    const stored = localStorage.getItem(RECENT_PAIRS_KEY);
    if (stored) {
      const pairs = JSON.parse(stored);
      return pairs.filter(/** @param {RecentPair} p */ (p) => 
        p.from && p.to && p.from !== p.to && 
        callbacks.isValidCurrency(p.from) && callbacks.isValidCurrency(p.to)
      );
    }
  } catch (error) {
    console.error('Error loading recent pairs:', error);
  }
  return [];
}

/**
 * Saves a pair to recent pairs history
 * @param {string} from - Source currency code
 * @param {string} to - Target currency code
 * @returns {void}
 */
export function saveRecentPair(from, to) {
  if (!from || !to || from === to) return;
  if (callbacks && (!callbacks.isValidCurrency(from) || !callbacks.isValidCurrency(to))) return;
  
  const recentPairs = loadRecentPairs();
  const filtered = recentPairs.filter(p => !(p.from === from && p.to === to));
  filtered.unshift({ from, to });
  const limited = filtered.slice(0, MAX_RECENT_PAIRS);
  
  localStorage.setItem(RECENT_PAIRS_KEY, JSON.stringify(limited));
  renderRecentPairs(limited);
}

/**
 * Renders the recent pairs chips
 * @param {RecentPair[]} [pairs] - Pairs to render (loads from storage if not provided)
 * @returns {void}
 */
export function renderRecentPairs(pairs) {
  if (!elements || !callbacks) return;
  
  const recentPairs = pairs === undefined ? loadRecentPairs() : pairs;
  
  if (recentPairs.length === 0) {
    elements.container.classList.add('hidden');
    return;
  }
  
  elements.container.classList.remove('hidden');
  
  const currentFrom = callbacks.getFromValue();
  const currentTo = callbacks.getToValue();
  
  elements.list.innerHTML = recentPairs.map((pair) => {
    const isActive = pair.from === currentFrom && pair.to === currentTo;
    return `
      <button 
        class="btn btn--pill ${isActive ? 'btn--active' : ''} recent-pair-chip" 
        data-from="${pair.from}" 
        data-to="${pair.to}"
        type="button"
        aria-label="Load ${pair.from} to ${pair.to}"
      >
        ${pair.from} <span class="chip-arrow">→</span> ${pair.to}
      </button>
    `;
  }).join('');
  
  elements.list.querySelectorAll('.recent-pair-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const from = chip.getAttribute('data-from');
      const to = chip.getAttribute('data-to');
      if (from && to && callbacks) {
        callbacks.onPairSelect(from, to);
        renderRecentPairs();
      }
    });
  });
}
