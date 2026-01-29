/**
 * Time Range Selector
 * 
 * Manages time range button interactions and state.
 * 
 * @module ui/time-range
 */

/** @typedef {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} TimeRangeKey */

/** @typedef {import('../../shared/types.js').DateRange} DateRange */

/**
 * @typedef {Object} TimeRangeCallbacks
 * @property {() => TimeRangeKey} getCurrentRange - Gets current time range
 * @property {(range: TimeRangeKey) => void} onRangeChange - Called when range changes
 */

/** @type {NodeListOf<Element>|null} */
let timeRangeButtons = null;

/** @type {TimeRangeCallbacks|null} */
let callbacks = null;

/**
 * Time range mapping for number keys
 */
export const TIME_RANGE_KEYS = {
  '1': /** @type {TimeRangeKey} */ ('1m'),
  '2': /** @type {TimeRangeKey} */ ('3m'),
  '3': /** @type {TimeRangeKey} */ ('6m'),
  '4': /** @type {TimeRangeKey} */ ('1y'),
  '5': /** @type {TimeRangeKey} */ ('5y'),
  '6': /** @type {TimeRangeKey} */ ('all')
};

/**
 * Converts time range key to DateRange object
 * @param {TimeRangeKey} rangeKey
 * @returns {DateRange}
 */
export function parseTimeRange(rangeKey) {
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

/**
 * Validates if a time range key is valid
 * @param {string} range
 * @returns {range is TimeRangeKey}
 */
export function isValidTimeRange(range) {
  return ['1m', '3m', '6m', '1y', '5y', 'all'].includes(range);
}

/**
 * Initialize time range buttons
 * @param {TimeRangeCallbacks} cbs - Callback functions
 */
export function initTimeRange(cbs) {
  callbacks = cbs;
  timeRangeButtons = document.querySelectorAll('.time-range-btn');
  
  timeRangeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rangeKey = /** @type {TimeRangeKey} */ (button.getAttribute('data-range'));
      if (rangeKey && callbacks && rangeKey !== callbacks.getCurrentRange()) {
        callbacks.onRangeChange(rangeKey);
        updateActiveButton(rangeKey);
      }
    });
  });
  
  updateActiveButton(cbs.getCurrentRange());
}

/**
 * Updates the active state of time range buttons
 * @param {TimeRangeKey} activeRange
 */
export function updateActiveButton(activeRange) {
  if (!timeRangeButtons) return;
  
  timeRangeButtons.forEach(btn => {
    if (btn.getAttribute('data-range') === activeRange) {
      btn.classList.add('btn--active');
    } else {
      btn.classList.remove('btn--active');
    }
  });
}

/**
 * Deactivates all time range buttons (used on manual chart zoom)
 */
export function deactivateAllButtons() {
  if (!timeRangeButtons) return;
  timeRangeButtons.forEach(btn => btn.classList.remove('btn--active'));
}

/**
 * Triggers a range change via keyboard shortcut key
 * @param {string} key - The pressed key ('1'-'6')
 */
export function triggerRangeByKey(key) {
  const range = TIME_RANGE_KEYS[/** @type {'1'|'2'|'3'|'4'|'5'|'6'} */ (key)];
  if (range) {
    const btn = document.querySelector(`.time-range-btn[data-range="${range}"]`);
    if (btn instanceof HTMLElement) {
      btn.click();
    }
  }
}
