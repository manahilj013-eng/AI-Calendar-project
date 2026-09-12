/**
 * Global State Store for SmartTime AI
 */

class StateStore {
  constructor() {
    let storedUser = null;
    try {
      storedUser = JSON.parse(localStorage.getItem('smarttime_user') || 'null');
    } catch (e) {}

    // Auto-initialize user as manahil (Student) so live site directly opens the full application
    if (!storedUser) {
      storedUser = {
        id: 'usr_24441706-b699-459e-9280-bd16f04f0efa',
        name: 'manahil',
        email: 'manahilj013@gmail.com',
        role: 'Student',
        timezone: 'pakistan',
        avatar: 'M',
        onboarding_completed: true,
        created_at: '2026-08-30T16:23:24.689+00:00'
      };
      localStorage.setItem('smarttime_user', JSON.stringify(storedUser));
      localStorage.setItem('smarttime_token', storedUser.id);
    }

    this.user = storedUser;
    this.token = localStorage.getItem('smarttime_token') || (storedUser ? storedUser.id : null);
    this.settings = null;
    this.activeTimetable = null;
    this.unreadCount = 0;
    const initialHash = window.location.hash.replace('#', '');
    this.currentView = initialHash && initialHash !== 'landing' ? initialHash : 'dashboard';
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
