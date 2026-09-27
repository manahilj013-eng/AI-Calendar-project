/**
 * Settings View Component for SmartTime AI
 * Profile, Timezone, Default Reminders, Sound & Notification preferences, and Themes.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { requestNotificationPermission } from '../utils/notificationUtils.js';
import { ALARM_TONES, playAlarmTone } from '../utils/audioUtils.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem 0;">
      <div class="check-item loading" style="font-size: 1.1rem;">
        <div class="check-item-icon">⏳</div> Loading preferences...
      </div>
    </div>
  `;

  try {
    const user = state.user;
    const settingsData = await api.getSettings();
    const settings = settingsData.settings || {};

    const reminderOffsets = [5, 10, 15, 20, 30, 45, 60, 120];
    const expiryDaysOptions = [1, 3, 7, 14, 30];

    container.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h1 style="font-size: 2rem; margin-bottom: 0.25rem;">Settings & Preferences ⚙️</h1>
          <p style="color: var(--text-secondary);">Customize your profile, notification timing, sound chimes, and theme.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 2rem; max-width: 720px;">
        <!-- 1. Profile Card -->
        <div class="card">
          <h3 style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>👤</span> Profile Information
          </h3>

          <form id="form-profile-settings">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="set-name" class="form-control" value="${user?.name || ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="set-email" class="form-control" value="${user?.email || ''}" disabled style="background: var(--bg-main); opacity: 0.7;">
            </div>

            <div class="form-group">
              <label class="form-label">Primary Role</label>
              <select id="set-role" class="form-control">
                ${['Student', 'Teacher', 'Personal', 'Work', 'Other']
                  .map((r) => `<option value="${r}" ${r === user?.role ? 'selected' : ''}>${r}</option>`)
                  .join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Timezone</label>
              <input type="text" id="set-timezone" class="form-control" value="${user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}">
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
              Save Profile Changes
            </button>
          </form>
        </div>

        <!-- 2. Notification & Reminder Preferences -->
        <div class="card card-purple-tint">
          <h3 style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🔔</span> Default Reminder & Alert Settings
          </h3>

          <form id="form-notification-settings">
            <div class="switch-group">
              <div>
                <strong>Sound Chimes & Synthesizer</strong>
                <div style="font-size: 0.82rem; color: var(--text-secondary);">Plays a gentle audio chime when class reminders trigger.</div>
              </div>
              <label class="switch">
                <input type="checkbox" id="set-sound" ${settings.sound_enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="switch-group">
              <div>
                <strong>Browser Web Notifications</strong>
                <div style="font-size: 0.82rem; color: var(--text-secondary);">Displays system popup alerts on desktop and mobile.</div>
              </div>
              <label class="switch">
                <input type="checkbox" id="set-browser" ${settings.browser_enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="form-row-2" style="margin-top: 1.5rem;">
              <div class="form-group">
                <label class="form-label">Default Reminder 1</label>
                <select id="set-rem-1-mins" class="form-control">
                  ${reminderOffsets
                    .map((m) => `<option value="${m}" ${m === settings.reminder_1_minutes ? 'selected' : ''}>${m >= 60 ? `${m / 60} hour before` : `${m} minutes before`}</option>`)
                    .join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Default Reminder 2</label>
                <select id="set-rem-2-mins" class="form-control">
                  ${reminderOffsets
                    .map((m) => `<option value="${m}" ${m === settings.reminder_2_minutes ? 'selected' : ''}>${m >= 60 ? `${m / 60} hour before` : `${m} minutes before`}</option>`)
                    .join('')}
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-top: 1.25rem;">
              <label class="form-label">🎵 Default Alarm Ringtone / Voice:</label>
              <div style="display: flex; gap: 0.5rem;">
                <select id="set-default-tone" class="form-control" style="flex: 1;">
                  ${ALARM_TONES.map((t) => `<option value="${t.id}" ${t.id === (localStorage.getItem('smarttime_alarm_tone_1') || 'alarm') ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
                <button type="button" id="btn-test-setting-tone" class="btn btn-outline btn-sm" style="white-space: nowrap; font-weight: 600; padding: 0 1rem;">
                  ▶️ Test Sound
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Timetable Expiry Warning</label>
              <select id="set-expiry-warning" class="form-control">
                ${expiryDaysOptions
                  .map((d) => `<option value="${d}" ${d === settings.expiry_warning_days ? 'selected' : ''}>${d} day${d === 1 ? '' : 's'} before semester ends</option>`)
                  .join('')}
              </select>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
              Save Reminder Defaults
            </button>
          </form>
        </div>

        <!-- 3. Appearance & Theme -->
        <div class="card">
          <h3 style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎨</span> Appearance & Theme
          </h3>

          <div style="display: flex; gap: 1rem;">
            <button id="theme-light-btn" class="btn ${state.theme === 'light' ? 'btn-primary' : 'btn-outline'} btn-block" style="padding: 1.2rem;">
              ☀️ Light Theme
            </button>
            <button id="theme-dark-btn" class="btn ${state.theme === 'dark' ? 'btn-primary' : 'btn-outline'} btn-block" style="padding: 1.2rem;">
              🌙 Dark Theme
            </button>
          </div>
        </div>

        <!-- 4. Third-Party Integrations: Google Calendar & iCal Sync -->
        <div class="card card-purple-tint" id="section-google-integrations">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M19.5 3h-3V1.5H15V3H9V1.5H7.5V3h-3C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zm0 16.5h-15V8.5h15v11z"/><circle cx="8" cy="12" r="1.2" fill="#EA4335"/><circle cx="12" cy="12" r="1.2" fill="#FBBC05"/><circle cx="16" cy="12" r="1.2" fill="#34A853"/></svg>
                Google Calendar & 3rd-Party Sync
              </h3>
              <p style="font-size: 0.88rem; color: var(--text-secondary); margin: 0;">
                Live sync your classes with Google Calendar, Apple Calendar (iPhone/Mac), and Outlook.
              </p>
            </div>
            <div id="google-status-badge" class="badge" style="background: rgba(108, 99, 255, 0.12); color: var(--primary-purple); font-weight: 700;">
              Checking status...
            </div>
          </div>

          <!-- A. Direct 1-Click iCal Export & Webcal Feed -->
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>📡</span> Live Calendar Subscription URL (Google / Apple / Outlook)
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              Paste this URL into Google Calendar (<em>"Other calendars" &rarr; "From URL"</em>) or iPhone Calendar (<em>"Add Calendar Subscription"</em>) to keep all your classes auto-updated.
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <input type="text" id="gcal-feed-url-input" class="form-control" readonly style="flex: 1; min-width: 240px; font-size: 0.82rem; background: var(--bg-card); cursor: pointer;" title="Click to copy">
              <button type="button" id="btn-copy-feed-url" class="btn btn-outline btn-sm" style="white-space: nowrap; font-weight: 600;">
                📋 Copy Link
              </button>
              <a id="btn-download-ics" href="/api/calendar/export/ics" download="smarttime_schedule.ics" class="btn btn-secondary btn-sm" style="white-space: nowrap; font-weight: 600;">
                📥 Download .ics File
              </a>
            </div>
          </div>

          <!-- B. Google Calendar API Direct Sync -->
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.1rem;">
            <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🔄</span> Google Calendar Direct Cloud Sync
            </div>
            <div id="google-account-info" style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.85rem;">
              Connect your Google account to automatically push classes directly into your Google Calendar app.
            </div>

            <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
              <button type="button" id="btn-connect-google" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M19.5 3h-3V1.5H15V3H9V1.5H7.5V3h-3C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zm0 16.5h-15V8.5h15v11z"/></svg>
                Connect Google Calendar
              </button>
              <button type="button" id="btn-sync-google-now" class="btn btn-outline btn-sm" style="display: none;">
                ⚡ Sync All Classes Now
              </button>
              <button type="button" id="btn-disconnect-google" class="btn btn-ghost btn-sm" style="color: var(--status-error); display: none;">
                Disconnect
              </button>
            </div>
          </div>
        </div>

        <!-- 5. Mobile App Installation & APK -->
        <div class="card card-blue-tint">
          <h3 style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>📲</span> Mobile App & Offline Installation
          </h3>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            Install SmartTime AI directly on your phone or laptop. Works full-screen without browser address bars, with offline caching and instant alerts.
          </p>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            <button id="btn-install-pwa" class="btn btn-primary">
              📲 Install App on This Device
            </button>
            <span style="font-size: 0.82rem; color: var(--text-muted);">
              🤖 Android APK: <code>npm run cap:android</code>
            </span>
          </div>
        </div>

        <!-- 6. Danger Zone -->
        <div class="card" style="border-color: rgba(239, 68, 68, 0.3); background: var(--bg-soft-pink);">
          <h3 style="color: var(--status-error); margin-bottom: 0.5rem;">Account Actions</h3>
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Logout of your active session or reset demo data.</p>
          <div style="display: flex; gap: 1rem;">
            <button id="btn-logout-settings" class="btn btn-outline">
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    `;

    // Install PWA Button Listener
    container.querySelector('#btn-install-pwa')?.addEventListener('click', () => {
      if (typeof window.promptAppInstall === 'function') {
        window.promptAppInstall();
      }
    });

    // Profile Submit
    container.querySelector('#form-profile-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#set-name')?.value.trim();
      const role = container.querySelector('#set-role')?.value;
      const timezone = container.querySelector('#set-timezone')?.value.trim();

      try {
        const res = await api.updateProfile({ name, role, timezone });
        state.setUser(res.user, state.token);
        showToast('Profile settings updated!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Notification Submit
    container.querySelector('#form-notification-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sound_enabled = container.querySelector('#set-sound')?.checked;
      const browser_enabled = container.querySelector('#set-browser')?.checked;
      const reminder_1_minutes = parseInt(container.querySelector('#set-rem-1-mins')?.value, 10);
      const reminder_2_minutes = parseInt(container.querySelector('#set-rem-2-mins')?.value, 10);
      const expiry_warning_days = parseInt(container.querySelector('#set-expiry-warning')?.value, 10);

      const chosenTone = container.querySelector('#set-default-tone')?.value || 'alarm';
      localStorage.setItem('smarttime_alarm_tone_1', chosenTone);

      if (browser_enabled) {
        await requestNotificationPermission();
      }

      try {
        await api.updateSettings({
          sound_enabled,
          browser_enabled,
          reminder_1_minutes,
          reminder_2_minutes,
          expiry_warning_days
        });
        showToast('Reminder & notification preferences saved!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Test Sound Button in Settings
    container.querySelector('#btn-test-setting-tone')?.addEventListener('click', () => {
      const tone = container.querySelector('#set-default-tone')?.value || 'alarm';
      playAlarmTone(tone, 'Testing your class reminder alarm sound!');
    });

    container.querySelector('#set-default-tone')?.addEventListener('change', (e) => {
      localStorage.setItem('smarttime_alarm_tone_1', e.target.value);
    });

    // Google Calendar & 3rd-Party Sync Setup
    const feedInput = container.querySelector('#gcal-feed-url-input');
    const feedUrl = api.getCalendarFeedUrl(user?.id);
    if (feedInput) {
      feedInput.value = feedUrl;
      feedInput.addEventListener('click', () => {
        navigator.clipboard?.writeText(feedUrl);
        showToast('Calendar subscription link copied! 📋', 'success');
      });
    }

    container.querySelector('#btn-copy-feed-url')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(feedUrl);
      showToast('Calendar subscription link copied! 📋', 'success');
    });

    // Check Google Sync Status
    const statusBadge = container.querySelector('#google-status-badge');
    const btnConnectGoogle = container.querySelector('#btn-connect-google');
    const btnSyncGoogle = container.querySelector('#btn-sync-google-now');
    const btnDisconnectGoogle = container.querySelector('#btn-disconnect-google');
    const accountInfo = container.querySelector('#google-account-info');

    // Check query params for Google OAuth callback result
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_status') === 'connected') {
      showToast('Google Calendar connected successfully! 📅', 'success');
      window.history.replaceState({}, document.title, window.location.pathname + '#settings');
    } else if (urlParams.get('google_status') === 'error') {
      showToast('Google connection failed: ' + (urlParams.get('msg') || 'Unknown error'), 'error');
      window.history.replaceState({}, document.title, window.location.pathname + '#settings');
    }

    api.getGoogleSyncStatus()
      .then((status) => {
        if (status.connected) {
          if (statusBadge) {
            statusBadge.textContent = '🟢 Google Synced';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#059669';
          }
          if (accountInfo) {
            accountInfo.innerHTML = `Connected as <strong>${status.email || 'Google User'}</strong>. Your classes can be pushed directly to your Google Calendar.`;
          }
          if (btnConnectGoogle) btnConnectGoogle.style.display = 'none';
          if (btnSyncGoogle) btnSyncGoogle.style.display = 'inline-flex';
          if (btnDisconnectGoogle) btnDisconnectGoogle.style.display = 'inline-flex';
        } else if (status.configured) {
          if (statusBadge) {
            statusBadge.textContent = 'Ready to Connect';
          }
        } else {
          if (statusBadge) {
            statusBadge.textContent = 'iCal & Webcal Active';
          }
        }
      })
      .catch(() => {});

    // Connect Google Button
    btnConnectGoogle?.addEventListener('click', async () => {
      try {
        const res = await api.getGoogleAuthUrl();
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        showToast(err.message || 'Google OAuth credentials not configured in .env. You can use the Live Subscription link above anytime!', 'info');
      }
    });

    // Sync Now Button
    btnSyncGoogle?.addEventListener('click', async () => {
      btnSyncGoogle.disabled = true;
      btnSyncGoogle.textContent = '⏳ Syncing...';
      try {
        const res = await api.syncGoogleCalendar();
        showToast(res.message || `Synced ${res.synced || 0} classes to Google Calendar!`, 'success');
      } catch (err) {
        showToast('Sync error: ' + err.message, 'error');
      } finally {
        btnSyncGoogle.disabled = false;
        btnSyncGoogle.textContent = '⚡ Sync All Classes Now';
      }
    });

    // Disconnect Button
    btnDisconnectGoogle?.addEventListener('click', async () => {
      if (confirm('Disconnect Google Calendar synchronization?')) {
        try {
          await api.disconnectGoogleCalendar();
          showToast('Google Calendar disconnected', 'info');
          renderSettings(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Theme Switchers
    container.querySelector('#theme-light-btn')?.addEventListener('click', () => {
      state.setTheme('light');
      renderSettings(container);
    });

    container.querySelector('#theme-dark-btn')?.addEventListener('click', () => {
      state.setTheme('dark');
      renderSettings(container);
    });

    // Logout
    container.querySelector('#btn-logout-settings')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        state.setUser(null, null);
        window.location.hash = '#landing';
        state.setView('landing');
      }
    });
  } catch (err) {
    console.error('Settings render error:', err);
    container.innerHTML = `<div class="empty-state">Failed to load settings: ${err.message}</div>`;
  }
}
