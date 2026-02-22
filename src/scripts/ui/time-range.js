/**
 * Time Range Selector
 * 
 * Manages time range button interactions and state.
 * 
 * @module ui/time-range
 */

/** @typedef {'1m'|'3m'|'6m'|'1y'|'5y'|'all'} TimeRangeKey */

/** @typedef {import('../../../shared/types.js').DateRange} DateRange */

/**
 * @typedef {Object} TimeRangeCallbacks
 * @property {() => TimeRangeKey} getCurrentRange - Gets current time range
 * @property {(range: TimeRangeKey) => void} onRangeChange - Called when range changes
 */

/** @type {NodeListOf<Element>|null} */
let timeRangeButtons = null;

/** @type {TimeRangeCallbacks|null} */
let callbacks = null;

/** @type {HTMLElement|null} */
let slidingIndicator = null;

/** @type {HTMLElement|null} */
let buttonsContainer = null;

/** @type {ReturnType<typeof setTimeout>|null} */
let rangeChangeTimeout = null;

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
  buttonsContainer = document.querySelector('.time-range-buttons');
  timeRangeButtons = document.querySelectorAll('.time-range-btn');
  
  // Create sliding indicator element
  if (buttonsContainer && !slidingIndicator) {
    slidingIndicator = document.createElement('div');
    slidingIndicator.className = 'time-range-indicator';
    buttonsContainer.style.position = 'relative';
    buttonsContainer.appendChild(slidingIndicator);
  }
  
  timeRangeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rangeKey = /** @type {TimeRangeKey} */ (button.getAttribute('data-range'));
      if (rangeKey && callbacks && rangeKey !== callbacks.getCurrentRange()) {
        // Animate first, then trigger data load after delay
        updateActiveButton(rangeKey);
        if (rangeChangeTimeout) {
          clearTimeout(rangeChangeTimeout);
        }
        rangeChangeTimeout = setTimeout(() => {
          callbacks?.onRangeChange(rangeKey);
        }, 250);
      }
    });
  });
  
  updateActiveButton(cbs.getCurrentRange());
}

/**
 * Animates the sliding indicator to a target button using Web Animations API
 * @param {HTMLElement} targetButton - The button to slide to
 * @param {boolean} [instant=false] - Skip animation (for initial positioning)
 */
function animateIndicatorTo(targetButton, instant = false) {
  if (!slidingIndicator || !buttonsContainer) return;
  
  const containerRect = buttonsContainer.getBoundingClientRect();
  const buttonRect = targetButton.getBoundingClientRect();
  
  // Calculate position relative to container
  const left = buttonRect.left - containerRect.left;
  const width = buttonRect.width;
  const height = buttonRect.height;
  
  // Get current indicator position for animation start
  const currentLeft = parseFloat(slidingIndicator.style.left) || left;
  const currentWidth = parseFloat(slidingIndicator.style.width) || width;
  
  if (instant) {
    // Instant positioning (initial load)
    slidingIndicator.style.left = `${left}px`;
    slidingIndicator.style.width = `${width}px`;
    slidingIndicator.style.height = `${height}px`;
    slidingIndicator.style.opacity = '1';
    return;
  }
  
  // Animate with Web Animations API for smooth sliding
  const keyframes = [
    { 
      left: `${currentLeft}px`, 
      width: `${currentWidth}px`,
      transform: 'scaleY(1)'
    },
    { 
      left: `${(currentLeft + left) / 2}px`, 
      width: `${Math.max(currentWidth, width) * 1.1}px`,
      transform: 'scaleY(0.95)',
      offset: 0.4
    },
    { 
      left: `${left}px`, 
      width: `${width}px`,
      transform: 'scaleY(1)'
    }
  ];
  
  const anim = slidingIndicator.animate(keyframes, {
    duration: 750,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)', // Smooth ease-out
    fill: 'forwards'
  });
  anim.onfinish = () => {
    slidingIndicator.style.left = `${left}px`;
    slidingIndicator.style.width = `${width}px`;
    anim.cancel();
  };
}

/**
 * Updates the active state of time range buttons
 * @param {TimeRangeKey} activeRange
 */
export function updateActiveButton(activeRange) {
  if (!timeRangeButtons) return;
  
  /** @type {HTMLElement|null} */
  let activeButton = null;
  
  timeRangeButtons.forEach(btn => {
    if (btn.getAttribute('data-range') === activeRange) {
      btn.classList.add('btn--active');
      activeButton = /** @type {HTMLElement} */ (btn);
    } else {
      btn.classList.remove('btn--active');
    }
  });
  
  // Animate indicator to active button
  if (activeButton && slidingIndicator) {
    const isFirstRender = slidingIndicator.style.opacity !== '1';
    animateIndicatorTo(activeButton, isFirstRender);
  }
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

/**
 * Refreshes the indicator position (call after section becomes visible)
 */
export function refreshIndicatorPosition() {
  if (!callbacks) return;
  const activeRange = callbacks.getCurrentRange();
  const activeButton = document.querySelector(`.time-range-btn[data-range="${activeRange}"]`);
  if (activeButton instanceof HTMLElement && slidingIndicator) {
    animateIndicatorTo(activeButton, true);
  }
}
