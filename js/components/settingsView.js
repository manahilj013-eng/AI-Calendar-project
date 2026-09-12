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

        <!-- 4. Mobile App Installation & APK -->
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

        <!-- 5. Danger Zone -->
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
