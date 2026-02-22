/**
 * Series Toggle Controls
 * 
 * Manages chart series visibility toggles.
 * 
 * @module ui/series-toggles
 */

/**
 * @typedef {Object} SeriesVisibility
 * @property {boolean} [visaRate]
 * @property {boolean} [mastercardRate]
 * @property {boolean} [ecbRate]
 * @property {boolean} [visaMarkup]
 */

/**
 * @typedef {Object} ToggleElements
 * @property {HTMLInputElement|null} visaRate
 * @property {HTMLInputElement|null} mcRate
 * @property {HTMLInputElement|null} ecbRate
 * @property {HTMLInputElement|null} visaMarkup
 */

/**
 * @typedef {Object} ToggleContainers
 * @property {Element|null} visaRate
 * @property {Element|null} mcRate
 * @property {Element|null} ecbRate
 * @property {Element|null} visaMarkup
 */

/** @type {ToggleElements} */
const toggles = {
  visaRate: null,
  mcRate: null,
  ecbRate: null,
  visaMarkup: null
};

/** @type {ToggleContainers} */
const containers = {
  visaRate: null,
  mcRate: null,
  ecbRate: null,
  visaMarkup: null
};

/** @type {((visibility: SeriesVisibility) => void)|null} */
let onVisibilityChange = null;

/**
 * Initialize series toggles
 * @param {(visibility: SeriesVisibility) => void} callback - Called when visibility changes
 */
export function initSeriestoggles(callback) {
  onVisibilityChange = callback;
  
  toggles.visaRate = /** @type {HTMLInputElement|null} */ (document.getElementById('toggle-visa-rate'));
  toggles.mcRate = /** @type {HTMLInputElement|null} */ (document.getElementById('toggle-mc-rate'));
  toggles.ecbRate = /** @type {HTMLInputElement|null} */ (document.getElementById('toggle-ecb-rate'));
  toggles.visaMarkup = /** @type {HTMLInputElement|null} */ (document.getElementById('toggle-visa-markup'));
  
  containers.visaRate = toggles.visaRate?.closest('.series-toggle') ?? null;
  containers.mcRate = toggles.mcRate?.closest('.series-toggle') ?? null;
  containers.ecbRate = toggles.ecbRate?.closest('.series-toggle') ?? null;
  containers.visaMarkup = toggles.visaMarkup?.closest('.series-toggle') ?? null;
  
  if (toggles.visaRate) {
    toggles.visaRate.addEventListener('change', () => {
      onVisibilityChange?.({ visaRate: toggles.visaRate?.checked });
    });
  }
  if (toggles.mcRate) {
    toggles.mcRate.addEventListener('change', () => {
      onVisibilityChange?.({ mastercardRate: toggles.mcRate?.checked });
    });
  }
  if (toggles.ecbRate) {
    toggles.ecbRate.addEventListener('change', () => {
      onVisibilityChange?.({ ecbRate: toggles.ecbRate?.checked });
    });
  }
  if (toggles.visaMarkup) {
    toggles.visaMarkup.addEventListener('change', () => {
      onVisibilityChange?.({ visaMarkup: toggles.visaMarkup?.checked });
    });
  }
}

/** @typedef {import('../../../shared/types.js').RateRecord} RateRecord */

/**
 * Updates toggle visibility based on available data
 * @param {RateRecord[]} visaRecords
 * @param {RateRecord[]} mastercardRecords
 * @param {RateRecord[]} ecbRecords
 */
export function updateToggleVisibility(visaRecords, mastercardRecords, ecbRecords) {
  const hasVisa = visaRecords.length > 0;
  const hasMc = mastercardRecords.length > 0;
  const hasEcb = ecbRecords.length > 0;
  const hasVisaMarkup = visaRecords.some(r => r.markup !== null && r.markup !== undefined);
  
  if (containers.visaRate) {
    /** @type {HTMLElement} */ (containers.visaRate).style.display = hasVisa ? '' : 'none';
  }
  if (containers.mcRate) {
    /** @type {HTMLElement} */ (containers.mcRate).style.display = hasMc ? '' : 'none';
  }
  if (containers.ecbRate) {
    /** @type {HTMLElement} */ (containers.ecbRate).style.display = hasEcb ? '' : 'none';
  }
  if (containers.visaMarkup) {
    /** @type {HTMLElement} */ (containers.visaMarkup).style.display = hasVisaMarkup ? '' : 'none';
  }
}

/**
 * Gets current toggle states for data availability check
 * @param {RateRecord[]} visaRecords
 * @param {RateRecord[]} mastercardRecords
 * @param {RateRecord[]} ecbRecords
 * @returns {SeriesVisibility}
 */
export function getVisibilityFromData(visaRecords, mastercardRecords, ecbRecords) {
  return {
    visaRate: visaRecords.length > 0,
    mastercardRate: mastercardRecords.length > 0,
    ecbRate: ecbRecords.length > 0,
    visaMarkup: visaRecords.some(r => r.markup !== null && r.markup !== undefined)
  };
}
