/**
 * Theme Manager
 * 
 * Handles light/dark mode toggle with smooth transitions and persistence.
 * @module theme
 */

class ThemeManager {
  constructor() {
    this.toggle = document.getElementById('theme-toggle');
    this.html = document.documentElement;
    this.prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.init();
  }
  
  init() {
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || savedTheme === 'light') {
      this.setTheme(savedTheme);
    } else {
      // Default to dark mode if no saved preference
      this.setTheme('dark');
    }
    
    // Listen for toggle clicks
    if (this.toggle) {
      this.toggle.addEventListener('click', () => this.toggleTheme());
    }
    
    // Listen for system preference changes
    this.prefersDark.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  setTheme(/** @type {'dark' | 'light'} */ theme) {
    if (theme === 'dark') {
      this.html.classList.add('dark');
      this.html.classList.remove('light');
    } else {
      this.html.classList.add('light');
      this.html.classList.remove('dark');
    }
    
    // Dispatch event for chart updates
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }
  
  toggleTheme() {
    const isDark = this.html.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    
    // Temporarily enable transition for smooth theme switch
    const body = document.body;
    body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
    
    this.setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Animate the toggle
    if (this.toggle) {
      this.toggle.classList.add('transitioning');
      setTimeout(() => {
        this.toggle.classList.remove('transitioning');
      }, 500);
    }
    
    // Remove transition after it completes to avoid permanent main-thread cost
    setTimeout(() => { body.style.transition = ''; }, 550);
  }
  
  get currentTheme() {
    return this.html.classList.contains('dark') ? 'dark' : 'light';
  }
}

// Initialize immediately
const themeManager = new ThemeManager();

// Make available globally for debugging
/** @type {any} */ (window).themeManager = themeManager;

export { ThemeManager };
