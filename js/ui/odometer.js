/**
 * Odometer - Digit-by-digit animated counter
 * 
 * Creates a slot-machine/departure-board style animation where each digit
 * rolls independently to its target value.
 * 
 * @module ui/odometer
 */

/** @typedef {{ element: HTMLElement, currentDigit: string, targetDigit: string }} DigitSlot */

/**
 * Manages odometer instances for stat elements
 * @type {WeakMap<HTMLElement, OdometerInstance>}
 */
const instances = new WeakMap();

/**
 * Characters that can appear in the odometer (for wheel generation)
 */
const DIGIT_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Animation configuration
 */
const CONFIG = {
  baseDuration: 2000,       // Base animation duration in ms
  staggerDelay: 500,        // Delay between each digit starting (right to left)
  digitHeight: 1.2,         // Height of each digit in em units
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)'  // Smooth exponential deceleration
};

/**
 * @typedef {Object} OdometerInstance
 * @property {HTMLElement} container
 * @property {string} currentValue
 * @property {DigitSlot[]} slots
 * @property {string} prefix
 * @property {string} suffix
 */

/**
 * Initialize or get an odometer instance for an element
 * @param {HTMLElement} element
 * @returns {OdometerInstance}
 */
function getOrCreateInstance(element) {
  let instance = instances.get(element);
  if (!instance) {
    element.classList.add('odometer');
    element.innerHTML = '';
    instance = {
      container: element,
      currentValue: '',
      slots: [],
      prefix: '',
      suffix: ''
    };
    instances.set(element, instance);
  }
  return instance;
}

/**
 * Creates a digit slot element with a wheel of digits
 * @param {string} initialDigit
 * @returns {HTMLElement}
 */
function createDigitSlot(initialDigit) {
  const slot = document.createElement('span');
  slot.className = 'odometer-slot';
  
  const wheel = document.createElement('span');
  wheel.className = 'odometer-wheel';
  
  // Create digit elements for 0-9
  for (const digit of DIGIT_CHARS) {
    const digitEl = document.createElement('span');
    digitEl.className = 'odometer-digit';
    digitEl.textContent = digit;
    wheel.appendChild(digitEl);
  }
  
  slot.appendChild(wheel);
  
  // Set initial position
  if (DIGIT_CHARS.includes(initialDigit)) {
    const index = DIGIT_CHARS.indexOf(initialDigit);
    wheel.style.transform = `translateY(-${index * CONFIG.digitHeight}em)`;
  }
  
  return slot;
}

/**
 * Creates a static character element (for decimal points, signs, etc.)
 * @param {string} char
 * @returns {HTMLElement}
 */
function createStaticChar(char) {
  const span = document.createElement('span');
  span.className = 'odometer-static';
  span.textContent = char;
  return span;
}

/**
 * Animates a single digit wheel to a target digit
 * @param {HTMLElement} wheel
 * @param {string} fromDigit
 * @param {string} toDigit
 * @param {number} delay
 */
function animateWheel(wheel, fromDigit, toDigit, delay) {
  const fromIndex = DIGIT_CHARS.indexOf(fromDigit);
  const toIndex = DIGIT_CHARS.indexOf(toDigit);
  
  // Return early without modifying wheel.style if either digit is invalid
  if (fromIndex === -1 || toIndex === -1) {
    return;
  }
  
  // Snap to position if digits are identical (no animation needed)
  if (fromIndex === toIndex) {
    wheel.style.transform = `translateY(-${toIndex * CONFIG.digitHeight}em)`;
    return;
  }
  
  // Calculate the animation
  const targetY = -toIndex * CONFIG.digitHeight;
  
  wheel.style.transition = 'none';
  wheel.style.transform = `translateY(-${fromIndex * CONFIG.digitHeight}em)`;
  
  // Force reflow
  wheel.offsetHeight;
  
  // Apply animation with delay
  setTimeout(() => {
    wheel.style.transition = `transform ${CONFIG.baseDuration}ms ${CONFIG.easing}`;
    wheel.style.transform = `translateY(${targetY}em)`;
  }, delay);
}

/**
 * Updates the odometer to display a new value
 * @param {HTMLElement} element - The container element
 * @param {number|null} value - The numeric value to display
 * @param {number} decimals - Number of decimal places
 * @param {string} [suffix=''] - Suffix to append (e.g., '%')
 * @param {string} [prefix=''] - Prefix to prepend (e.g., '+')
 */
export function setOdometerValue(element, value, decimals, suffix = '', prefix = '') {
  if (!element) return;
  
  const instance = getOrCreateInstance(element);
  
  // Handle null/undefined values
  if (value === null || value === undefined) {
    element.innerHTML = '<span class="odometer-static">-</span>';
    instance.currentValue = '-';
    instance.slots = [];
    return;
  }
  
  // Format the new value
  const formattedValue = value.toFixed(decimals);
  const displayChars = (prefix + formattedValue + suffix).split('');
  const previousChars = instance.currentValue.split('');
  
  // Check if we need to rebuild the DOM structure
  const needsRebuild = displayChars.length !== previousChars.length ||
    displayChars.some((char, i) => {
      const prev = previousChars[i] || '';
      const isDigit = DIGIT_CHARS.includes(char);
      const wasDigit = DIGIT_CHARS.includes(prev);
      // Rebuild if digit/non-digit status changed
      return isDigit !== wasDigit;
    });
  
  if (needsRebuild) {
    // Full rebuild
    element.innerHTML = '';
    instance.slots = [];
    
    displayChars.forEach((char) => {
      if (DIGIT_CHARS.includes(char)) {
        const slot = createDigitSlot(char);
        element.appendChild(slot);
        instance.slots.push({
          element: slot,
          currentDigit: char,
          targetDigit: char
        });
      } else {
        const staticEl = createStaticChar(char);
        element.appendChild(staticEl);
      }
    });
    
    instance.currentValue = displayChars.join('');
    instance.prefix = prefix;
    instance.suffix = suffix;
    return;
  }
  
  // Animate existing digits
  let slotIndex = 0;
  
  // Count digits that need animation (for stagger calculation)
  /** @type {{ charIndex: number, char: string, prevChar: string }[]} */
  const digitPositions = [];
  displayChars.forEach((char, i) => {
    if (DIGIT_CHARS.includes(char)) {
      const prevChar = previousChars[i] || '0';
      if (char !== prevChar) {
        digitPositions.push({ charIndex: i, char, prevChar });
      }
    }
  });
  
  // Animate from right to left (least significant digit first)
  digitPositions.reverse();
  
  displayChars.forEach((char, charIndex) => {
    if (DIGIT_CHARS.includes(char)) {
      const slot = instance.slots[slotIndex];
      if (slot) {
        const wheel = slot.element.querySelector('.odometer-wheel');
        const prevChar = previousChars[charIndex] || '0';
        
        if (char !== prevChar && wheel) {
          // Find this digit's position in the animation order
          const animOrder = digitPositions.findIndex(d => d.charIndex === charIndex);
          const delay = animOrder >= 0 ? animOrder * CONFIG.staggerDelay : 0;
          
          animateWheel(/** @type {HTMLElement} */ (wheel), prevChar, char, delay);
          slot.currentDigit = char;
        }
      }
      slotIndex++;
    }
  });
  
  instance.currentValue = displayChars.join('');
  instance.prefix = prefix;
  instance.suffix = suffix;
}

/**
 * Clears an odometer instance
 * @param {HTMLElement} element
 */
export function clearOdometer(element) {
  if (!element) return;
  instances.delete(element);
  element.innerHTML = '-';
  element.classList.remove('odometer');
}
