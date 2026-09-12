/**
 * Interactive Calendar View Component for SmartTime AI
 * Supports Day, Week, and Month views with interactive day-click scheduling,
 * full manual timetable customization, event details, and alarm configuration.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { formatTime12h, formatDatePretty, DAYS_LIST } from '../utils/dateUtils.js';
import { playAlarmTone, getSavedAlarmTone } from '../utils/audioUtils.js';

let activeCalendarView = 'week'; // 'day' | 'week' | 'month'
let calendarReferenceDate = new Date();

export async function renderCalendar(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem 0;">
      <div class="check-item loading" style="font-size: 1.1rem;">
        <div class="check-item-icon">⏳</div> Loading calendar...
      </div>
    </div>
  `;

  try {
    // Calculate range based on active view
    const { startDateStr, endDateStr, titleStr } = calculateViewDateRange();
    const data = await api.getEvents(startDateStr, endDateStr);
    const events = data.events || [];

    container.innerHTML = `
      <!-- Calendar Controls -->
      <div class="calendar-controls">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <h2 style="font-size: 1.6rem; min-width: 240px; margin: 0;">${titleStr}</h2>
          <div style="display: flex; gap: 0.25rem;">
            <button id="cal-nav-prev" class="btn btn-outline btn-icon" title="Previous">◀</button>
            <button id="cal-nav-today" class="btn btn-outline btn-sm">Today</button>
            <button id="cal-nav-next" class="btn btn-outline btn-icon" title="Next">▶</button>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 3px; display: flex; gap: 2px;">
            <button class="btn btn-sm ${activeCalendarView === 'day' ? 'btn-primary' : 'btn-ghost'} cal-view-btn" data-v="day">Day</button>
            <button class="btn btn-sm ${activeCalendarView === 'week' ? 'btn-primary' : 'btn-ghost'} cal-view-btn" data-v="week">Week</button>
            <button class="btn btn-sm ${activeCalendarView === 'month' ? 'btn-primary' : 'btn-ghost'} cal-view-btn" data-v="month">Month</button>
          </div>

          <button id="cal-add-class-btn" class="btn btn-primary" style="background: linear-gradient(135deg, var(--primary-purple), #4f46e5); font-weight: 700; box-shadow: 0 4px 14px var(--primary-purple-glow); display: inline-flex; align-items: center; gap: 0.35rem;">
            <span>➕</span> Add Schedule & Alarm
          </button>
        </div>
      </div>

      <!-- Calendar Body Display -->
      <div id="calendar-grid-container" class="card" style="padding: 1.25rem; min-height: 500px;">
        <!-- Filled by view renderers -->
      </div>

      <!-- Event Details & Manual Schedule Modal Container -->
      <div id="modal-event-details-container"></div>
    `;

    const gridContainer = container.querySelector('#calendar-grid-container');

    if (activeCalendarView === 'week') {
      renderWeekView(gridContainer, events, startDateStr);
    } else if (activeCalendarView === 'day') {
      renderDayView(gridContainer, events, startDateStr);
    } else if (activeCalendarView === 'month') {
      renderMonthView(gridContainer, events, startDateStr);
    }

    // Attach Navigation & View Switchers
    container.querySelectorAll('.cal-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCalendarView = btn.getAttribute('data-v');
        renderCalendar(container);
      });
    });

    container.querySelector('#cal-nav-today')?.addEventListener('click', () => {
      calendarReferenceDate = new Date();
      renderCalendar(container);
    });

    container.querySelector('#cal-nav-prev')?.addEventListener('click', () => {
      adjustDate(-1);
      renderCalendar(container);
    });

    container.querySelector('#cal-nav-next')?.addEventListener('click', () => {
      adjustDate(1);
      renderCalendar(container);
    });

    container.querySelector('#cal-add-class-btn')?.addEventListener('click', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      openAddCalendarEventModal(container, todayStr);
    });
  } catch (err) {
    console.error('Calendar render error:', err);
    container.innerHTML = `<div class="empty-state">Failed to load calendar: ${err.message}</div>`;
  }
}

function adjustDate(direction) {
  if (activeCalendarView === 'day') {
    calendarReferenceDate.setDate(calendarReferenceDate.getDate() + direction);
  } else if (activeCalendarView === 'week') {
    calendarReferenceDate.setDate(calendarReferenceDate.getDate() + direction * 7);
  } else if (activeCalendarView === 'month') {
    calendarReferenceDate.setMonth(calendarReferenceDate.getMonth() + direction);
  }
}

function calculateViewDateRange() {
  const ref = new Date(calendarReferenceDate);

  if (activeCalendarView === 'day') {
    const dStr = ref.toISOString().split('T')[0];
    return {
      startDateStr: dStr,
      endDateStr: dStr,
      titleStr: ref.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    };
  } else if (activeCalendarView === 'week') {
    const day = ref.getDay(); // 0 is Sun
    const diffToMonday = ref.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ref.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDateStr: monday.toISOString().split('T')[0],
      endDateStr: sunday.toISOString().split('T')[0],
      titleStr: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    };
  } else {
    // Month
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    return {
      startDateStr: firstDay.toISOString().split('T')[0],
      endDateStr: lastDay.toISOString().split('T')[0],
      titleStr: ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  }
}

// WEEK VIEW
function renderWeekView(container, events, weekStartStr) {
  const start = new Date(weekStartStr);
  const weekDays = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDays.push(d);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="calendar-scroll-wrapper">
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); min-width: 700px; gap: 0.5rem;">
        ${weekDays
          .map((d) => {
            const dStr = d.toISOString().split('T')[0];
            const isToday = dStr === todayStr;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = d.getDate();
            const dayEvents = events.filter((e) => e.date === dStr);

            return `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div class="calendar-cell-clickable" data-date="${dStr}" title="Click to add schedule for ${dayName}" style="text-align: center; padding: 0.5rem; border-radius: var(--radius-md); ${isToday ? 'background: var(--primary-purple); color: white; font-weight: bold;' : 'background: var(--bg-main); color: var(--text-secondary);'}">
                <div style="font-size: 0.75rem; text-transform: uppercase;">${dayName}</div>
                <div style="font-size: 1.15rem; font-weight: 700;">${dayNum}</div>
              </div>

              <div class="calendar-cell calendar-cell-clickable ${isToday ? 'today' : ''}" data-date="${dStr}" style="min-height: 380px;" title="Click anywhere to add schedule on this day">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">${dayEvents.length} Classes</span>
                  <span class="cell-add-btn" title="Add schedule on this day">+</span>
                </div>

                ${
                  dayEvents.length === 0
                    ? `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 1.5rem; padding: 0.5rem; border: 1px dashed var(--border-color); border-radius: 6px;">
                         + Click to add schedule
                       </div>`
                    : dayEvents
                        .map(
                          (evt) => `
                      <div class="event-pill event-click-target" data-event-id="${evt.base_event_id}" data-date="${evt.date}" style="padding: 0.4rem 0.6rem; margin-bottom: 4px;" title="View details">
                        <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${evt.class_name}</div>
                        <div style="font-size: 0.68rem; opacity: 0.9;">⏰ ${evt.start_time_formatted}</div>
                      </div>
                    `
                        )
                        .join('')
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;

  attachEventClickListeners(container, events);
}

// DAY VIEW
function renderDayView(container, events, dayStr) {
  const dayEvents = events.filter((e) => e.date === dayStr);

  container.innerHTML = `
    <div style="max-width: 720px; margin: 0 auto;">
      <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.35rem;">Schedule for ${formatDatePretty(dayStr)}</h3>
          <p style="margin: 0.2rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Add, adjust, or view routine for this date.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="badge badge-purple">${dayEvents.length} Classes</span>
          <button class="btn btn-primary btn-sm btn-day-add-event" data-date="${dayStr}" style="font-weight: 600;">
            ➕ Add to this Day
          </button>
        </div>
      </div>

      ${
        dayEvents.length === 0
          ? `
        <div class="empty-state calendar-cell-clickable" data-date="${dayStr}" style="padding: 3rem 1.5rem; cursor: pointer; border: 2px dashed var(--border-color); border-radius: var(--radius-lg); text-align: center;">
          <div class="empty-state-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">📅</div>
          <div class="empty-state-title" style="font-size: 1.15rem; font-weight: 700;">No Classes on this day</div>
          <div class="empty-state-desc" style="color: var(--text-secondary); margin-top: 0.35rem; margin-bottom: 1.25rem;">
            You can manually set a timetable, lecture, study routine or all-day alarm right now.
          </div>
          <button class="btn btn-primary btn-day-add-event" data-date="${dayStr}">➕ Add Schedule & Alarm</button>
        </div>
      `
          : `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${dayEvents
            .map((evt) => {
              return `
              <div class="card card-hover event-click-target" data-event-id="${evt.base_event_id}" data-date="${evt.date}" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid var(--primary-purple); padding: 1.1rem 1.35rem;">
                <div>
                  <h4 style="font-size: 1.15rem; margin: 0;">${evt.class_name}</h4>
                  <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.35rem;">
                    ⏰ <strong>${evt.time_range_formatted}</strong> (${evt.duration} mins)
                    ${evt.teacher ? ` • 👨‍🏫 ${evt.teacher}` : ''}
                    ${evt.room ? ` • 📍 ${evt.room}` : ''}
                  </div>
                  ${evt.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">📝 ${evt.notes}</div>` : ''}
                </div>

                <button class="btn btn-outline btn-sm">View Details ➔</button>
              </div>
            `;
            })
            .join('')}
          
          <button class="btn btn-outline btn-day-add-event" data-date="${dayStr}" style="padding: 0.85rem; border-style: dashed; font-weight: 600; margin-top: 0.5rem;">
            ➕ Add Another Class / Routine to this Day
          </button>
        </div>
      `
      }
    </div>
  `;

  attachEventClickListeners(container, events);
}

// MONTH VIEW
function renderMonthView(container, events, firstDayStr) {
  const ref = new Date(firstDayStr);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDayOfWeek = new Date(y, m, 1).getDay(); // 0 is Sun
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Align to Mon

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="calendar-scroll-wrapper">
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); min-width: 650px; gap: 0.4rem;">
        ${DAYS_LIST.map((d) => `<div class="calendar-header-day">${d.substring(0, 3)}</div>`).join('')}

        ${cells
          .map((dayNum) => {
            if (!dayNum) {
              return `<div class="calendar-cell" style="background: transparent; border: none; min-height: 80px;"></div>`;
            }

            const dObj = new Date(y, m, dayNum);
            const dStr = dObj.toISOString().split('T')[0];
            const isToday = dStr === todayStr;
            const dayEvents = events.filter((e) => e.date === dStr);

            return `
            <div class="calendar-cell calendar-cell-clickable ${isToday ? 'today' : ''}" data-date="${dStr}" style="min-height: 95px;" title="Click on this date to add schedule & alarm">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; font-size: 0.82rem; ${isToday ? 'color: var(--primary-purple);' : ''}">${dayNum}</span>
                <span class="cell-add-btn" title="Add schedule on this day">+</span>
              </div>
              <div class="cell-events-list" style="display: flex; flex-direction: column; gap: 2px; margin-top: 3px;">
                ${dayEvents
                  .slice(0, 2)
                  .map(
                    (evt) => `
                  <div class="event-pill event-click-target" data-event-id="${evt.base_event_id}" data-date="${evt.date}" style="padding: 2px 5px; font-size: 0.72rem;" title="${evt.class_name} (${evt.start_time_formatted})">
                    ${evt.class_name}
                  </div>
                `
                  )
                  .join('')}
                ${dayEvents.length > 2 ? `<div style="font-size: 0.68rem; color: var(--primary-purple); font-weight: 600;">+${dayEvents.length - 2} more</div>` : ''}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;

  attachEventClickListeners(container, events);
}

function attachEventClickListeners(container, events) {
  // Existing Event Click (View details / edit / reschedule / delete)
  container.querySelectorAll('.event-click-target').forEach((elem) => {
    elem.addEventListener('click', (e) => {
      e.stopPropagation();
      const baseId = elem.getAttribute('data-event-id');
      const date = elem.getAttribute('data-date');
      const match = events.find((ev) => ev.base_event_id === baseId && ev.date === date);
      if (match) {
        openEventDetailsModal(match, container);
      }
    });
  });

  // Calendar Cell Day Click (Opens manual schedule & alarm modal)
  container.querySelectorAll('.calendar-cell-clickable').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.event-click-target')) return;
      const date = cell.getAttribute('data-date');
      if (date) {
        openAddCalendarEventModal(container, date);
      }
    });
  });

  // Day View specific Add buttons
  container.querySelectorAll('.btn-day-add-event').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const date = btn.getAttribute('data-date');
      openAddCalendarEventModal(container, date);
    });
  });
}

/**
 * Interactive Popup Modal for Manual Timetable Adjustment & Alarm Configuration
 */
function openAddCalendarEventModal(container, prefilledDate) {
  const holder = document.querySelector('#modal-event-details-container') || container;
  const targetDate = prefilledDate || new Date().toISOString().split('T')[0];
  const [targetY, targetM, targetD] = targetDate.split('-').map(Number);
  const dateObj = new Date(targetY, targetM - 1, targetD, 0, 0, 0, 0);
  const DAYS_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = DAYS_NAME[dateObj.getDay()];

  // Default end date (7 days later) for multi-day
  const nextWeekDate = new Date(targetY, targetM - 1, targetD + 7, 0, 0, 0, 0);
  const defaultEndDate = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

  let activeWeeksCount = 1; // 1, 2, 4, 8, 12, or custom
  let isCustomWeeks = false;
  let isOngoingWeekly = false;
  let isDailyRange = false;

  // Friendly preset suggestions for quick 1-tap entry
  const QUICK_SUBJECTS = [
    { name: 'Math', icon: '📐' },
    { name: 'Science', icon: '🔬' },
    { name: 'English', icon: '📖' },
    { name: 'Art', icon: '🎨' },
    { name: 'Music', icon: '🎵' },
    { name: 'Sports', icon: '⚽' },
    { name: 'Computer', icon: '💻' },
    { name: 'Swimming', icon: '🏊' }
  ];

  holder.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal-card" style="max-width: 590px; max-height: 90vh; overflow-y: auto; border-radius: var(--radius-xl); box-shadow: var(--shadow-float);">
        <!-- Modal Header -->
        <div class="modal-header" style="background: var(--bg-card); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 10;">
          <div>
            <h3 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
              <span>📅</span> Create New Schedule
            </h3>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              Pick your activity, set the time, and choose how many weeks to keep it active.
            </p>
          </div>
          <button class="btn btn-ghost btn-icon modal-close" style="font-size: 1.25rem;" title="Close">✕</button>
        </div>

        <!-- Modal Body Form -->
        <div class="modal-body" style="padding: 1.4rem 1.5rem; display: flex; flex-direction: column; gap: 1.2rem;">
          
          <!-- STEP 1: Activity Name with 1-Tap Quick Chips -->
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.15rem;">
            <label style="display: block; font-size: 0.88rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.4rem;">
              🎒 1. What activity is this schedule for? <span style="color: var(--status-error);">*</span>
            </label>
            <input type="text" id="manual-event-title" class="form-control" placeholder="Type here (e.g. Math, Science, Piano, Swimming)..." required style="font-size: 1rem; font-weight: 600; padding: 0.65rem 0.85rem; margin-bottom: 0.65rem;">
            
            <!-- 1-Tap Preset Buttons -->
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.35rem;">
              ✨ Quick tap to choose:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;" id="quick-subject-chips">
              ${QUICK_SUBJECTS.map((s) => `
                <button type="button" class="btn btn-sm btn-outline quick-chip-btn" data-name="${s.name}" style="font-size: 0.82rem; padding: 0.3rem 0.65rem; border-radius: 999px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem;">
                  <span>${s.icon}</span> ${s.name}
                </button>
              `).join('')}
            </div>

            <!-- Notes (Optional) -->
            <div style="margin-top: 0.75rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem;">
                📝 Notes or Reminders (Optional):
              </label>
              <textarea id="manual-event-desc" class="form-control" rows="2" placeholder="e.g. Bring notebook, sports shoes, or water bottle..." style="font-size: 0.85rem; resize: vertical;"></textarea>
            </div>
          </div>

          <!-- STEP 2: Day & Time -->
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.15rem;">
            <div style="margin-bottom: 0.65rem;">
              <label style="font-size: 0.88rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                <span>⏰</span> 2. When is it? (Day & Time)
              </label>
            </div>

            <!-- Date & Weekday Row -->
            <div class="form-row-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                  📅 Starting Date
                </label>
                <input type="date" id="manual-event-date" class="form-control" value="${targetDate}">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                  🗓️ Day of the Week
                </label>
                <button type="button" id="manual-event-day-btn" class="form-control" style="background: var(--bg-card); font-weight: 700; color: var(--primary-purple); text-align: left; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1.5px solid rgba(108, 99, 255, 0.45); border-radius: 12px; padding: 0.55rem 0.85rem; font-size: 0.92rem;">
                  <span id="manual-event-day-label">${dayName}</span>
                  <span id="manual-event-day-chevron" style="font-size: 0.75rem; color: var(--text-secondary); transition: transform 0.2s;">▼</span>
                </button>
              </div>
            </div>

            <!-- EXPANDABLE REPEAT LIST PANEL (Exact match of Pic 2) -->
            <div id="day-cycle-dropdown-panel" style="display: none; margin-bottom: 0.85rem; background: var(--bg-card); border: 1.5px solid rgba(108, 99, 255, 0.35); border-radius: 16px; overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.08);">
              <div style="display: flex; flex-direction: column;">
                
                <!-- 1. Once -->
                <div class="day-cycle-item" data-cycle="once" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s;">
                  <span style="font-size: 0.93rem; font-weight: 700; color: var(--text-primary);">Once</span>
                  <div class="cycle-radio-circle" data-radio="once" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid #059669; display: flex; align-items: center; justify-content: center;">
                    <div class="cycle-radio-dot" style="width: 11px; height: 11px; border-radius: 50%; background: #059669; display: block;"></div>
                  </div>
                </div>

                <!-- 2. Every day -->
                <div class="day-cycle-item" data-cycle="everyday" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s;">
                  <span style="font-size: 0.93rem; font-weight: 700; color: var(--text-primary);">Every day</span>
                  <div class="cycle-radio-circle" data-radio="everyday" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                    <div class="cycle-radio-dot" style="width: 11px; height: 11px; border-radius: 50%; background: #059669; display: none;"></div>
                  </div>
                </div>

                <!-- 3. Monday to Friday -->
                <div class="day-cycle-item" data-cycle="weekdays" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s;">
                  <span style="font-size: 0.93rem; font-weight: 700; color: var(--text-primary);">Monday to Friday</span>
                  <div class="cycle-radio-circle" data-radio="weekdays" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                    <div class="cycle-radio-dot" style="width: 11px; height: 11px; border-radius: 50%; background: #059669; display: none;"></div>
                  </div>
                </div>

                <!-- 4. Shift workdays -->
                <div class="day-cycle-item" data-cycle="shift" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s;">
                  <span style="font-size: 0.93rem; font-weight: 700; color: var(--text-primary);">Shift workdays</span>
                  <div class="cycle-radio-circle" data-radio="shift" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                    <div class="cycle-radio-dot" style="width: 11px; height: 11px; border-radius: 50%; background: #059669; display: none;"></div>
                  </div>
                </div>

                <!-- 5. Custom -->
                <div class="day-cycle-item" data-cycle="custom" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: var(--bg-card); transition: background 0.15s;">
                  <span style="font-size: 0.93rem; font-weight: 700; color: var(--text-primary);">Custom</span>
                  <div class="cycle-radio-circle" data-radio="custom" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                    <div class="cycle-radio-dot" style="width: 11px; height: 11px; border-radius: 50%; background: #059669; display: none;"></div>
                  </div>
                </div>

                <!-- Custom Reminder Cycle Pills (Pic 2) -->
                <div id="custom-cycle-container" style="display: none; padding: 0.75rem 1rem 1rem 1rem; border-top: 1px solid var(--border-color); background: var(--bg-main);">
                  <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.65rem;">
                    Custom Reminder Cycle
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; background: var(--bg-card); padding: 0.65rem 0.85rem; border-radius: 999px; border: 1px solid var(--border-color);">
                    <button type="button" class="cycle-day-btn" data-day="Sunday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Sun</button>
                    <button type="button" class="cycle-day-btn" data-day="Monday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Mon</button>
                    <button type="button" class="cycle-day-btn" data-day="Tuesday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Tue</button>
                    <button type="button" class="cycle-day-btn" data-day="Wednesday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Wed</button>
                    <button type="button" class="cycle-day-btn" data-day="Thursday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Thu</button>
                    <button type="button" class="cycle-day-btn" data-day="Friday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Fri</button>
                    <button type="button" class="cycle-day-btn" data-day="Saturday" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid transparent; background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Sat</button>
                  </div>
                </div>

                <!-- Done / Close bar -->
                <div style="padding: 0.5rem 1rem; display: flex; justify-content: flex-end; background: var(--bg-card); border-top: 1px solid var(--border-color);">
                  <button type="button" id="btn-done-day-picker" class="btn btn-sm btn-primary" style="font-size: 0.82rem; font-weight: 700; padding: 0.35rem 1rem; border-radius: 8px;">
                    ✓ Done
                  </button>
                </div>

              </div>
            </div>

            <!-- Start & End Time Inputs -->
            <div id="time-inputs-row" class="form-row-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                  🟢 Start Time
                </label>
                <input type="time" id="manual-event-start-time" class="form-control" value="09:00" style="font-weight: 700; font-size: 0.95rem;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                  🔴 End Time
                </label>
                <input type="time" id="manual-event-end-time" class="form-control" value="10:30" style="font-weight: 700; font-size: 0.95rem;">
              </div>
            </div>
          </div>

          <!-- STEP 3: Reserve for How Many Weeks? -->
          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
              <label style="font-size: 0.88rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                <span>📆</span> 3. How many weeks do you want this?
              </label>
              <span class="badge badge-purple" id="badge-total-sessions" style="font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.65rem;">
                1 Week (Single Session)
              </span>
            </div>

            <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 0.75rem 0;">
              Pick how long you want to keep this reserved on this day and time:
            </p>

            <!-- Week Preset Buttons -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(95px, 1fr)); gap: 0.45rem; margin-bottom: 0.75rem;" id="week-selector-buttons">
              <button type="button" class="btn btn-sm btn-primary week-preset-btn" data-weeks="1" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                1 Week<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">Single Session</span>
              </button>
              <button type="button" class="btn btn-sm btn-outline week-preset-btn" data-weeks="2" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                2 Weeks<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">2 Weeks</span>
              </button>
              <button type="button" class="btn btn-sm btn-outline week-preset-btn" data-weeks="4" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                4 Weeks<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">1 Month</span>
              </button>
              <button type="button" class="btn btn-sm btn-outline week-preset-btn" data-weeks="8" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                8 Weeks<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">2 Months</span>
              </button>
              <button type="button" class="btn btn-sm btn-outline week-preset-btn" data-weeks="12" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                12 Weeks<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">Whole Term</span>
              </button>
              <button type="button" class="btn btn-sm btn-outline week-preset-btn" data-weeks="custom" style="font-size: 0.82rem; font-weight: 700; justify-content: center; padding: 0.5rem 0.25rem; text-align: center;">
                Custom<br><span style="font-size: 0.72rem; font-weight: normal; opacity: 0.9;">Pick weeks</span>
              </button>
            </div>

            <!-- Custom Weeks Stepper (Big buttons for easy clicking) -->
            <div id="custom-weeks-container" style="display: none; margin-bottom: 0.75rem; padding: 0.75rem 0.9rem; background: var(--bg-card); border: 1px dashed var(--primary-purple); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                <label style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                  🔢 Choose how many weeks:
                </label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <button type="button" id="btn-dec-weeks" class="btn btn-outline btn-sm btn-icon" style="width: 36px; height: 36px; font-size: 1.2rem; font-weight: 800;">−</button>
                  <input type="number" id="manual-event-custom-weeks" min="1" max="52" value="3" class="form-control" style="width: 70px; text-align: center; font-size: 1.05rem; font-weight: 800; padding: 0.35rem;">
                  <button type="button" id="btn-inc-weeks" class="btn btn-outline btn-sm btn-icon" style="width: 36px; height: 36px; font-size: 1.2rem; font-weight: 800;">+</button>
                  <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary-purple);">Weeks</span>
                </div>
              </div>
            </div>

            <!-- Repeat Continuously Checkbox -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding-top: 0.6rem; border-top: 1px solid var(--border-color); margin-bottom: 0.75rem;">
              <label style="font-size: 0.83rem; color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 700;">
                <input type="checkbox" id="manual-event-ongoing-toggle" style="cursor: pointer;">
                🔄 Repeat every week indefinitely (Always Active)
              </label>
              <button type="button" id="btn-toggle-daily-range" class="btn btn-ghost btn-sm" style="font-size: 0.78rem; color: var(--text-secondary); padding: 0.2rem 0.5rem;">
                🗓️ Or switch to consecutive days
              </button>
            </div>

            <!-- Multi-Day End Date (Hidden by default) -->
            <div id="end-date-container" style="display: none; margin-bottom: 0.75rem; padding: 0.75rem 0.9rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                🏁 End Date (Last Day):
              </label>
              <input type="date" id="manual-event-end-date" class="form-control" value="${defaultEndDate}">
              <span style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.25rem; display: block;">
                This schedule will repeat every single day from start to end date.
              </span>
            </div>
          </div>

          <!-- STEP 4: Alarm Reminder -->
          <div style="background: rgba(108, 99, 255, 0.07); border: 1px solid rgba(108, 99, 255, 0.25); border-radius: var(--radius-md); padding: 0.9rem 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 800; color: var(--text-primary); cursor: pointer;">
                <input type="checkbox" id="manual-event-alarm-toggle" checked style="cursor: pointer; width: 17px; height: 17px;">
                🔔 4. Ring an Alarm before start time
              </label>
              <button type="button" id="btn-test-modal-chime" class="btn btn-ghost btn-sm" style="font-size: 0.82rem; color: var(--primary-purple); font-weight: 700; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                🔊 Play Ringtone
              </button>
            </div>

            <div id="alarm-settings-row" style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <span style="font-size: 0.83rem; font-weight: 600; color: var(--text-secondary);">When to ring:</span>
              <select id="manual-event-rem-minutes" class="form-control" style="width: auto; font-size: 0.88rem; font-weight: 600; padding: 0.4rem 0.75rem;">
                <option value="15">15 minutes before start time</option>
                <option value="30" selected>30 minutes before start time (Recommended)</option>
                <option value="45">45 minutes before start time</option>
                <option value="60">1 hour before start time</option>
                <option value="0">Right when it starts</option>
              </select>
            </div>
          </div>

          <!-- OPTIONAL: Room & Teacher -->
          <div class="form-row-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                📍 Room or Place (Optional)
              </label>
              <input type="text" id="manual-event-room" class="form-control" placeholder="e.g. Room 101, Lab, Gym" style="font-size: 0.85rem;">
            </div>
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem;">
                👨‍🏫 Teacher Name (Optional)
              </label>
              <input type="text" id="manual-event-teacher" class="form-control" placeholder="e.g. Mr. Smith" style="font-size: 0.85rem;">
            </div>
          </div>

          <!-- LIVE SUMMARY CARD (Cheerful, clear, and reassuring) -->
          <div id="reservation-preview-box" style="background: linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(79, 70, 229, 0.05)); border: 1.5px solid rgba(108, 99, 255, 0.4); border-radius: var(--radius-md); padding: 0.9rem 1.15rem; font-size: 0.86rem;">
            <!-- Filled dynamically by updateReservationPreview() -->
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="modal-footer" style="background: var(--bg-card); padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); position: sticky; bottom: 0; z-index: 10;">
          <button type="button" class="btn btn-outline modal-close" style="font-weight: 600;">Cancel</button>
          <button type="button" id="btn-save-manual-event" class="btn btn-primary" style="background: linear-gradient(135deg, var(--primary-purple), #4f46e5); font-size: 0.95rem; font-weight: 800; box-shadow: 0 4px 14px var(--primary-purple-glow); padding: 0.65rem 1.6rem;">
            💾 Save My Schedule
          </button>
        </div>
      </div>
    </div>
  `;

  // Close listeners
  holder.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      holder.innerHTML = '';
    });
  });

  // Quick 1-tap subject chips
  holder.querySelectorAll('.quick-chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const subjectName = btn.getAttribute('data-name');
      const titleInput = holder.querySelector('#manual-event-title');
      if (titleInput) {
        titleInput.value = subjectName;
        titleInput.focus();
        updateReservationPreview();
      }
    });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // State for Day Repeat Cycle (Pic 2)
  let activeDaysMode = 'once'; // 'once' | 'everyday' | 'weekdays' | 'shift' | 'custom'
  let activeCustomDays = [dayName];

  function getSelectedDaysList(curDayName) {
    if (activeDaysMode === 'once') return [curDayName];
    if (activeDaysMode === 'everyday') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (activeDaysMode === 'weekdays') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (activeDaysMode === 'shift') return ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    if (activeDaysMode === 'custom') return activeCustomDays.length > 0 ? activeCustomDays : [curDayName];
    return [curDayName];
  }

  function getDaysDisplayLabel(curDayName) {
    if (activeDaysMode === 'once') return `${curDayName}`;
    if (activeDaysMode === 'everyday') return 'Every day';
    if (activeDaysMode === 'weekdays') return 'Monday to Friday';
    if (activeDaysMode === 'shift') return 'Shift workdays';
    if (activeDaysMode === 'custom') {
      const shortDays = activeCustomDays.map((d) => d.slice(0, 3));
      return shortDays.length > 0 ? `Custom (${shortDays.join(', ')})` : 'Custom';
    }
    return curDayName;
  }

  function updateDayPickerUI(curDayName) {
    const labelSpan = holder.querySelector('#manual-event-day-label');
    if (labelSpan) {
      labelSpan.textContent = getDaysDisplayLabel(curDayName);
    }

    holder.querySelectorAll('.day-cycle-item').forEach((item) => {
      const cycle = item.getAttribute('data-cycle');
      const circle = item.querySelector('.cycle-radio-circle');
      const dot = item.querySelector('.cycle-radio-dot');
      if (cycle === activeDaysMode) {
        if (circle) circle.style.borderColor = '#059669';
        if (dot) dot.style.display = 'block';
      } else {
        if (circle) circle.style.borderColor = 'var(--border-color)';
        if (dot) dot.style.display = 'none';
      }
    });

    const customContainer = holder.querySelector('#custom-cycle-container');
    if (customContainer) {
      customContainer.style.display = activeDaysMode === 'custom' ? 'block' : 'none';
    }

    holder.querySelectorAll('.cycle-day-btn').forEach((btn) => {
      const d = btn.getAttribute('data-day');
      if (activeCustomDays.includes(d)) {
        btn.style.background = '#d1fae5';
        btn.style.color = '#065f46';
        btn.style.borderColor = '#10b981';
        btn.style.fontWeight = '800';
      } else {
        btn.style.background = '#f3f4f6';
        btn.style.color = '#4b5563';
        btn.style.borderColor = 'transparent';
        btn.style.fontWeight = '700';
      }
    });
  }

  // Toggle Day Picker Dropdown Panel
  const dayBtn = holder.querySelector('#manual-event-day-btn');
  const dayDropdown = holder.querySelector('#day-cycle-dropdown-panel');
  const dayChevron = holder.querySelector('#manual-event-day-chevron');

  dayBtn?.addEventListener('click', () => {
    const isVisible = dayDropdown.style.display === 'block';
    dayDropdown.style.display = isVisible ? 'none' : 'block';
    if (dayChevron) dayChevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  holder.querySelector('#btn-done-day-picker')?.addEventListener('click', () => {
    if (dayDropdown) dayDropdown.style.display = 'none';
    if (dayChevron) dayChevron.style.transform = 'rotate(0deg)';
  });

  // Day Cycle Items Click
  holder.querySelectorAll('.day-cycle-item').forEach((item) => {
    item.addEventListener('click', () => {
      const cycle = item.getAttribute('data-cycle');
      activeDaysMode = cycle;

      const dateVal = holder.querySelector('#manual-event-date')?.value || targetDate;
      const [y, m, d] = dateVal.split('-').map(Number);
      const curDay = DAYS_NAME[new Date(y, m - 1, d, 0, 0, 0, 0).getDay()];

      if (cycle === 'custom' && activeCustomDays.length === 0) {
        activeCustomDays = [curDay];
      }

      updateDayPickerUI(curDay);
      updateReservationPreview();
    });
  });

  // Custom Cycle Day Buttons Click
  holder.querySelectorAll('.cycle-day-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const d = btn.getAttribute('data-day');
      if (activeCustomDays.includes(d)) {
        if (activeCustomDays.length > 1) {
          activeCustomDays = activeCustomDays.filter((x) => x !== d);
        }
      } else {
        activeCustomDays.push(d);
      }
      activeDaysMode = 'custom';

      const dateVal = holder.querySelector('#manual-event-date')?.value || targetDate;
      const [y, m, dNum] = dateVal.split('-').map(Number);
      const curDay = DAYS_NAME[new Date(y, m - 1, dNum, 0, 0, 0, 0).getDay()];

      updateDayPickerUI(curDay);
      updateReservationPreview();
    });
  });

  // Helper: dynamic reservation preview updater
  function updateReservationPreview() {
    const rawTitle = holder.querySelector('#manual-event-title')?.value.trim();
    const hasTitle = !!rawTitle;
    const titleVal = hasTitle
      ? escapeHtml(rawTitle)
      : '<span style="color: var(--text-secondary); font-style: italic; font-weight: 500;">(Type activity name above)</span>';
    const cardHeaderTitle = hasTitle ? escapeHtml(rawTitle) : 'New Schedule';
    const dateVal = holder.querySelector('#manual-event-date')?.value || targetDate;
    const startTimeVal = holder.querySelector('#manual-event-start-time')?.value || '09:00';
    const endTimeVal = holder.querySelector('#manual-event-end-time')?.value || '10:30';
    const hasAlarm = holder.querySelector('#manual-event-alarm-toggle')?.checked;
    const remMinutes = holder.querySelector('#manual-event-rem-minutes')?.value || '30';
    const previewBox = holder.querySelector('#reservation-preview-box');
    const badgeSessions = holder.querySelector('#badge-total-sessions');
    const saveBtn = holder.querySelector('#btn-save-manual-event');

    if (!previewBox) return;

    const [y, m, d] = dateVal.split('-').map(Number);
    const dObj = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dName = DAYS_NAME[dObj.getDay()];
    const daysLabel = getDaysDisplayLabel(dName);
    const activeDaysList = getSelectedDaysList(dName);
    const formattedDateSingle = `${dName}, ${dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const timeFormatted = `${formatTime12h(startTimeVal)} – ${formatTime12h(endTimeVal)}`;
    const alarmText = hasAlarm
      ? (remMinutes === '0' ? '🔔 Alarm will ring right when it starts' : `🔔 Alarm will ring ${remMinutes} minutes before start time`)
      : '🔕 Alarm is turned off';

    if (isOngoingWeekly) {
      if (badgeSessions) badgeSessions.textContent = `Every Week (${daysLabel})`;
      if (saveBtn) saveBtn.innerHTML = `💾 Save Schedule (${daysLabel})`;
      previewBox.innerHTML = `
        <div style="font-weight: 800; color: var(--primary-purple); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem;">
          <span>🔄</span> Weekly Schedule: ${cardHeaderTitle} (${daysLabel})
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem; color: var(--text-primary);">
          <div>🎒 <strong>Activity:</strong> ${titleVal}</div>
          <div>🗓️ <strong>When:</strong> Every <strong>${daysLabel}</strong> at <strong>${timeFormatted}</strong></div>
          <div>♾️ <strong>Duration:</strong> Keeps repeating every week on your calendar</div>
          <div style="color: #059669; font-weight: 700;">${alarmText}</div>
        </div>
      `;
      return;
    }

    if (isDailyRange) {
      const endVal = holder.querySelector('#manual-event-end-date')?.value || dateVal;
      if (badgeSessions) badgeSessions.textContent = 'Daily Range';
      if (saveBtn) saveBtn.innerHTML = '💾 Save Daily Schedule';
      previewBox.innerHTML = `
        <div style="font-weight: 800; color: var(--primary-purple); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem;">
          <span>🗓️</span> Daily Schedule: ${cardHeaderTitle}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem; color: var(--text-primary);">
          <div>🎒 <strong>Activity:</strong> ${titleVal}</div>
          <div>📅 <strong>Dates:</strong> From <strong>${formatDatePretty(dateVal)}</strong> to <strong>${formatDatePretty(endVal)}</strong></div>
          <div>⏰ <strong>Time:</strong> ${timeFormatted}</div>
          <div style="color: #059669; font-weight: 700;">${alarmText}</div>
        </div>
      `;
      return;
    }

    // Calculation for activeDaysMode
    const numWeeks = activeWeeksCount;

    if (activeDaysMode === 'once') {
      if (badgeSessions) badgeSessions.textContent = '1 Session (Once)';
      if (saveBtn) saveBtn.innerHTML = `💾 Save Schedule (${dName})`;
      previewBox.innerHTML = `
        <div style="font-weight: 800; color: var(--primary-purple); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem;">
          <span>✨</span> ${hasTitle ? `New Schedule: ${cardHeaderTitle}` : `New Schedule for ${dName}`}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem; color: var(--text-primary);">
          <div>🎒 <strong>Activity:</strong> ${titleVal}</div>
          <div>📅 <strong>Date:</strong> <strong>${formattedDateSingle}</strong></div>
          <div>⏰ <strong>Time:</strong> ${timeFormatted}</div>
          <div style="color: #059669; font-weight: 700;">${alarmText}</div>
        </div>
      `;
    } else {
      const totalSessions = activeDaysList.length * numWeeks;
      if (badgeSessions) badgeSessions.textContent = `${numWeeks} ${numWeeks === 1 ? 'Week' : 'Weeks'} (${totalSessions} Sessions)`;
      if (saveBtn) saveBtn.innerHTML = `💾 Save Schedule (${numWeeks} ${numWeeks === 1 ? 'Week' : 'Weeks'})`;

      previewBox.innerHTML = `
        <div style="font-weight: 800; color: var(--primary-purple); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem;">
          <span>🎉</span> Reserved for ${numWeeks} ${numWeeks === 1 ? 'Week' : 'Weeks'} (${cardHeaderTitle})
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem; color: var(--text-primary);">
          <div>🎒 <strong>Activity:</strong> ${titleVal}</div>
          <div>🗓️ <strong>Days:</strong> <strong>${daysLabel}</strong> at <strong>${timeFormatted}</strong></div>
          <div>🔢 <strong>Total:</strong> <strong>${totalSessions} sessions</strong> across ${numWeeks} ${numWeeks === 1 ? 'week' : 'weeks'}</div>
          <div style="color: #059669; font-weight: 700;">${alarmText} for each session</div>
        </div>
      `;
    }
  }

  // Title change listener
  holder.querySelector('#manual-event-title')?.addEventListener('input', updateReservationPreview);

  // Date change listener -> updates day display and preview
  const dateInput = holder.querySelector('#manual-event-date');
  dateInput?.addEventListener('change', (e) => {
    const dVal = e.target.value;
    if (dVal) {
      const [y, m, d] = dVal.split('-').map(Number);
      const dO = new Date(y, m - 1, d, 0, 0, 0, 0);
      const newDay = DAYS_NAME[dO.getDay()];
      if (activeDaysMode === 'once') {
        activeCustomDays = [newDay];
      }
      updateDayPickerUI(newDay);
      updateReservationPreview();
    }
  });

  // Week Presets Selection
  const weekButtons = holder.querySelectorAll('.week-preset-btn');
  const customWeeksContainer = holder.querySelector('#custom-weeks-container');
  const customWeeksInput = holder.querySelector('#manual-event-custom-weeks');
  const ongoingToggle = holder.querySelector('#manual-event-ongoing-toggle');
  const dailyRangeContainer = holder.querySelector('#end-date-container');

  weekButtons.forEach((b) => {
    b.addEventListener('click', () => {
      weekButtons.forEach((btn) => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      });
      b.classList.remove('btn-outline');
      b.classList.add('btn-primary');

      // Uncheck ongoing when a week button is clicked
      if (ongoingToggle) ongoingToggle.checked = false;
      isOngoingWeekly = false;

      const wVal = b.getAttribute('data-weeks');
      if (wVal === 'custom') {
        isCustomWeeks = true;
        customWeeksContainer.style.display = 'block';
        activeWeeksCount = Math.max(1, parseInt(customWeeksInput.value, 10) || 3);
      } else {
        isCustomWeeks = false;
        customWeeksContainer.style.display = 'none';
        activeWeeksCount = parseInt(wVal, 10) || 1;
      }

      updateReservationPreview();
    });
  });

  // Custom weeks stepper
  holder.querySelector('#btn-dec-weeks')?.addEventListener('click', () => {
    let cur = parseInt(customWeeksInput.value, 10) || 1;
    if (cur > 1) {
      cur--;
      customWeeksInput.value = cur;
      activeWeeksCount = cur;
      updateReservationPreview();
    }
  });

  holder.querySelector('#btn-inc-weeks')?.addEventListener('click', () => {
    let cur = parseInt(customWeeksInput.value, 10) || 1;
    if (cur < 52) {
      cur++;
      customWeeksInput.value = cur;
      activeWeeksCount = cur;
      updateReservationPreview();
    }
  });

  customWeeksInput?.addEventListener('input', (e) => {
    const val = Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1));
    activeWeeksCount = val;
    updateReservationPreview();
  });

  // Ongoing Weekly Toggle
  ongoingToggle?.addEventListener('change', (e) => {
    isOngoingWeekly = e.target.checked;
    if (isOngoingWeekly) {
      weekButtons.forEach((btn) => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      });
      customWeeksContainer.style.display = 'none';
    } else {
      // Revert to activeWeeksCount
      const matchBtn = Array.from(weekButtons).find(
        (btn) => btn.getAttribute('data-weeks') === String(activeWeeksCount)
      );
      if (matchBtn) {
        matchBtn.classList.remove('btn-outline');
        matchBtn.classList.add('btn-primary');
      }
    }
    updateReservationPreview();
  });

  // Switch to Daily Range Button
  holder.querySelector('#btn-toggle-daily-range')?.addEventListener('click', () => {
    isDailyRange = !isDailyRange;
    dailyRangeContainer.style.display = isDailyRange ? 'block' : 'none';
    const btn = holder.querySelector('#btn-toggle-daily-range');
    if (btn) {
      btn.textContent = isDailyRange
        ? '↩️ Back to Weeks Selection'
        : '🗓️ Switch to consecutive days';
    }
    updateReservationPreview();
  });

  holder.querySelector('#manual-event-end-date')?.addEventListener('change', updateReservationPreview);

  // Time Inputs Change Listeners
  holder.querySelector('#manual-event-start-time')?.addEventListener('change', updateReservationPreview);
  holder.querySelector('#manual-event-end-time')?.addEventListener('change', updateReservationPreview);

  // Alarm Checkbox & Minutes
  const alarmToggle = holder.querySelector('#manual-event-alarm-toggle');
  const alarmSettingsRow = holder.querySelector('#alarm-settings-row');
  alarmToggle?.addEventListener('change', (e) => {
    alarmSettingsRow.style.display = e.target.checked ? 'flex' : 'none';
    updateReservationPreview();
  });
  holder.querySelector('#manual-event-rem-minutes')?.addEventListener('change', updateReservationPreview);

  // Test tone button
  holder.querySelector('#btn-test-modal-chime')?.addEventListener('click', () => {
    const tone = getSavedAlarmTone();
    playAlarmTone(tone, 'Test alarm reminder sound');
    showToast('🔔 Playing alarm test ringtone...', 'info');
  });

  // Initial Preview Render
  updateReservationPreview();

  // Save Event Button
  holder.querySelector('#btn-save-manual-event')?.addEventListener('click', async (e) => {
    const title = holder.querySelector('#manual-event-title')?.value.trim();
    if (!title) {
      showToast('Please enter an activity name (e.g. Math, Piano, Swimming)', 'error');
      holder.querySelector('#manual-event-title')?.focus();
      return;
    }

    const desc = holder.querySelector('#manual-event-desc')?.value.trim() || '';
    const dateVal = holder.querySelector('#manual-event-date')?.value;
    const endDateVal = holder.querySelector('#manual-event-end-date')?.value;
    const startTimeVal = holder.querySelector('#manual-event-start-time')?.value || '09:00';
    const endTimeVal = holder.querySelector('#manual-event-end-time')?.value || '10:30';
    const hasAlarm = holder.querySelector('#manual-event-alarm-toggle')?.checked;
    const remMinutes = hasAlarm ? parseInt(holder.querySelector('#manual-event-rem-minutes')?.value, 10) : 0;
    const roomVal = holder.querySelector('#manual-event-room')?.value.trim() || '';
    const teacherVal = holder.querySelector('#manual-event-teacher')?.value.trim() || '';

    const saveBtn = e.currentTarget;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Saving Schedule...';

    try {
      const [y, m, d] = dateVal.split('-').map(Number);
      const dObj = new Date(y, m - 1, d, 0, 0, 0, 0);
      const dayCalc = DAYS_NAME[dObj.getDay()];

      const payload = {
        class_name: title,
        subject: title,
        date: dateVal,
        day: dayCalc,
        start_time: startTimeVal,
        end_time: endTimeVal,
        teacher: teacherVal,
        room: roomVal,
        notes: desc,
        is_all_day: false,
        has_alarm: hasAlarm,
        reminder_minutes: remMinutes,
        repeat_type: isOngoingWeekly ? 'weekly' : (isDailyRange ? 'daily_range' : 'weeks'),
        weeks_count: isOngoingWeekly ? 1 : activeWeeksCount,
        end_date: isDailyRange ? endDateVal : null,
        days_mode: activeDaysMode,
        selected_days: getSelectedDaysList(dayCalc)
      };

      const res = await api.createEvent(payload);
      const weeksSaved = payload.weeks_count;
      const daysDisplayMsg = getDaysDisplayLabel(dayCalc);
      const successMsg = isOngoingWeekly
        ? `✅ Permanent weekly schedule for "${title}" saved successfully!`
        : (isDailyRange
          ? `✅ Multi-day schedule for "${title}" saved successfully!`
          : (activeDaysMode === 'once'
            ? `🎉 Saved "${title}" for ${dayCalc} successfully!`
            : `🎉 Yay! Saved "${title}" for ${weeksSaved} ${weeksSaved === 1 ? 'week' : 'weeks'} (${daysDisplayMsg})!`));

      showToast(successMsg, 'success');
      holder.innerHTML = '';
      state.notify();
      renderCalendar(container);
    } catch (err) {
      showToast('Failed to save schedule: ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '💾 Save My Schedule';
    }
  });
}

// EVENT DETAILS MODAL (Edit, Reschedule, Delete, Pause)
function openEventDetailsModal(eventObj, container) {
  const holder = document.querySelector('#modal-event-details-container');
  if (!holder) return;

  const totalWeeks = eventObj.metadata?.total_weeks || 1;
  const weekNum = eventObj.metadata?.week_number || 1;
  const isMultiWeek = totalWeeks > 1;

  holder.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Class Details</h3>
          <button class="btn btn-ghost btn-icon modal-close" title="Close">✕</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.5rem;">
            <div class="badge badge-purple">${eventObj.subject || 'Class'}</div>
            ${isMultiWeek ? `<div class="badge" style="background: rgba(108, 99, 255, 0.15); color: var(--primary-purple); font-weight: 700;">📆 Week ${weekNum} of ${totalWeeks}</div>` : ''}
          </div>
          <h2 style="font-size: 1.6rem; margin-bottom: 0.5rem;">${eventObj.class_name}</h2>

          <div style="background: var(--bg-soft-purple); border-radius: var(--radius-md); padding: 1rem 1.25rem; margin: 1.25rem 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.95rem;">
            <div>📅 <strong>Date & Day:</strong> ${formatDatePretty(eventObj.date)} (${eventObj.day})</div>
            <div>⏰ <strong>Time Range:</strong> ${eventObj.time_range_formatted} (${eventObj.duration} mins)</div>
            ${eventObj.teacher ? `<div>👨‍🏫 <strong>Instructor / Teacher:</strong> ${eventObj.teacher}</div>` : ''}
            ${eventObj.room ? `<div>📍 <strong>Room / Place:</strong> ${eventObj.room}</div>` : ''}
            ${eventObj.location ? `<div>🏛️ <strong>Location:</strong> ${eventObj.location}</div>` : ''}
            ${eventObj.notes ? `<div>📝 <strong>Notes:</strong> ${eventObj.notes}</div>` : ''}
          </div>

          <div style="background: var(--bg-soft-blue); border-radius: var(--radius-md); padding: 0.85rem 1.2rem; font-size: 0.88rem; color: #0369A1; margin-bottom: 1.5rem;">
            🔔 <strong>Alarm Status:</strong> Active reminder scheduled for this class.
          </div>

          <!-- Action Buttons -->
          <div class="form-row-2">
            <button id="btn-modal-reschedule" class="btn btn-secondary">
              ⏰ Change Time
            </button>
            <button id="btn-modal-edit" class="btn btn-outline">
              ✏️ Rename Class
            </button>
            <button id="btn-modal-pause-rem" class="btn btn-outline">
              🔕 Pause Alarm
            </button>
            <button id="btn-modal-delete" class="btn btn-danger">
              🗑 Delete Class
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  holder.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => (holder.innerHTML = ''));
  });

  // Reschedule
  holder.querySelector('#btn-modal-reschedule').addEventListener('click', () => {
    const newStart = prompt('Enter new start time (HH:MM, e.g. 10:00):', eventObj.start_time);
    if (newStart) {
      api
        .updateEvent(eventObj.base_event_id, { start_time: newStart })
        .then(() => {
          showToast('Class rescheduled and reminders updated!', 'success');
          holder.innerHTML = '';
          state.notify();
          renderCalendar(container);
        })
        .catch((err) => showToast(err.message, 'error'));
    }
  });

  // Edit Info
  holder.querySelector('#btn-modal-edit').addEventListener('click', () => {
    const newName = prompt('Enter new name for this class:', eventObj.class_name);
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      api
        .updateEvent(eventObj.base_event_id, { class_name: trimmed, subject: trimmed })
        .then(() => {
          showToast(`Class renamed to "${trimmed}"!`, 'success');
          holder.innerHTML = '';
          state.notify();
          renderCalendar(container);
        })
        .catch((err) => showToast(err.message, 'error'));
    }
  });

  // Pause Reminder
  holder.querySelector('#btn-modal-pause-rem').addEventListener('click', () => {
    showToast('Reminders paused for this class', 'info');
    holder.innerHTML = '';
  });

  // Delete
  holder.querySelector('#btn-modal-delete').addEventListener('click', () => {
    if (isMultiWeek) {
      const deleteSeries = confirm(
        `This class is part of a ${totalWeeks}-week reservation (Week ${weekNum} of ${totalWeeks}).\n\n` +
        `• Click "OK" to delete ALL ${totalWeeks} weekly classes in this reservation.\n` +
        `• Click "Cancel" to delete ONLY this single class today.`
      );

      if (deleteSeries) {
        api
          .deleteEvent(eventObj.base_event_id, true)
          .then((res) => {
            showToast(res.message || `All ${totalWeeks} weekly classes deleted`, 'success');
            holder.innerHTML = '';
            state.notify();
            renderCalendar(container);
          })
          .catch((err) => showToast(err.message, 'error'));
      } else {
        if (confirm(`Delete ONLY today's class on ${formatDatePretty(eventObj.date)}?`)) {
          api
            .deleteEvent(eventObj.base_event_id, false)
            .then(() => {
              showToast('This single class was deleted', 'success');
              holder.innerHTML = '';
              state.notify();
              renderCalendar(container);
            })
            .catch((err) => showToast(err.message, 'error'));
        }
      }
    } else {
      if (confirm(`Are you sure you want to delete "${eventObj.class_name}"?`)) {
        api
          .deleteEvent(eventObj.base_event_id, false)
          .then(() => {
            showToast('Class deleted and reminders cancelled', 'success');
            holder.innerHTML = '';
            state.notify();
            renderCalendar(container);
          })
          .catch((err) => showToast(err.message, 'error'));
      }
    }
  });
}

