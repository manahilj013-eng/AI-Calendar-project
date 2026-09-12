/**
 * Notification Utilities for SmartTime AI
 * Browser Web Notifications API helpers
 */

import { playChimeSound } from './audioUtils.js';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return 'denied';
  }
}

export function showBrowserNotification(title, body, options = {}) {
  // Play sound chime if sound enabled
  if (options.playSound !== false) {
    playChimeSound();
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/assets/icons/favicon.png',
      badge: '/assets/icons/favicon.png',
      silent: true, // We handle audio chime manually
      ...options
    });

    notif.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      notif.close();
    };

    return notif;
  } catch (err) {
    console.warn('Failed to display browser notification:', err);
    return null;
  }
}
