/**
 * UI Animations
 * 
 * Advanced animations and micro-interactions for a premium feel.
 * @module animations
 */

class AnimationsManager {
  constructor() {
    this.init();
  }
  
  init() {
    this.initScrollAnimations();
    this.initHeaderScroll();
    this.initHoverEffects();
    this.initParallax();
  }
  
  /**
   * Initialize scroll-triggered animations using Intersection Observer
   */
  initScrollAnimations() {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    // Observe elements with animation classes
    document.querySelectorAll('[data-animate]').forEach(el => {
      observer.observe(el);
    });
  }
  
  /**
   * Handle header transparency on scroll
   */
  initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    let lastScroll = 0;
    let ticking = false;
    
    const updateHeader = () => {
      const scrollY = window.scrollY;
      
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      // Hide on scroll down, show on scroll up
      if (scrollY > lastScroll && scrollY > 200) {
        header.style.transform = 'translateY(-100%)';
      } else {
        header.style.transform = 'translateY(0)';
      }
      
      lastScroll = scrollY;
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }
  
  /**
   * Add magnetic hover effects to interactive elements
   */
  initHoverEffects() {
    document.querySelectorAll('.magnetic').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        el.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'translate(0, 0)';
      });
    });
  }
  
  /**
   * Subtle parallax effect for background elements
   */
  initParallax() {
    const blobs = document.querySelectorAll('.bg-blob');
    if (!blobs.length) return;
    
    let ticking = false;
    
    const updateParallax = () => {
      const scrollY = window.scrollY;
      
      blobs.forEach((blob, index) => {
        const speed = 0.1 + (index * 0.05);
        blob.style.transform = `translateY(${scrollY * speed}px)`;
      });
      
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }
  
  /**
   * Animate a number counter
   * @param {HTMLElement} element - Element to animate
   * @param {number} target - Target number
   * @param {number} duration - Animation duration in ms
   */
  static animateNumber(element, target, duration = 1000) {
    const start = parseFloat(element.textContent) || 0;
    const startTime = performance.now();
    
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * easeOut;
      
      element.textContent = current.toFixed(4);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    
    requestAnimationFrame(update);
  }
  
  /**
   * Add ripple effect to an element
   * @param {MouseEvent} event - Click event
   * @param {HTMLElement} element - Target element
   */
  static createRipple(event, element) {
    const circle = document.createElement('span');
    const diameter = Math.max(element.clientWidth, element.clientHeight);
    const radius = diameter / 2;
    
    const rect = element.getBoundingClientRect();
    
    circle.style.cssText = `
      position: absolute;
      width: ${diameter}px;
      height: ${diameter}px;
      left: ${event.clientX - rect.left - radius}px;
      top: ${event.clientY - rect.top - radius}px;
      background: rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out forwards;
      pointer-events: none;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(circle);
    
    setTimeout(() => circle.remove(), 600);
  }
}

// Add ripple animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  [data-animate] {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  }
  
  [data-animate].animate-in {
    opacity: 1;
    transform: translateY(0);
  }
  
  [data-animate="fade"] {
    transform: none;
  }
  
  [data-animate="scale"] {
    transform: scale(0.9);
  }
  
  [data-animate="scale"].animate-in {
    transform: scale(1);
  }
`;
document.head.appendChild(style);

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AnimationsManager());
} else {
  new AnimationsManager();
}

export { AnimationsManager };
