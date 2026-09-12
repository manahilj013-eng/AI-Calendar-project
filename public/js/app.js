/**
 * SmartTime AI — Main Application Orchestrator & Router
 */

import { state } from './state.js';
import { api } from './api.js';
import { renderNavigation } from './components/navbar.js';
import { renderAuthModals } from './components/authModals.js';
import { renderLandingPage } from './components/landingPage.js';
import { renderDashboard } from './components/dashboardView.js';
import { renderAddScheduleWizard } from './components/addScheduleWizard.js';
import { renderCalendar } from './components/calendarView.js';
import { renderTimetables } from './components/timetablesView.js';
import { renderNotifications } from './components/notificationsView.js';
import { renderSettings } from './components/settingsView.js';
import { showToast } from './components/toast.js';
import { playChimeSound, playAlarmTone } from './utils/audioUtils.js';
import { triggerLiveAlarm } from './components/alarmModal.js';

let lastSeenNotifCount = 0;
let isInitialNotifPoll = true;
const processedNotifIds = new Set();
const firedAlarmsToday = new Set();

function initApp() {
  const appContainer = document.querySelector('#app');
  const modalContainer = document.querySelector('#modal-root');

  // Render global auth modals
  renderAuthModals(modalContainer);

  // State subscriber for view re-rendering
  state.subscribe(() => {
    renderCurrentView(appContainer);
  });

  // Sync route on hash change
  window.addEventListener('hashchange', handleHashChange);

  // Initial Route & initial render
  handleHashChange();
  renderCurrentView(appContainer);

  // Background reminder notification poller (every 20s)
  setInterval(pollNotifications, 20000);

  // Mobile & PWA App Installation & Back-Button Handlers
  initMobileAppFeatures();
}

let deferredInstallPrompt = null;

function initMobileAppFeatures() {
  // Capture PWA native install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    state.deferredInstallPrompt = e;
    console.log('📱 PWA Install prompt captured and ready');
  });

  // Global helper to trigger install
  window.promptAppInstall = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showToast('App installed to your device! 🎉', 'success');
      }
      deferredInstallPrompt = null;
    } else {
      showToast('To install app: Tap browser menu (⋮) and choose "Install App" or "Add to Home Screen" 📲', 'info', 6000);
    }
  };

  // Hardware Back Button / History navigation safety for mobile apps
  window.addEventListener('popstate', () => {
    const openModal = document.querySelector('.modal-backdrop.open');
    if (openModal) {
      openModal.classList.remove('open');
      setTimeout(() => {
        if (openModal.parentNode) openModal.innerHTML = '';
      }, 200);
    }
  });
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';

  if (!state.user && hash !== 'landing') {
    state.currentView = 'landing';
    state.notify();
    return;
  }

  if (state.user && hash === 'landing') {
    state.currentView = 'dashboard';
    state.notify();
    return;
  }

  if (state.currentView !== hash) {
    state.currentView = hash;
    state.notify();
  }
}

function renderCurrentView(container) {
  const view = state.currentView;

  if (view === 'landing' || !state.user) {
    container.innerHTML = `<div id="landing-page-root"></div>`;
    renderLandingPage(container.querySelector('#landing-page-root'));
    return;
  }

  // Preserve app layout if already created
  let navRoot = container.querySelector('#nav-root');
  let viewRoot = container.querySelector('#view-content-root');

  if (!navRoot || !viewRoot) {
    container.innerHTML = `
      <div class="app-layout">
        <div id="nav-root"></div>
        <main class="main-content" id="view-content-root"></main>
      </div>
    `;
    navRoot = container.querySelector('#nav-root');
    viewRoot = container.querySelector('#view-content-root');
  }

  renderNavigation(navRoot);

  if (view === 'dashboard') {
    renderDashboard(viewRoot);
  } else if (view === 'calendar') {
    renderCalendar(viewRoot);
  } else if (view === 'add-schedule') {
    renderAddScheduleWizard(viewRoot);
  } else if (view === 'timetables') {
    renderTimetables(viewRoot);
  } else if (view === 'notifications') {
    renderNotifications(viewRoot);
  } else if (view === 'settings') {
    renderSettings(viewRoot);
  } else {
    renderDashboard(viewRoot);
  }
}

async function pollNotifications() {
  if (!state.user) return;
  try {
    const data = await api.getNotifications();
    const currentUnread = data.unread_count || 0;
    const notifs = data.notifications || [];

    // On initial poll (page load / login), initialize state quietly without firing false alarms!
    if (isInitialNotifPoll) {
      isInitialNotifPoll = false;
      lastSeenNotifCount = currentUnread;
      state.setUnreadCount(currentUnread);
      notifs.forEach((n) => processedNotifIds.add(n.id));
    } else if (currentUnread > lastSeenNotifCount) {
      // Find genuinely new unread notifications that haven't been processed
      const newNotifs = notifs.filter((n) => !n.read && !processedNotifIds.has(n.id));

      newNotifs.forEach((n) => {
        processedNotifIds.add(n.id);

        // ONLY trigger the ringing alarm modal if it is an actual scheduled class reminder or alarm!
        if (n.type === 'reminder' || n.type === 'alarm') {
          // Check freshness: only ring if the reminder was generated in the last 60 seconds
          const notifTime = new Date(n.created_at || 0).getTime();
          const ageMs = Date.now() - notifTime;
          if (ageMs <= 60000) {
            const savedTone = localStorage.getItem('smarttime_alarm_tone_1') || 'alarm';
            triggerLiveAlarm({
              title: n.title || 'Class Reminder 🔔',
              message: n.message || 'Your lecture is starting soon. Please get ready!',
              toneId: savedTone
            });
            showToast(`🔔 ${n.title}: ${n.message}`, 'warning', 8000);
          }
        } else {
          // System/info notifications (like "Timetable Activated! 🎉"): NEVER ring alarm, only show gentle toast
          showToast(`ℹ️ ${n.title}`, 'info', 4000);
        }
      });

      lastSeenNotifCount = currentUnread;
      state.setUnreadCount(currentUnread);
    }

    // Direct Active Timetable Schedule Monitor:
    // Check if the current time matches the scheduled alarm time for any class in today's active timetable
    if (Array.isArray(data.today_alarms) && data.today_alarms.length > 0) {
      const now = new Date();
      const currentH = String(now.getHours()).padStart(2, '0');
      const currentM = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentH}:${currentM}`;
      const todayDateStr = now.toISOString().split('T')[0];

      data.today_alarms.forEach((alarm) => {
        // Only ring if status is active and alert_time matches current minute
        if (alarm.status === 'active' && alarm.alert_time === currentTimeStr) {
          const alarmKey = `fired_${todayDateStr}_${alarm.id}_${alarm.alert_time}`;
          if (!firedAlarmsToday.has(alarmKey)) {
            firedAlarmsToday.add(alarmKey);
            const savedTone = localStorage.getItem('smarttime_alarm_tone_1') || 'alarm';
            triggerLiveAlarm({
              title: `Class Alarm: ${alarm.class_name} ⏰`,
              message: `Your class "${alarm.class_name}" starts in ${alarm.minutes_before} minutes (at ${alarm.start_time}) in ${alarm.room || 'Room TBA'}.`,
              toneId: savedTone,
              room: alarm.room,
              teacher: alarm.teacher,
              timeStr: `${alarm.start_time} – ${alarm.end_time || '10:00'}`
            });
            showToast(`⏰ Class Alarm: ${alarm.class_name} starts in ${alarm.minutes_before}m!`, 'warning', 8000);
          }
        }
      });
    }
  } catch (e) {
    // Silent background poll error
  }
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
