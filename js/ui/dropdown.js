/**
 * Searchable Dropdown Component
 * 
 * A dropdown with type-ahead filtering for currency selection.
 * 
 * @module ui/dropdown
 */

/** Top currencies to show first */
const TOP_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'CNY', 'MXN'];

/**
 * Searchable dropdown component with type-ahead filtering
 */
export class SearchableDropdown {
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
    /** @type {Array<{code: string, name: string}>} */
    this.filteredItems = [];
    /** @type {HTMLButtonElement|null} */
    this.clearBtn = null;
    
    /** @type {(e: PointerEvent) => void} */
    this._boundDocPointerDown = (e) => this.handleDocumentPointerDown(e);
    /** @type {(e: FocusEvent) => void} */
    this._boundFocusOut = (e) => this.handleFocusOut(e);
    /** @type {number} */
    this._rafFilter = 0;
    /** @type {string|null} */
    this._lastQuery = null;
    /** @type {HTMLElement|null} */
    this._stackParent = null;
    
    this.init();
  }
  
  init() {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '×';
    clearBtn.setAttribute('aria-label', 'Clear selection');
    clearBtn.tabIndex = -1;
    this.container.appendChild(clearBtn);
    this.clearBtn = clearBtn;
    
    this.renderList('');
    
    this.input.addEventListener('pointerdown', () => this.open());
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    clearBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.clear();
    });
    
    this.list.addEventListener('mousedown', (e) => e.preventDefault());
    this.list.addEventListener('click', (e) => {
      const item = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.dropdown-item'));
      if (item) {
        const code = item.dataset.code;
        if (code) this.select(code);
      }
    });
    
    this.list.addEventListener('mouseover', (e) => {
      const item = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.dropdown-item'));
      if (item) {
        const index = parseInt(item.dataset.index || '-1', 10);
        if (index >= 0) this.highlight(index, { scroll: false });
      }
    });
  }
  
  /**
   * Handle clicks outside the dropdown to close it
   * @param {PointerEvent} e
   */
  handleDocumentPointerDown(e) {
    if (!this.isOpen) return;
    const target = e.target;
    if (target instanceof Node && !this.container.contains(target)) {
      this.close({ restoreInput: true });
    }
  }
  
  /**
   * Handle focus leaving the dropdown container (e.g., programmatic focus() elsewhere)
   * @param {FocusEvent} e
   */
  handleFocusOut(e) {
    if (!this.isOpen) return;
    const related = /** @type {Node|null} */ (e.relatedTarget);
    if (!related || !this.container.contains(related)) {
      this.close({ restoreInput: true });
    }
  }
  
  get value() {
    return this.hiddenInput.value;
  }
  
  set value(code) {
    this.hiddenInput.value = code;
    this._lastQuery = null;
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
   * @param {string} event 
   * @param {EventListener} handler 
   */
  addEventListener(event, handler) {
    this.hiddenInput.addEventListener(event, handler);
  }
  
  dispatchChange() {
    const event = new Event('change', { bubbles: true });
    this.hiddenInput.dispatchEvent(event);
  }
  
  /**
   * @param {string} query
   */
  renderList(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    if (lowerQuery) {
      this.filteredItems = this.items.filter(item => 
        item.code.toLowerCase().includes(lowerQuery) ||
        item.name.toLowerCase().includes(lowerQuery)
      );
    } else {
      this.filteredItems = [...this.items];
    }
    
    let html = '';
    
    if (this.filteredItems.length === 0) {
      html = '<div class="dropdown-no-results">No currencies found</div>';
    } else {
      const popular = this.filteredItems.filter(c => TOP_CURRENCIES.includes(c.code));
      const other = this.filteredItems.filter(c => !TOP_CURRENCIES.includes(c.code));
      
      popular.sort((a, b) => TOP_CURRENCIES.indexOf(a.code) - TOP_CURRENCIES.indexOf(b.code));
      
      let globalIndex = 0;
      
      if (popular.length > 0 && !lowerQuery) {
        html += '<div class="dropdown-group-header">★ Popular</div>';
        popular.forEach(item => {
          html += this.renderItem(item, globalIndex++, lowerQuery);
        });
      } else if (popular.length > 0 && lowerQuery) {
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
      
      this.filteredItems = [...popular, ...other];
    }
    
    this.list.innerHTML = html;
  }
  
  /**
   * @param {{code: string, name: string}} item 
   * @param {number} index 
   * @param {string} query 
   * @returns {string}
   */
  renderItem(item, index, query) {
    const isSelected = item.code === this.value;
    const code = query ? this.highlightMatch(item.code, query) : item.code;
    const name = query ? this.highlightMatch(item.name, query) : item.name;
    const optionId = `${this.container.id}-option-${item.code}`;
    
    return `
      <div class="dropdown-item${isSelected ? ' selected' : ''}" 
           id="${optionId}"
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
    cancelAnimationFrame(this._rafFilter);
    this._rafFilter = requestAnimationFrame(() => {
      this._rafFilter = 0;
      const query = this.input.value;
      if (query === this._lastQuery) return;
      this._lastQuery = query;
      
      this.renderList(query);
      this.highlightedIndex = -1;
      if (!this.isOpen) this.open();
    });
  }
  
  /**
   * Flush any pending RAF filter so DOM and filteredItems are current
   */
  flushPendingFilter() {
    if (!this._rafFilter) return;
    cancelAnimationFrame(this._rafFilter);
    this._rafFilter = 0;
    const query = this.input.value;
    if (query === this._lastQuery) return;
    this._lastQuery = query;
    this.renderList(query);
    this.highlightedIndex = -1;
  }
  
  /**
   * Restore input display to match the current value
   */
  restoreInputToValue() {
    if (this.value) {
      const currency = this.items.find(c => c.code === this.value);
      if (currency) {
        this.input.value = `${currency.code} – ${currency.name}`;
      }
    } else {
      this.input.value = '';
    }
  }
  
  /**
   * @param {KeyboardEvent} e 
   */
  handleKeydown(e) {
    this.flushPendingFilter();
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
          this.select(this.filteredItems[0].code);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.close({ restoreInput: true });
        this.input.blur();
        break;
        
      case 'Tab':
        this.close({ restoreInput: true });
        break;
    }
  }
  
  /**
   * @param {number} index 
   * @param {{ scroll?: boolean }} [options]
   */
  highlight(index, { scroll = true } = {}) {
    const items = this.list.querySelectorAll('.dropdown-item');
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });
    this.highlightedIndex = index;
    
    const highlightedItem = this.filteredItems[index];
    if (highlightedItem) {
      const optionId = `${this.container.id}-option-${highlightedItem.code}`;
      this.input.setAttribute('aria-activedescendant', optionId);
    }
    
    const el = /** @type {HTMLElement|undefined} */ (items[index]);
    if (el && scroll) {
      this.scrollItemIntoView(el);
    }
  }
  
  /**
   * Scroll an item into view within the dropdown list
   * @param {HTMLElement} el 
   * @param {{ center?: boolean }} [options]
   */
  scrollItemIntoView(el, { center = false } = {}) {
    const list = this.list;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    
    if (elRect.top >= listRect.top && elRect.bottom <= listRect.bottom) return;
    
    const offsetTop = el.offsetTop;
    const target = center
      ? offsetTop - (list.clientHeight / 2) + (el.clientHeight / 2)
      : offsetTop;
    
    list.scrollTop = Math.max(0, target);
  }
  
  /**
   * @param {string} code 
   */
  select(code) {
    const prevValue = this.value;
    this.value = code;
    this.close();
    this.input.blur();
    
    if (prevValue !== code) {
      // Animate the input with a success pulse using Web Animations API
      this.animateSelectionPulse();
      this.dispatchChange();
    }
  }
  
  /**
   * Animates a wild ripple burst effect on selection
   */
  animateSelectionPulse() {
    // Get computed accent color (CSS vars don't work in Web Animations API)
    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#10b981';
    
    // Create multiple expanding ripple rings
    const createRipple = (/** @type {number} */ delay, /** @type {number} */ scale) => {
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: 20px;
        pointer-events: none;
        z-index: -1;
        border: 3px solid ${accentColor};
        box-shadow: 0 0 20px ${accentColor}, inset 0 0 20px ${accentColor}40;
      `;
      
      this.container.appendChild(ripple);
      
      const anim = ripple.animate([
        { 
          opacity: 0.9,
          transform: 'scale(1)',
          filter: 'blur(0px)'
        },
        { 
          opacity: 0.5,
          transform: `scale(${scale * 0.5})`,
          filter: 'blur(2px)',
          offset: 0.4
        },
        { 
          opacity: 0,
          transform: `scale(${scale})`,
          filter: 'blur(4px)'
        }
      ], {
        duration: 800,
        delay: delay,
        easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
        fill: 'forwards'
      });
      
      anim.onfinish = () => ripple.remove();
    };
    
    // Fire off 3 staggered ripples
    createRipple(0, 1.3);
    createRipple(100, 1.5);
    createRipple(200, 1.7);
    
    // Also create a center flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: absolute;
      inset: -8px;
      border-radius: 24px;
      pointer-events: none;
      z-index: -1;
      background: radial-gradient(circle at center, ${accentColor} 0%, transparent 70%);
    `;
    
    this.container.appendChild(flash);
    
    const flashAnim = flash.animate([
      { 
        opacity: 0,
        transform: 'scale(0.8)'
      },
      { 
        opacity: 0.7,
        transform: 'scale(1.1)',
        offset: 0.2
      },
      { 
        opacity: 0,
        transform: 'scale(1.3)'
      }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });
    
    flashAnim.onfinish = () => flash.remove();
  }
  
  clear() {
    this.hiddenInput.value = '';
    this.input.value = '';
    this.container.classList.remove('has-value');
    this.renderList('');
    this.dispatchChange();
    this.input.focus();
  }
  
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    
    this.container.classList.add('is-active');
    
    this._stackParent = this.container.closest('.selector-group');
    if (this._stackParent) {
      this._stackParent.classList.add('dropdown-active');
    }
    
    this.list.classList.add('open');
    this.input.setAttribute('aria-expanded', 'true');
    
    document.addEventListener('pointerdown', this._boundDocPointerDown, true);
    this.container.addEventListener('focusout', this._boundFocusOut);
    
    const query = this.value ? '' : this.input.value;
    if (query !== this._lastQuery) {
      this._lastQuery = query;
      this.renderList(query);
    }
    
    if (this.value) {
      requestAnimationFrame(() => {
        const selected = /** @type {HTMLElement|null} */ (this.list.querySelector('.selected'));
        if (selected) {
          this.scrollItemIntoView(selected, { center: true });
        }
      });
    }
  }
  
  /**
   * @param {{ restoreInput?: boolean }} [options]
   */
  close({ restoreInput = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    
    cancelAnimationFrame(this._rafFilter);
    this._rafFilter = 0;
    this.list.classList.remove('open');
    this.container.classList.remove('is-active');
    
    if (this._stackParent) {
      this._stackParent.classList.remove('dropdown-active');
    }
    
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.highlightedIndex = -1;
    
    document.removeEventListener('pointerdown', this._boundDocPointerDown, true);
    this.container.removeEventListener('focusout', this._boundFocusOut);
    
    if (restoreInput) {
      this.restoreInputToValue();
    }
  }
}
