/**
 * Notification & Alarm Center View Component for SmartTime AI
 * Displays: Real-time Class Alarms, Scheduled Queue, Delivered Alerts, and Sound Chime Triggers.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { formatDatePretty, formatTime12h } from '../utils/dateUtils.js';
import { playChimeSound, playAlarmTone, ALARM_TONES, getSavedAlarmTone } from '../utils/audioUtils.js';
import { triggerLiveAlarm } from './alarmModal.js';

let activeAlarmTab = 'today'; // 'today' | 'weekly' | 'history'
let activeHistorySubTab = 'daily'; // 'daily' | 'weekly' | 'monthly'

export async function renderNotifications(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem 0;">
      <div class="check-item loading" style="font-size: 1.1rem;">
        <div class="check-item-icon">⏳</div> Loading alarms and notifications...
      </div>
    </div>
  `;

  try {
    const data = await api.getNotifications();
    const todayAlarms = data.today_alarms || [];
    const weeklyAlarms = data.weekly_alarms || [];
    const isAlarmItem = (n) => n.type === 'reminder' || (n.title && (n.title.includes('Alarm') || n.title.includes('⏰')));
    const dailyHistory = (data.daily_history || []).filter(isAlarmItem);
    const weeklyHistory = (data.weekly_history || []).filter(isAlarmItem);
    const monthlyHistory = (data.monthly_history || []).filter(isAlarmItem);
    const historyAlarms = activeHistorySubTab === 'daily'
      ? dailyHistory
      : activeHistorySubTab === 'weekly'
        ? weeklyHistory
        : monthlyHistory;
    state.setUnreadCount(data.unread_count || 0);

    container.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h1 style="font-size: 2rem; margin-bottom: 0.25rem;">Notification & Alarm Center 🔔</h1>
          <p style="color: var(--text-secondary);">Manage today's class alarms, weekly schedule alerts, and alarm history.</p>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.4rem; background: var(--bg-card); padding: 0.25rem 0.6rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <span style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap;">🎵 Ringtone:</span>
            <select id="quick-alarm-tone-select" class="form-control" style="width: auto; max-width: 210px; font-size: 0.85rem; padding: 0.35rem 0.5rem; border: none; background: transparent;">
              ${ALARM_TONES.map((t) => `<option value="${t.id}" ${t.id === (getSavedAlarmTone()) ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>
          </div>
          <button id="btn-trigger-alarm-now" class="btn btn-primary">
            🔔 Trigger Alarm Now
          </button>
          <button id="btn-test-chime" class="btn btn-secondary">
            ▶️ Test Sound
          </button>
          ${
            activeAlarmTab === 'history'
              ? `<button id="btn-mark-all-read" class="btn btn-outline">✓ Mark All Read</button>`
              : ''
          }
        </div>
      </div>

      <!-- 3 Master Tabs: Today Alarms | Weekly Alarms | History -->
      <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex-wrap: wrap;">
        <button class="btn btn-sm ${activeAlarmTab === 'today' ? 'btn-primary' : 'btn-ghost'} alarm-tab-btn" data-tab="today" style="font-size: 0.92rem; padding: 0.5rem 1.1rem;">
          📅 Today's Alarms (${todayAlarms.length})
        </button>
        <button class="btn btn-sm ${activeAlarmTab === 'weekly' ? 'btn-primary' : 'btn-ghost'} alarm-tab-btn" data-tab="weekly" style="font-size: 0.92rem; padding: 0.5rem 1.1rem;">
          🗓️ Weekly Alarms (${weeklyAlarms.length})
        </button>
        <button class="btn btn-sm ${activeAlarmTab === 'history' ? 'btn-primary' : 'btn-ghost'} alarm-tab-btn" data-tab="history" style="font-size: 0.92rem; padding: 0.5rem 1.1rem;">
          🔔 Alarm History (${weeklyHistory.length})
        </button>
      </div>

      <!-- Tab 1: TODAY'S ALARMS (Filtered by Current Time) -->
      ${
        activeAlarmTab === 'today'
          ? `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h3 style="font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span>📅</span> Alarms for Today
              </h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">Showing real-time upcoming lectures for today based on current time.</p>
            </div>
            <span class="badge ${todayAlarms.length > 0 ? 'badge-active' : 'badge-purple'}" style="font-size: 0.75rem;">LIVE STATUS</span>
          </div>

          ${
            todayAlarms.length === 0
              ? `
            <div class="card empty-state" style="padding: 3rem 1.5rem; text-align: center;">
              <div class="empty-state-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
              <h3 style="margin-bottom: 0.35rem;">No More Alarms For Today</h3>
              <p style="color: var(--text-secondary); max-width: 460px; margin: 0 auto 1.25rem;">All scheduled lectures for today have finished, or no alarms remain. Check your weekly alarms schedule below!</p>
              <button class="btn btn-primary" id="btn-switch-weekly-tab">View Weekly Alarms ➔</button>
            </div>
          `
              : `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${todayAlarms
                .map((alarm) => {
                  const alertTimeStr = alarm.alert_time ? formatTime12h(alarm.alert_time) : (alarm.scheduled_time ? new Date(alarm.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00 AM');
                  const roomStr = alarm.room ? (alarm.room.startsWith('Room') || alarm.room.startsWith('Lab') || alarm.room.startsWith('Hall') ? alarm.room : `Room ${alarm.room}`) : 'Room 1100';

                  return `
                  <div class="card card-hover" style="border-left: 5px solid var(--primary-purple); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                        <strong style="font-size: 1.15rem; color: var(--text-primary);">${alarm.class_name}</strong>
                        <span class="badge badge-active" style="font-size: 0.72rem;">⏰ Active (Ready to Alert)</span>
                      </div>
                      <div style="font-size: 0.92rem; color: var(--text-secondary); margin-top: 0.35rem;">
                        🔔 <strong>Alarm Set For:</strong> <span style="color: var(--primary-purple); font-weight: 700;">${alertTimeStr}</span> (${alarm.minutes_before}m before class)
                        ${alarm.start_time ? ` • ⏰ Class Time: <strong>${formatTime12h(alarm.start_time)} – ${formatTime12h(alarm.end_time || '10:00')}</strong>` : ''}
                      </div>
                      <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">
                        📍 <strong>${roomStr}</strong> ${alarm.teacher ? ` • 👨‍🏫 <strong>${alarm.teacher}</strong>` : ''}
                      </div>
                    </div>

                    <div>
                      <button class="btn btn-secondary btn-sm btn-ring-single-alarm" data-name="${alarm.class_name}">
                        🔔 Test Alert
                      </button>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      `
          : ''
      }

      <!-- Tab 2: WEEKLY ALARMS (Grouped Weekday by Weekday) -->
      ${
        activeAlarmTab === 'weekly'
          ? (() => {
              const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              const groupedByDay = {};
              WEEKDAYS.forEach((d) => {
                groupedByDay[d] = [];
              });

              weeklyAlarms.forEach((alarm) => {
                let dayName = alarm.day;
                if (!dayName && alarm.occurrence_date) {
                  const dObj = new Date(alarm.occurrence_date + 'T00:00:00');
                  dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dObj.getDay()];
                }
                const matchDay = WEEKDAYS.find((w) => w.toLowerCase() === (dayName || '').toLowerCase());
                if (matchDay) {
                  groupedByDay[matchDay].push(alarm);
                } else {
                  groupedByDay['Monday'].push(alarm);
                }
              });

              return `
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                      <h3 style="font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                        <span>🗓️</span> Weekly Alarms Master Schedule
                      </h3>
                      <p style="font-size: 0.85rem; color: var(--text-secondary);">Showing all configured alarms across Monday through Friday from your active timetable.</p>
                    </div>
                    <span class="badge badge-active" style="font-size: 0.75rem;">WEEKLY ROUTINE</span>
                  </div>

                  ${
                    weeklyAlarms.length === 0
                      ? `
                    <div class="card empty-state" style="padding: 3rem 1.5rem; text-align: center;">
                      <div class="empty-state-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">📅</div>
                      <h3 style="margin-bottom: 0.35rem;">No Weekly Schedule Configured</h3>
                      <p style="color: var(--text-secondary); max-width: 460px; margin: 0 auto 1.25rem;">Upload or create a timetable in the Timetables tab to automatically generate recurring class alarms.</p>
                      <a href="#/timetables" class="btn btn-primary">Go to Timetables ➔</a>
                    </div>
                  `
                      : `
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                      ${WEEKDAYS.filter((d) => groupedByDay[d].length > 0)
                        .map((day) => {
                          return `
                          <div class="card" style="padding: 1.25rem 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                              <span style="font-size: 1.2rem;">📅</span>
                              <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); font-weight: 700;">${day}</h4>
                              <span class="badge badge-purple" style="font-size: 0.7rem; margin-left: auto;">${groupedByDay[day].length} Classes</span>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                              ${groupedByDay[day]
                                .map((alarm) => {
                                  const alertTimeStr = alarm.alert_time ? formatTime12h(alarm.alert_time) : '08:00 AM';
                                  const roomStr = alarm.room ? (alarm.room.startsWith('Room') || alarm.room.startsWith('Lab') || alarm.room.startsWith('Hall') ? alarm.room : `Room ${alarm.room}`) : 'Room 1100';

                                  return `
                                  <div style="background: var(--bg-card); border-radius: var(--radius-md); border-left: 4px solid var(--primary-purple); padding: 0.85rem 1rem; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                      <strong style="font-size: 0.95rem; color: var(--text-primary); display: block;">${alarm.class_name}</strong>
                                      <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.2rem;">
                                        🔔 Alarm: <strong style="color: var(--primary-purple);">${alertTimeStr}</strong> (${alarm.minutes_before}m before)
                                      </div>
                                      <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">
                                        ⏰ ${formatTime12h(alarm.start_time)} – ${formatTime12h(alarm.end_time || '10:00')} • 📍 ${roomStr}
                                      </div>
                                    </div>
                                    <button class="btn btn-ghost btn-sm btn-ring-single-alarm" data-name="${alarm.class_name}" title="Test Alarm Chime" style="padding: 0.35rem 0.6rem;">
                                      🔔
                                    </button>
                                  </div>
                                `;
                                })
                                .join('')}
                            </div>
                          </div>
                        `;
                        })
                        .join('')}
                    </div>
                  `
                  }
                </div>
              `;
            })()
          : ''
      }

      <!-- Tab 3: ALARM HISTORY (Daily vs Weekly vs Monthly Sub-Tabs) -->
      ${
        activeAlarmTab === 'history'
          ? `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span>🔔</span> Delivered Alarm History
              </h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">Archive of delivered class alarms and ring alerts. Non-alarm notifications are excluded.</p>
            </div>
            <span class="badge badge-warning" style="font-size: 0.75rem;">DELIVERED ALARMS</span>
          </div>

          <!-- History Sub-Tabs & Delete History Action -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-sm ${activeHistorySubTab === 'daily' ? 'btn-primary' : 'btn-outline'} history-subtab-btn" data-subtab="daily">
                📅 Daily Alarm History (${dailyHistory.length})
              </button>
              <button class="btn btn-sm ${activeHistorySubTab === 'weekly' ? 'btn-primary' : 'btn-outline'} history-subtab-btn" data-subtab="weekly">
                🗓️ Weekly Alarm History (${weeklyHistory.length})
              </button>
              <button class="btn btn-sm ${activeHistorySubTab === 'monthly' ? 'btn-primary' : 'btn-outline'} history-subtab-btn" data-subtab="monthly">
                📊 Monthly Alarm History (${monthlyHistory.length})
              </button>
            </div>

            ${
              historyAlarms.length > 0
                ? `
              <button id="btn-clear-history" class="btn btn-outline btn-sm" data-timeframe="${activeHistorySubTab}" style="color: var(--status-error); border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.06); font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
                🗑️ Delete ${activeHistorySubTab.charAt(0).toUpperCase() + activeHistorySubTab.slice(1)} History
              </button>
            `
                : ''
            }
          </div>

          ${
            historyAlarms.length === 0
              ? `
            <div class="card empty-state" style="padding: 3rem 1.5rem;">
              <div class="empty-state-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔔</div>
              <h3>No ${activeHistorySubTab.charAt(0).toUpperCase() + activeHistorySubTab.slice(1)} Alarm History Yet</h3>
              <p style="color: var(--text-secondary); margin-top: 0.35rem;">When class alarms trigger with sound and ringtones, they will be archived here.</p>
            </div>
          `
              : `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${historyAlarms
                .map((notif) => {
                  return `
                  <div class="card card-hover" style="padding: 1.1rem 1.4rem; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid ${notif.read ? 'var(--border-color)' : 'var(--primary-purple)'}; background: ${notif.read ? 'var(--bg-card)' : 'var(--bg-soft-purple)'}; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                      <div style="font-size: 1.6rem; margin-top: 0.1rem;">🔔</div>
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <strong style="font-size: 0.98rem; color: var(--text-primary);">${notif.title}</strong>
                          <span class="badge badge-active" style="font-size: 0.65rem;">
                            ✓ ALARM DELIVERED
                          </span>
                          ${!notif.read ? `<span class="badge badge-purple" style="font-size: 0.65rem;">NEW</span>` : ''}
                        </div>
                        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.2rem;">${notif.message}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.4rem;">
                          ⏰ ${new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${formatDatePretty(notif.created_at.split('T')[0])}
                        </div>
                      </div>
                    </div>

                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      ${
                        !notif.read
                          ? `<button class="btn btn-ghost btn-sm btn-mark-read" data-id="${notif.id}">Mark Read</button>`
                          : ''
                      }
                      <button class="btn btn-ghost btn-sm btn-delete-single-alarm" data-id="${notif.id}" title="Delete this alarm record" style="color: var(--status-error); padding: 0.25rem 0.6rem; font-size: 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.05); font-weight: 600;">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      `
          : ''
      }
    `;

    // Handlers
    container.querySelectorAll('.alarm-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeAlarmTab = btn.getAttribute('data-tab');
        renderNotifications(container);
      });
    });

    container.querySelectorAll('.history-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeHistorySubTab = btn.getAttribute('data-subtab');
        renderNotifications(container);
      });
    });

    const switchWeeklyBtn = container.querySelector('#btn-switch-weekly-tab');
    if (switchWeeklyBtn) {
      switchWeeklyBtn.addEventListener('click', () => {
        activeAlarmTab = 'weekly';
        renderNotifications(container);
      });
    }

    const toneSelect = container.querySelector('#quick-alarm-tone-select');
    toneSelect?.addEventListener('change', (e) => {
      const selected = e.target.value;
      localStorage.setItem('smarttime_alarm_tone_1', selected);
      showToast('🎵 Alarm ringtone updated!', 'info');
    });

    container.querySelectorAll('.btn-ring-single-alarm').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name') || 'Class Lecture';
        const tone = getSavedAlarmTone();
        triggerLiveAlarm({
          title: `Class Alarm: ${name} ⏰`,
          message: `Your lecture "${name}" is starting soon. Prepare your study materials!`,
          toneId: tone
        });
        showToast(`🔔 Alarm Ringing for ${name}!`, 'success');
      });
    });

    container.querySelectorAll('.btn-mark-read').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await api.markNotificationRead(id);
          renderNotifications(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.btn-delete-single-alarm').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this alarm record from history?')) {
          try {
            await api.deleteNotification(id);
            showToast('🗑️ Alarm record deleted!', 'info');
            renderNotifications(container);
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    container.querySelector('#btn-clear-history')?.addEventListener('click', async (e) => {
      const timeframe = e.currentTarget.getAttribute('data-timeframe') || activeHistorySubTab;
      const tfName = timeframe.charAt(0).toUpperCase() + timeframe.slice(1);
      if (confirm(`Are you sure you want to delete all ${tfName} alarm history records?`)) {
        try {
          await api.clearAlarmHistory(timeframe);
          showToast(`🗑️ ${tfName} alarm history cleared successfully!`, 'success');
          renderNotifications(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    container.querySelector('#btn-mark-all-read')?.addEventListener('click', async () => {
      try {
        await api.markAllNotificationsRead();
        showToast('All notifications marked as read', 'success');
        renderNotifications(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelector('#btn-test-chime')?.addEventListener('click', async () => {
      const tone = getSavedAlarmTone();
      playAlarmTone(tone, 'Attention! Test reminder alert.');
      try {
        await api.testChime();
        showToast('🎵 Ringtone played and test notification created! 🔔', 'success');
        renderNotifications(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelector('#btn-trigger-alarm-now')?.addEventListener('click', async () => {
      const tone = getSavedAlarmTone();
      triggerLiveAlarm({
        title: 'Class Alarm Ringing! ⏰',
        message: 'Upcoming class alert triggered! Ringing live on your device.',
        toneId: tone
      });
      try {
        const res = await api.triggerAlarm();
        showToast(res.message || 'Class alarm triggered! 🔔', 'success');
        activeAlarmTab = 'history';
        renderNotifications(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    console.error('Notifications render error:', err);
    container.innerHTML = `<div class="empty-state">Failed to load notifications: ${err.message}</div>`;
  }
}
