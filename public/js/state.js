/**
 * Global State Store for SmartTime AI
 */

class StateStore {
  constructor() {
    this.user = JSON.parse(localStorage.getItem('smarttime_user') || 'null');
    this.token = localStorage.getItem('smarttime_token') || null;
    this.settings = null;
    this.activeTimetable = null;
    this.unreadCount = 0;
    this.currentView = this.user ? 'dashboard' : 'landing';
    this.theme = localStorage.getItem('smarttime_theme') || 'light';
    this.listeners = [];

    // Apply theme
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => listener(this));
  }

  setUser(user, token) {
    this.user = user;
    this.token = token || (user ? user.id : null);
    if (user) {
      localStorage.setItem('smarttime_user', JSON.stringify(user));
      if (this.token) localStorage.setItem('smarttime_token', this.token);
    } else {
      localStorage.removeItem('smarttime_user');
      localStorage.removeItem('smarttime_token');
    }
    this.notify();
  }

  setView(viewName) {
    this.currentView = viewName;
    if (window.location.hash !== `#${viewName}`) {
      window.location.hash = `#${viewName}`;
    }
    this.notify();
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('smarttime_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify();
  }

  setUnreadCount(count) {
    this.unreadCount = count;
    const badges = document.querySelectorAll('.nav-badge');
    badges.forEach((b) => {
      if (count > 0) {
        b.textContent = count;
        b.style.display = 'inline-block';
      } else {
        b.style.display = 'none';
      }
    });
  }
}

export const state = new StateStore();
