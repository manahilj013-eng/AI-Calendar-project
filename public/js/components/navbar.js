/**
 * Navigation Component (Desktop Sidebar + Mobile Bottom Navigation)
 */

import { state } from '../state.js';

export function renderNavigation(container) {
  const user = state.user;
  const currentView = state.currentView;
  const unreadCount = state.unreadCount;

  // Desktop Sidebar
  const sidebarHtml = `
    <aside class="sidebar">
      <a href="#dashboard" class="brand-logo" data-view="dashboard">
        <div class="brand-icon">⏰</div>
        <div>
          <span>SMARTTIME</span>
          <span style="color: var(--primary-purple); font-size: 0.8em; margin-left: 3px;">AI</span>
        </div>
      </a>

      <ul class="nav-list">
        <li class="nav-item ${currentView === 'dashboard' ? 'active' : ''}">
          <a href="#dashboard" data-view="dashboard">
            <span style="font-size: 1.2rem;">📊</span>
            <span>Dashboard</span>
          </a>
        </li>
        <li class="nav-item ${currentView === 'calendar' ? 'active' : ''}">
          <a href="#calendar" data-view="calendar">
            <span style="font-size: 1.2rem;">📅</span>
            <span>Calendar</span>
          </a>
        </li>
        <li class="nav-item ${currentView === 'timetables' ? 'active' : ''}">
          <a href="#timetables" data-view="timetables">
            <span style="font-size: 1.2rem;">📋</span>
            <span>My Timetables</span>
          </a>
        </li>
        <li class="nav-item ${currentView === 'notifications' ? 'active' : ''}">
          <a href="#notifications" data-view="notifications">
            <span style="font-size: 1.2rem;">🔔</span>
            <span>Notifications</span>
            ${unreadCount > 0 ? `<span class="nav-badge">${unreadCount}</span>` : ''}
          </a>
        </li>
        <li class="nav-item ${currentView === 'settings' ? 'active' : ''}">
          <a href="#settings" data-view="settings">
            <span style="font-size: 1.2rem;">⚙️</span>
            <span>Settings</span>
          </a>
        </li>
      </ul>

      <div style="padding: 0 0.5rem 1rem 0.5rem;">
        <button class="btn btn-primary btn-block" id="sidebar-add-btn" style="border-radius: var(--radius-lg);">
          <span>✨</span> Add Schedule
        </button>
      </div>

      <div class="sidebar-user">
        <div class="user-avatar">${(user?.name || 'U').charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${user?.name || 'User'}</div>
          <div class="user-role">${user?.role || 'Student'}</div>
        </div>
        <button id="nav-logout-btn" class="btn btn-ghost btn-icon" title="Logout" style="font-size: 1.1rem;">
          🚪
        </button>
      </div>
    </aside>
  `;

  // Mobile Bottom Bar
  const mobileHtml = `
    <nav class="mobile-bottom-nav">
      <a href="#dashboard" class="mobile-nav-item ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
        <span style="font-size: 1.3rem;">📊</span>
        <span>Home</span>
      </a>
      <a href="#calendar" class="mobile-nav-item ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
        <span style="font-size: 1.3rem;">📅</span>
        <span>Calendar</span>
      </a>
      <button class="mobile-nav-add-btn" id="mobile-add-btn" title="Add Schedule">
        +
      </button>
      <a href="#notifications" class="mobile-nav-item ${currentView === 'notifications' ? 'active' : ''}" data-view="notifications">
        <span style="font-size: 1.3rem; position: relative;">
          🔔
          ${unreadCount > 0 ? `<span style="position: absolute; top: -4px; right: -8px; background: var(--soft-pink); color: #881337; font-size: 0.65rem; border-radius: 999px; padding: 1px 4px; font-weight: bold;">${unreadCount}</span>` : ''}
        </span>
        <span>Alerts</span>
      </a>
      <a href="#settings" class="mobile-nav-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
        <span style="font-size: 1.3rem;">⚙️</span>
        <span>Settings</span>
      </a>
    </nav>
  `;

  container.innerHTML = sidebarHtml + mobileHtml;

  // Add click listeners
  container.querySelectorAll('[data-view]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-view');
      state.setView(target);
    });
  });

  const addBtn = container.querySelector('#sidebar-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => state.setView('add-schedule'));
  }

  const mobileAddBtn = container.querySelector('#mobile-add-btn');
  if (mobileAddBtn) {
    mobileAddBtn.addEventListener('click', () => state.setView('add-schedule'));
  }

  const logoutBtn = container.querySelector('#nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        state.setUser(null, null);
        window.location.hash = '#landing';
        state.setView('landing');
      }
    });
  }
}
