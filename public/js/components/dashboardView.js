/**
 * Dashboard View Component for SmartTime AI
 * Displays: Next Class countdown, Today's Schedule timeline, Timetable Status, and Quick Actions.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { formatTime12h, formatDatePretty } from '../utils/dateUtils.js';

let countdownTimer = null;

export async function renderDashboard(container) {
  // Clear any previous interval
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem 0;">
      <div class="check-item loading" style="font-size: 1.1rem;">
        <div class="check-item-icon">⏳</div> Loading your schedule...
      </div>
    </div>
  `;

  try {
    const data = await api.getDashboard();
    state.setUnreadCount(data.unread_notifications_count || 0);

    const user = state.user;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

    const nextClass = data.next_class;
    const todaySchedule = data.today_schedule || [];
    const ttStatus = data.timetable_status;

    container.innerHTML = `
      <!-- Header -->
      <div class="dashboard-header">
        <div>
          <h1 style="font-size: 2rem; margin-bottom: 0.25rem;">
            ${greeting}, ${user?.name || 'manahil'} 👋
          </h1>
          <p style="font-size: 1rem; color: var(--text-secondary);">
            Here's what's on your schedule for <strong>${data.current_date}</strong>.
          </p>
        </div>
      </div>

      <!-- Main Dashboard Grid -->
      <div class="dashboard-grid">
        <!-- Left Column: Next Class & Today's Schedule -->
        <div style="display: flex; flex-direction: column; gap: 1.75rem;">
          <!-- Next Class Card -->
          ${
            nextClass
              ? `
            <div class="next-class-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span class="badge" style="background: rgba(255, 255, 255, 0.2); color: white; margin-bottom: 0.75rem;">
                    NEXT CLASS
                  </span>
                  <h2 style="font-size: 1.85rem; margin-bottom: 0.5rem;">${nextClass.class_name}</h2>
                  <div style="font-size: 1.1rem; opacity: 0.95; font-weight: 500;">
                    ⏰ ${nextClass.time_range_formatted}
                  </div>
                </div>

                <button id="btn-view-next-class" class="btn btn-secondary" style="background: white; color: var(--primary-purple); border: none; font-weight: 700;">
                  View Details
                </button>
              </div>

              <div style="display: flex; gap: 1.5rem; margin-top: 1.25rem; font-size: 0.9rem; opacity: 0.9; flex-wrap: wrap;">
                ${nextClass.teacher ? `<div>👨‍🏫 <strong>Teacher:</strong> ${nextClass.teacher}</div>` : ''}
                ${nextClass.room ? `<div>📍 <strong>Room:</strong> ${nextClass.room}</div>` : ''}
                ${nextClass.location ? `<div>🏛️ <strong>Hall:</strong> ${nextClass.location}</div>` : ''}
              </div>

              <div class="next-class-countdown">
                <span>⏱</span>
                <span id="live-countdown-text">${nextClass.countdown_text}</span>
              </div>
            </div>
          `
              : `
            <div class="card card-purple-tint" style="padding: 2.25rem; text-align: center;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${ttStatus?.has_active ? '🎉' : '✨'}</div>
              <h3>${ttStatus?.has_active ? 'No More Classes Today' : 'No Timetable Added Yet'}</h3>
              <p style="margin-top: 0.35rem; color: var(--text-secondary);">
                ${ttStatus?.has_active ? 'You are completely free for the rest of today! Relax or prepare for tomorrow.' : 'Upload a photo of your timetable, scan with your camera, or add classes manually to get organized.'}
              </p>
              ${!ttStatus?.has_active ? `
                <button id="btn-hero-add-schedule" class="btn btn-primary btn-lg" style="margin-top: 1.25rem;">
                  ✨ Add Your Schedule Now
                </button>
              ` : ''}
            </div>
          `
          }

          <!-- Today's Schedule Timeline -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="display: flex; align-items: center; gap: 0.5rem;">
                <span>📅</span> Today's Schedule
              </h3>
              <span class="badge badge-purple">${todaySchedule.length} ${todaySchedule.length === 1 ? 'Class' : 'Classes'}</span>
            </div>

            ${
              todaySchedule.length === 0
                ? `
              <div class="empty-state" style="padding: 2rem 1rem;">
                <div class="empty-state-icon" style="font-size: 1.75rem; width: 56px; height: 56px;">📅</div>
                <div class="empty-state-title" style="font-size: 1.1rem;">No Classes Scheduled For Today</div>
                <div class="empty-state-desc" style="font-size: 0.88rem;">Enjoy your break! Click below if you'd like to add a class.</div>
                <button class="btn btn-outline btn-sm" id="btn-add-today-class">+ Add a Class</button>
              </div>
            `
                : `
              <div class="today-timeline">
                ${todaySchedule
                  .map((evt) => {
                    const statusBadge =
                      evt.timeline_status === 'ongoing'
                        ? `<span class="badge badge-warning">Ongoing Now</span>`
                        : evt.timeline_status === 'completed'
                        ? `<span class="badge badge-success">✓ Completed</span>`
                        : `<span class="badge badge-blue">Upcoming</span>`;

                    return `
                    <div class="timeline-event-card">
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                          <strong style="font-size: 1.05rem;">${evt.class_name}</strong>
                          ${statusBadge}
                        </div>
                        <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.35rem;">
                          ⏰ <strong>${formatTime12h(evt.start_time)} – ${formatTime12h(evt.end_time)}</strong>
                          ${evt.teacher ? ` • 👨‍🏫 ${evt.teacher}` : ''}
                          ${evt.room ? ` • 📍 ${evt.room}` : ''}
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span title="Reminder configured" style="font-size: 1.2rem;">🔔</span>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        </div>

        <!-- Right Column: Timetable Status & Quick Actions -->
        <div style="display: flex; flex-direction: column; gap: 1.75rem;">
          <!-- Current Timetable Status Card -->
          <div class="card card-blue-tint">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h4 style="display: flex; align-items: center; gap: 0.4rem;">
                <span>📋</span> Current Timetable
              </h4>
              <span class="badge ${ttStatus.status === 'active' ? 'badge-active' : ttStatus.status === 'expiring_soon' ? 'badge-expiring' : 'badge-expired'}">
                ${ttStatus.status === 'active' ? 'ACTIVE' : ttStatus.status === 'expiring_soon' ? 'EXPIRING SOON' : ttStatus.status === 'expired' ? 'EXPIRED' : 'NO TIMETABLE'}
              </span>
            </div>

            ${
              ttStatus.has_active
                ? `
              <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                ${ttStatus.name}
              </div>
              <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
                Valid Until: <strong>${formatDatePretty(ttStatus.end_date)}</strong>
                <div style="color: var(--primary-purple); font-weight: 600; margin-top: 0.25rem;">
                  ⏳ ${ttStatus.validity_label}
                </div>
              </div>
              <button id="btn-manage-timetable-card" class="btn btn-outline btn-block">
                Manage Timetable ➔
              </button>
            `
                : `
              <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.5rem;">No active timetable configured.</p>
            `
            }
          </div>

          <!-- Quick Actions Grid -->
          <div class="card">
            <h4 style="margin-bottom: 0.25rem;">Quick Actions</h4>
            <p style="font-size: 0.85rem; margin-bottom: 1rem;">Fast shortcuts to update your schedule.</p>

            <div class="quick-actions-grid">
              <div class="quick-action-btn" id="qa-upload">
                <div class="quick-action-icon">📷</div>
                <strong style="font-size: 0.88rem;">Upload Timetable</strong>
              </div>

              <div class="quick-action-btn" id="qa-speak">
                <div class="quick-action-icon">🎤</div>
                <strong style="font-size: 0.88rem;">Speak Schedule</strong>
              </div>

              <div class="quick-action-btn" id="qa-add-class">
                <div class="quick-action-icon">✍️</div>
                <strong style="font-size: 0.88rem;">Add Class</strong>
              </div>

              <div class="quick-action-btn" id="qa-view-calendar">
                <div class="quick-action-icon">📅</div>
                <strong style="font-size: 0.88rem;">View Calendar</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Live Second-by-Second Dynamic Countdown
    if (nextClass && nextClass.target_timestamp) {
      const countdownElem = container.querySelector('#live-countdown-text');
      if (countdownElem) {
        countdownTimer = setInterval(() => {
          const now = Date.now();
          const diffMs = nextClass.target_timestamp - now;
          if (diffMs <= 0) {
            countdownElem.textContent = 'Class starting now!';
            clearInterval(countdownTimer);
          } else {
            const totalSec = Math.floor(diffMs / 1000);
            const days = Math.floor(totalSec / (3600 * 24));
            const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;

            if (days > 0) {
              countdownElem.textContent = `Starts in ${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
              countdownElem.textContent = `Starts in ${hours}h ${minutes}m ${seconds}s`;
            } else {
              countdownElem.textContent = `Starts in ${minutes}m ${seconds}s`;
            }
          }
        }, 1000);
      }
    }

    // Attach Action Handlers
    const addScheduleBtn = container.querySelector('#dash-add-schedule-btn');
    if (addScheduleBtn) addScheduleBtn.addEventListener('click', () => state.setView('add-schedule'));

    const manageTtBtn = container.querySelector('#btn-manage-timetable-card');
    if (manageTtBtn) manageTtBtn.addEventListener('click', () => state.setView('timetables'));

    const heroAddBtn = container.querySelector('#btn-hero-add-schedule');
    if (heroAddBtn) heroAddBtn.addEventListener('click', () => state.setView('add-schedule'));

    const createFirstTt = container.querySelector('#btn-create-first-tt');
    if (createFirstTt) createFirstTt.addEventListener('click', () => state.setView('add-schedule'));

    const addTodayClass = container.querySelector('#btn-add-today-class');
    if (addTodayClass) addTodayClass.addEventListener('click', () => state.setView('add-schedule'));

    const viewNextClass = container.querySelector('#btn-view-next-class');
    if (viewNextClass) viewNextClass.addEventListener('click', () => state.setView('calendar'));

    // Quick Actions
    container.querySelector('#qa-upload')?.addEventListener('click', () => state.setView('add-schedule'));
    container.querySelector('#qa-speak')?.addEventListener('click', () => state.setView('add-schedule'));
    container.querySelector('#qa-add-class')?.addEventListener('click', () => state.setView('add-schedule'));
    container.querySelector('#qa-view-calendar')?.addEventListener('click', () => state.setView('calendar'));
  } catch (err) {
    console.error('Dashboard render error:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Failed to load dashboard</div>
        <div class="empty-state-desc">${err.message}</div>
        <button class="btn btn-primary" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }
}
