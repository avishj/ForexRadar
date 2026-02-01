/**
 * Notification Toast System
 * 
 * Displays toast notifications with icons and auto-dismiss.
 * 
 * @module ui/notifications
 */

/** @type {HTMLElement|null} */
let notificationContainer = null;

/**
 * Initialize the notification system
 * @param {HTMLElement} container - The container element for notifications
 */
export function initNotifications(container) {
  notificationContainer = container;
}

/**
 * Shows a notification toast
 * @param {string} message - Message to display
 * @param {'info'|'success'|'error'|'warning'} type - Notification type
 * @param {number} duration - Duration in ms (0 = persistent)
 * @returns {HTMLElement|null} The notification element
 */
export function showNotification(message, type = 'info', duration = 4000) {
  if (!notificationContainer) {
    console.warn('Notification container not initialized');
    return null;
  }

  const finalMessage = message.endsWith('.') || message.endsWith('!') || message.endsWith('?') 
    ? message 
    : message + '.';

  const icons = {
    info: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    success: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="notif-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
  };

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    ${icons[type]}
    <span class="notif-message">${finalMessage}</span>
    <button class="notif-close" aria-label="Dismiss">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  const closeBtn = notification.querySelector('.notif-close');
  closeBtn?.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });

  notificationContainer.appendChild(notification);

  const existingNotifs = notificationContainer.querySelectorAll('.notification');
  const staggerDelay = (existingNotifs.length - 1) * 100;
  
  setTimeout(() => {
    notification.classList.add('show');
  }, staggerDelay);

  if (duration > 0) {
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration + staggerDelay);
  }

  return notification;
}
