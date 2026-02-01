/**
 * Keyboard Shortcuts Modal
 * 
 * Creates and manages the keyboard shortcuts help modal.
 * 
 * @module ui/shortcuts-modal
 */

/** @type {HTMLElement|null} */
let shortcutsModal = null;

/**
 * Creates the keyboard shortcuts help modal
 * @returns {HTMLElement}
 */
function createShortcutsModal() {
  const modal = document.createElement('div');
  modal.className = 'shortcuts-modal';
  modal.innerHTML = `
    <div class="shortcuts-backdrop"></div>
    <div class="shortcuts-content" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
      <div class="shortcuts-header">
        <h3 id="shortcuts-modal-title">Keyboard Shortcuts</h3>
        <button class="shortcuts-close" aria-label="Close">&times;</button>
      </div>
      <div class="shortcuts-body">
        <div class="shortcut-group">
          <div class="shortcut-row">
            <kbd>S</kbd>
            <span>Swap currencies</span>
          </div>
          <div class="shortcut-row">
            <kbd>/</kbd>
            <span>Focus currency search</span>
          </div>
          <div class="shortcut-row">
            <kbd>C</kbd>
            <span>Copy current rate</span>
          </div>
          <div class="shortcut-row">
            <kbd>L</kbd>
            <span>Copy shareable link</span>
          </div>
          <div class="shortcut-row">
            <kbd>D</kbd>
            <span>Download chart as PNG</span>
          </div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-row">
            <kbd>1</kbd>
            <span>1 Month view</span>
          </div>
          <div class="shortcut-row">
            <kbd>2</kbd>
            <span>3 Months view</span>
          </div>
          <div class="shortcut-row">
            <kbd>3</kbd>
            <span>6 Months view</span>
          </div>
          <div class="shortcut-row">
            <kbd>4</kbd>
            <span>1 Year view</span>
          </div>
          <div class="shortcut-row">
            <kbd>5</kbd>
            <span>5 Years view</span>
          </div>
          <div class="shortcut-row">
            <kbd>6</kbd>
            <span>All time view</span>
          </div>
        </div>
        <div class="shortcut-group">
          <div class="shortcut-row">
            <kbd>?</kbd>
            <span>Show this help</span>
          </div>
          <div class="shortcut-row">
            <kbd>Esc</kbd>
            <span>Close modal / blur input</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('.shortcuts-close');
  const backdrop = modal.querySelector('.shortcuts-backdrop');
  
  closeBtn?.addEventListener('click', () => hideShortcutsModal());
  backdrop?.addEventListener('click', () => hideShortcutsModal());
  
  return modal;
}

/**
 * Shows the keyboard shortcuts modal
 */
export function showShortcutsModal() {
  if (!shortcutsModal) {
    shortcutsModal = createShortcutsModal();
  }
  shortcutsModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Hides the keyboard shortcuts modal
 */
export function hideShortcutsModal() {
  if (shortcutsModal) {
    shortcutsModal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Checks if the shortcuts modal is currently open
 * @returns {boolean}
 */
export function isShortcutsModalOpen() {
  return shortcutsModal?.classList.contains('open') ?? false;
}
