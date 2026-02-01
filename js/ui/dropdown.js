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
    
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('blur', (e) => this.handleBlur(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    clearBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.clear();
    });
    
    this.list.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    
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
        if (index >= 0) this.highlight(index);
      }
    });
  }
  
  get value() {
    return this.hiddenInput.value;
  }
  
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
    const query = this.input.value;
    this.renderList(query);
    this.highlightedIndex = -1;
    if (!this.isOpen) this.open();
  }
  
  /**
   * @param {FocusEvent} _e 
   */
  handleBlur(_e) {
    setTimeout(() => {
      this.close();
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
   * @param {number} index 
   */
  highlight(index) {
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
    
    const highlighted = items[index];
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
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
      this.dispatchChange();
    }
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
    this.list.classList.add('open');
    this.input.setAttribute('aria-expanded', 'true');
    const query = this.value ? '' : this.input.value;
    this.renderList(query);
    
    if (this.value) {
      setTimeout(() => {
        const selected = this.list.querySelector('.selected');
        if (selected) {
          selected.scrollIntoView({ block: 'center' });
        }
      }, 50);
    }
  }
  
  close() {
    this.isOpen = false;
    this.list.classList.remove('open');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.highlightedIndex = -1;
  }
}
