/**
 * My Timetables View Component for SmartTime AI
 * Handles timetable listing, weekly timetable matrix form view, rename, extension, replacement, pausing, and deletion.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { formatTime12h, formatDatePretty, calculateDaysRemaining, addMonthsSafe, computeDurationText, DAYS_LIST } from '../utils/dateUtils.js';
import { eventsToCSV, downloadCSV } from '../utils/csvUtils.js';

// Subject color theme mapping
const SUBJECT_PALETTES = [
  { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', text: '#312e81', badge: '#4f46e5' },
  { border: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', text: '#0c4a6e', badge: '#0284c7' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', text: '#064e3b', badge: '#059669' },
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', text: '#78350f', badge: '#d97706' },
  { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', text: '#881337', badge: '#e11d48' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', text: '#4c1d95', badge: '#7c3aed' },
  { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)', text: '#134e4a', badge: '#0d9488' }
];

function getSubjectPalette(subject, colorMap) {
  const key = (subject || 'Class').trim().toLowerCase();
  if (!colorMap[key]) {
    const count = Object.keys(colorMap).length;
    colorMap[key] = SUBJECT_PALETTES[count % SUBJECT_PALETTES.length];
  }
  return colorMap[key];
}

function computeAlarmTimeString(startTimeStr, reminderMinutes) {
  if (!startTimeStr || reminderMinutes === undefined || reminderMinutes === null || Number(reminderMinutes) <= 0) {
    return null;
  }
  const [hStr, mStr] = startTimeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return null;

  let totalMin = h * 60 + m - Number(reminderMinutes);
  if (totalMin < 0) totalMin += 24 * 60;
  const alertH = Math.floor(totalMin / 60) % 24;
  const alertM = totalMin % 60;
  const ampm = alertH >= 12 ? 'PM' : 'AM';
  const h12 = alertH % 12 === 0 ? 12 : alertH % 12;
  const mFmt = alertM < 10 ? '0' + alertM : alertM;
  return `${h12}:${mFmt} ${ampm}`;
}

export async function renderTimetables(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem 0;">
      <div class="check-item loading" style="font-size: 1.1rem;">
        <div class="check-item-icon">⏳</div> Loading timetables...
      </div>
    </div>
  `;

  try {
    const data = await api.getTimetables();
    const timetables = data.timetables || [];

    container.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h1 style="font-size: 2rem; margin-bottom: 0.25rem;">My Timetables 📋</h1>
          <p style="color: var(--text-secondary);">Manage, extend, rename, or click any timetable to open its full schedule chart.</p>
        </div>

        <button id="btn-add-new-timetable" class="btn btn-primary btn-lg">
          + Add New Timetable
        </button>
      </div>

      ${
        timetables.length === 0
          ? `
        <div class="card empty-state" style="margin-top: 1rem;">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No Timetables Found</div>
          <div class="empty-state-desc">Upload your timetable photo or speak your schedule to get started.</div>
          <button class="btn btn-primary" id="btn-empty-add-tt">Add Your Timetable</button>
        </div>
      `
          : `
        <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem;">
          ${timetables
            .map((tt) => {
              const daysLeft = calculateDaysRemaining(tt.end_date);
              const isExpiring = daysLeft > 0 && daysLeft <= 7;
              const isExpired = tt.status === 'expired' || daysLeft === 0;

              const badgeClass =
                tt.status === 'active'
                  ? isExpiring
                    ? 'badge-warning'
                    : 'badge-active'
                  : tt.status === 'paused'
                  ? 'badge-blue'
                  : 'badge-expired';

              const badgeLabel =
                tt.status === 'active'
                  ? isExpiring
                    ? `Expiring Soon (${daysLeft}d)`
                    : 'Active'
                  : tt.status === 'paused'
                  ? 'Paused'
                  : 'Expired';

              const reminderMin = tt.reminder_1_minutes !== undefined && tt.reminder_1_minutes !== null ? tt.reminder_1_minutes : 45;

              return `
              <div class="card card-hover card-timetable-item" data-tt-id="${tt.id}" style="border-left: 5px solid ${tt.status === 'active' ? 'var(--primary-purple)' : 'var(--border-color)'}; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                  <div class="tt-card-click-area" data-id="${tt.id}" style="flex: 1; min-width: 260px;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                      <h3 style="font-size: 1.35rem; display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                        <span>${tt.name}</span>
                        <button class="btn btn-ghost btn-sm btn-rename-tt" data-id="${tt.id}" data-name="${tt.name}" title="Rename timetable" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                          ✏️ Rename
                        </button>
                      </h3>
                      <span class="badge ${badgeClass}">${badgeLabel}</span>
                    </div>
                    <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.35rem;">
                      Created on ${formatDatePretty(tt.created_at.split('T')[0])} • Source: <strong style="text-transform: capitalize;">${tt.source_type || 'Upload'}</strong>
                    </div>
                  </div>

                  <div class="tt-card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-primary btn-sm btn-view-tt-form" data-id="${tt.id}" style="background: linear-gradient(135deg, var(--primary-purple), #4f46e5); font-weight: 600; box-shadow: 0 4px 12px var(--primary-purple-glow);">
                      👁️ View Timetable Form
                    </button>
                    <button class="btn btn-outline btn-sm btn-extend-tt" data-id="${tt.id}" data-name="${tt.name}" data-end="${tt.end_date}" data-start="${tt.start_date}" data-duration="${tt.duration}">
                      ⏳ Extend
                    </button>
                    <button class="btn btn-secondary btn-sm btn-replace-tt" data-id="${tt.id}" data-name="${tt.name}">
                      🔄 Replace
                    </button>
                    <button class="btn btn-outline btn-sm btn-pause-tt" data-id="${tt.id}">
                      ${tt.status === 'paused' ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button class="btn btn-outline btn-sm btn-delete-tt" data-id="${tt.id}" data-name="${tt.name}" style="color: var(--status-error); border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05); font-weight: 600;">
                      🗑 Delete
                    </button>
                  </div>
                </div>

                <div class="tt-card-click-area" data-id="${tt.id}" style="background: var(--bg-main); border-radius: var(--radius-md); padding: 1rem 1.25rem; margin-top: 1.25rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                  <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Active Window</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                      ${formatDatePretty(tt.start_date)} – ${formatDatePretty(tt.end_date)}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Duration</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                      ${tt.duration || '3 Months'}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Total Classes</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: var(--primary-purple); margin-top: 0.2rem;">
                      ${tt.events_count || (tt.events ? tt.events.length : 0)} Repeating Classes
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Reminder Alert</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: #059669; margin-top: 0.2rem;">
                      🔔 ${reminderMin}m Before Class
                    </div>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }

      <!-- Modals Container -->
      <div id="tt-modals-holder"></div>
    `;

    // Handlers
    const addBtn = container.querySelector('#btn-add-new-timetable');
    if (addBtn) addBtn.addEventListener('click', () => state.setView('add-schedule'));

    const emptyAddBtn = container.querySelector('#btn-empty-add-tt');
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => state.setView('add-schedule'));

    // Open Timetable Form via card click or dedicated button
    const openFormForId = (id) => {
      const selected = timetables.find((t) => t.id === id);
      if (selected) {
        openTimetableGridModal(container, selected);
      }
    };

    container.querySelectorAll('.btn-view-tt-form').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openFormForId(id);
      });
    });

    container.querySelectorAll('.tt-card-click-area').forEach((area) => {
      area.addEventListener('click', (e) => {
        // Prevent if user clicked a button inside
        if (e.target.closest('button')) return;
        const id = area.getAttribute('data-id');
        openFormForId(id);
      });
    });

    // Rename Timetable Modal Trigger
    container.querySelectorAll('.btn-rename-tt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const selected = timetables.find((t) => t.id === id);
        if (selected) {
          openRenameModal(container, selected);
        }
      });
    });

    // Extend Modal Trigger
    container.querySelectorAll('.btn-extend-tt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const currentEnd = btn.getAttribute('data-end');
        const currentStart = btn.getAttribute('data-start');
        const currentDuration = btn.getAttribute('data-duration');
        openExtendModal(container, id, name, currentEnd, currentStart, currentDuration);
      });
    });

    // Replace Modal Trigger
    container.querySelectorAll('.btn-replace-tt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        openReplaceModal(container, id, name);
      });
    });

    // Pause / Resume Toggle
    container.querySelectorAll('.btn-pause-tt').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        try {
          btn.disabled = true;
          btn.textContent = '⏳ Updating...';
          const res = await api.pauseTimetable(id);
          showToast(res.message || 'Timetable status updated', 'success');
          await renderTimetables(container);
        } catch (err) {
          showToast(err.message, 'error');
          await renderTimetables(container);
        }
      });
    });

    // Delete
    container.querySelectorAll('.btn-delete-tt').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete "${name}"? This will stop all future calendar occurrences and reminders.`)) {
          try {
            await api.deleteTimetable(id);
            showToast('Timetable deleted successfully', 'success');
            renderTimetables(container);
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  } catch (err) {
    console.error('Timetables render error:', err);
    container.innerHTML = `<div class="empty-state">Failed to load timetables: ${err.message}</div>`;
  }
}

// ==============================================================================
// TIMETABLE MATRIX / FORM VIEW MODAL (ٹائم ٹیبل فارم دیکھیں)
// ==============================================================================
function openTimetableGridModal(container, timetable) {
  const holder = container.querySelector('#tt-modals-holder');
  let activeTab = 'matrix'; // 'matrix' | 'agenda' | 'image'
  const colorMap = {};

  const events = timetable.events || [];
  const reminderMinutes = timetable.reminder_1_minutes !== undefined && timetable.reminder_1_minutes !== null ? Number(timetable.reminder_1_minutes) : 45;

  // Days list: Monday-Friday default; add Saturday/Sunday if classes exist on weekends
  const matrixDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (events.some((e) => e.day === 'Saturday')) matrixDays.push('Saturday');
  if (events.some((e) => e.day === 'Sunday')) matrixDays.push('Sunday');

  // Compute time boundaries
  let minHour = 24;
  let maxHour = 0;

  events.forEach((e) => {
    if (e.start_time) {
      const sh = parseInt(e.start_time.split(':')[0], 10);
      if (!isNaN(sh)) minHour = Math.min(minHour, sh);
    }
    if (e.end_time) {
      const eh = parseInt(e.end_time.split(':')[0], 10);
      const em = parseInt(e.end_time.split(':')[1] || '0', 10);
      const ceilH = em > 0 ? eh + 1 : eh;
      if (!isNaN(ceilH)) maxHour = Math.max(maxHour, ceilH);
    } else if (e.start_time) {
      const sh = parseInt(e.start_time.split(':')[0], 10);
      if (!isNaN(sh)) maxHour = Math.max(maxHour, sh + 1);
    }
  });

  if (minHour === 24 || maxHour === 0 || minHour >= maxHour) {
    minHour = 9;
    maxHour = 17;
  }

  // Create standard hourly slots
  const slots = [];
  for (let h = minHour; h < maxHour; h++) {
    const ampm1 = h >= 12 ? 'PM' : 'AM';
    const ampm2 = h + 1 >= 12 ? 'PM' : 'AM';
    const h1 = h % 12 === 0 ? 12 : h % 12;
    const h2 = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
    slots.push({
      startHour: h,
      endHour: h + 1,
      label: `${h1}:00 ${ampm1} – ${h2}:00 ${ampm2}`,
      shortLabel: `${h1}:00 – ${h2}:00`
    });
  }

  let matrixOrientation = localStorage.getItem('smarttime_tt_matrix_orient') || 'days_as_rows';

  function renderModal() {
    holder.innerHTML = `
      <div class="modal-backdrop open no-print-backdrop">
        <div class="modal-card modal-card-xl" id="printable-timetable-form">
          <!-- Modal Header -->
          <div class="modal-header" style="background: var(--bg-card); flex-wrap: wrap; gap: 0.75rem; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); margin: 0;">
                  ${timetable.name}
                </h2>
                <button class="btn btn-ghost btn-sm btn-modal-rename" title="Rename this timetable" style="padding: 0.2rem 0.5rem; font-size: 0.85rem; color: var(--primary-purple);">
                  ✏️ Rename
                </button>
                <span class="badge ${timetable.status === 'active' ? 'badge-active' : 'badge-expired'}">
                  ${timetable.status ? timetable.status.toUpperCase() : 'ACTIVE'}
                </span>
              </div>
              <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem;">
                📅 Validity: <strong>${formatDatePretty(timetable.start_date)}</strong> – <strong>${formatDatePretty(timetable.end_date)}</strong> (${timetable.duration || '3 Months'}) • 
                🔔 Reminder: <strong style="color: #059669;">${reminderMinutes}m before class</strong>
              </div>
            </div>

            <div class="no-print" style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="btn btn-outline btn-sm btn-print-modal" title="Print or save as PDF">
                🖨️ Print / Save PDF
              </button>
              <button class="btn btn-ghost btn-icon modal-close" style="font-size: 1.25rem;">✕</button>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div class="tt-form-tabs no-print" style="flex-shrink: 0;">
            <button class="tt-form-tab-btn ${activeTab === 'matrix' ? 'active' : ''}" data-tab="matrix">
              📋 Weekly Timetable Form (ہفتہ وار فارم)
            </button>
            <button class="tt-form-tab-btn ${activeTab === 'agenda' ? 'active' : ''}" data-tab="agenda">
              📅 Day-by-Day Agenda (روزانہ لسٹ)
            </button>
            ${
              timetable.image_url
                ? `
              <button class="tt-form-tab-btn ${activeTab === 'image' ? 'active' : ''}" data-tab="image">
                🖼️ Original Uploaded Image (اصل تصویر)
              </button>
            `
                : ''
            }
          </div>

          <!-- Modal Body -->
          <div class="modal-body" style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1 1 auto; min-height: 0;">
            ${activeTab === 'matrix' ? renderMatrixTab() : activeTab === 'agenda' ? renderAgendaTab() : renderImageTab()}
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer no-print" style="background: var(--bg-card); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              Total: <strong>${events.length} repeating classes</strong> configured in this routine.
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-export-csv-modal" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 600;">
                <span>📥</span> Export as CSV
              </button>
              <button class="btn btn-outline modal-close">Close</button>
              <button class="btn btn-primary btn-print-modal">🖨️ Print Timetable</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Export as CSV listener
    holder.querySelector('.btn-export-csv-modal')?.addEventListener('click', () => {
      const csvStr = eventsToCSV(events, timetable.name || 'Timetable Schedule');
      const filename = (timetable.name || 'timetable_schedule').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
      downloadCSV(csvStr, `${filename}.csv`);
      showToast('✓ Timetable exported to CSV!', 'success');
    });

    // Attach Tab switching listeners
    holder.querySelectorAll('.tt-form-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderModal();
      });
    });

    // Close button
    holder.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        holder.innerHTML = '';
      });
    });

    // Print button
    holder.querySelectorAll('.btn-print-modal').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.print();
      });
    });

    // Modal inline rename button
    holder.querySelector('.btn-modal-rename')?.addEventListener('click', () => {
      openRenameModal(container, timetable, () => {
        renderModal();
      });
    });

    // Orientation toggle listeners
    holder.querySelector('#btn-orient-days-rows')?.addEventListener('click', () => {
      matrixOrientation = 'days_as_rows';
      localStorage.setItem('smarttime_tt_matrix_orient', 'days_as_rows');
      renderModal();
    });

    holder.querySelector('#btn-orient-times-rows')?.addEventListener('click', () => {
      matrixOrientation = 'times_as_rows';
      localStorage.setItem('smarttime_tt_matrix_orient', 'times_as_rows');
      renderModal();
    });
  }

  // --- TAB 1: WEEKLY MATRIX GRID VIEW ---
  function renderMatrixTab() {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              <span>📅</span> Weekly Class Schedule Routine
            </h3>
            <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">
              ${
                matrixOrientation === 'days_as_rows'
                  ? '📋 <strong>Week Days in Rows (Monday–Friday)</strong> • <strong>Time Slots in Columns</strong>'
                  : '📊 <strong>Time Periods in Rows</strong> • <strong>Week Days in Columns (Monday–Friday)</strong>'
              }
            </p>
          </div>

          <div style="display: flex; align-items: center; background: var(--bg-soft-purple); padding: 0.25rem 0.35rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color); gap: 0.35rem;">
            <button id="btn-orient-days-rows" class="btn btn-sm ${matrixOrientation === 'days_as_rows' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 700; border-radius: var(--radius-md); padding: 0.45rem 0.9rem; font-size: 0.83rem;" title="Days in Rows, Time Slots in Columns">
              📋 Days in Rows
            </button>
            <button id="btn-orient-times-rows" class="btn btn-sm ${matrixOrientation === 'times_as_rows' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 700; border-radius: var(--radius-md); padding: 0.45rem 0.9rem; font-size: 0.83rem;" title="Periods in Rows, Days in Columns">
              📊 Time Slots in Rows
            </button>
          </div>
        </div>

        ${matrixOrientation === 'days_as_rows' ? renderDaysAsRowsTable() : renderTimesAsRowsTable()}
      </div>
    `;
  }

  // --- LAYOUT A: DAYS IN ROWS (MONDAY - FRIDAY) & TIME PERIODS IN COLUMNS ---
  function renderDaysAsRowsTable() {
    let headerCols = `
      <tr>
        <th class="tt-day-head" style="min-width: 140px; text-align: center; position: sticky; left: 0; z-index: 2; background: var(--bg-card);">
          📅 Day / Weekday
        </th>
    `;

    slots.forEach((slot, idx) => {
      headerCols += `
        <th style="min-width: 175px; text-align: center; padding: 0.75rem 0.5rem;">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary-purple);">${slot.label}</div>
        </th>
      `;
    });
    headerCols += `</tr>`;

    let tableRows = '';
    matrixDays.forEach((day) => {
      let rowHtml = `
        <tr>
          <td class="tt-day-cell" style="font-weight: 800; font-size: 1rem; color: var(--primary-purple); background: var(--bg-card); min-width: 140px; text-align: center; position: sticky; left: 0; z-index: 2; border-right: 2px solid var(--border-color); vertical-align: middle;">
            <div style="font-size: 1.25rem; margin-bottom: 0.15rem;">📅</div>
            <div>${day}</div>
          </td>
      `;

      const occupiedSlots = new Set();

      slots.forEach((slot, slotIndex) => {
        if (occupiedSlots.has(slotIndex)) {
          return; // Skipped due to colspan from earlier slot
        }

        const dayEvents = events.filter((e) => {
          if (e.day !== day) return false;
          const sh = parseInt((e.start_time || '00').split(':')[0], 10);
          return sh === slot.startHour;
        });

        if (dayEvents.length > 0) {
          const matchEvt = dayEvents[0];
          let span = 1;
          if (matchEvt.end_time) {
            const eh = parseInt(matchEvt.end_time.split(':')[0], 10);
            const em = parseInt(matchEvt.end_time.split(':')[1] || '0', 10);
            const totalEndHour = em > 0 ? eh + 1 : eh;
            span = Math.max(1, totalEndHour - slot.startHour);
          } else if (matchEvt.duration) {
            span = Math.max(1, Math.round(matchEvt.duration / 60));
          }
          span = Math.min(span, slots.length - slotIndex);

          for (let s = 1; s < span; s++) {
            occupiedSlots.add(slotIndex + s);
          }

          const pal = getSubjectPalette(matchEvt.subject || matchEvt.class_name, colorMap);
          const alarmTime = computeAlarmTimeString(matchEvt.start_time, reminderMinutes);

          rowHtml += `
            <td colspan="${span}" style="padding: 0.5rem; vertical-align: top;">
              <div class="tt-class-tile" style="border-left-color: ${pal.border}; background: ${pal.bg}; border-radius: var(--radius-md); border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                <div class="tt-class-tile-title" style="color: ${pal.text}; font-size: 0.95rem; font-weight: 700;">
                  ${matchEvt.subject || matchEvt.class_name}
                </div>
                <div class="tt-class-tile-meta" style="margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem;">
                  <span style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">⏰ ${formatTime12h(matchEvt.start_time)}${matchEvt.end_time ? ` – ${formatTime12h(matchEvt.end_time)}` : ''} ${span > 1 ? `(${span} hrs)` : ''}</span>
                  <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                    ${matchEvt.room ? `<span style="background: rgba(0,0,0,0.06); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">📍 ${matchEvt.room}</span>` : ''}
                    ${matchEvt.teacher ? `<span style="background: rgba(0,0,0,0.06); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">👩‍🏫 ${matchEvt.teacher}</span>` : ''}
                  </div>
                </div>
                ${
                  alarmTime
                    ? `
                  <div class="tt-class-tile-alarm" title="Scheduled alarm reminder" style="margin-top: 0.35rem;">
                    <span>🔔 Alarm: ${alarmTime}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </td>
          `;
        } else {
          rowHtml += `
            <td class="tt-empty-slot" style="min-width: 155px; height: 90px;">
              <span style="color: var(--text-muted); opacity: 0.5; font-size: 0.85rem;">— Free —</span>
            </td>
          `;
        }
      });

      rowHtml += '</tr>';
      tableRows += rowHtml;
    });

    return `
      <div class="tt-matrix-container">
        <table class="tt-matrix-table">
          <thead>
            ${headerCols}
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- LAYOUT B: TIME PERIODS IN ROWS & DAYS IN COLUMNS ---
  function renderTimesAsRowsTable() {
    const occupied = new Set(); // Stores 'Day_SlotIndex'

    let tableRows = '';
    slots.forEach((slot, slotIndex) => {
      let rowHtml = `
        <tr>
          <td class="tt-time-cell">
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--primary-purple);">${slot.label}</div>
          </td>
      `;

      matrixDays.forEach((day) => {
        const cellKey = `${day}_${slotIndex}`;
        if (occupied.has(cellKey)) {
          return; // Skipped due to rowspan from earlier slot
        }

        const matchEvt = events.find((e) => {
          if (e.day !== day) return false;
          const sh = parseInt((e.start_time || '00').split(':')[0], 10);
          return sh === slot.startHour;
        });

        if (matchEvt) {
          let span = 1;
          if (matchEvt.end_time) {
            const eh = parseInt(matchEvt.end_time.split(':')[0], 10);
            const em = parseInt(matchEvt.end_time.split(':')[1] || '0', 10);
            const totalEndHour = em > 0 ? eh + 1 : eh;
            span = Math.max(1, totalEndHour - slot.startHour);
          } else if (matchEvt.duration) {
            span = Math.max(1, Math.round(matchEvt.duration / 60));
          }
          span = Math.min(span, slots.length - slotIndex);

          for (let s = 1; s < span; s++) {
            occupied.add(`${day}_${slotIndex + s}`);
          }

          const pal = getSubjectPalette(matchEvt.subject || matchEvt.class_name, colorMap);
          const alarmTime = computeAlarmTimeString(matchEvt.start_time, reminderMinutes);

          rowHtml += `
            <td rowspan="${span}" style="padding: 0.5rem; vertical-align: top;">
              <div class="tt-class-tile" style="border-left-color: ${pal.border}; background: ${pal.bg}; border-radius: var(--radius-md); border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                <div class="tt-class-tile-title" style="color: ${pal.text}; font-weight: 700;">
                  ${matchEvt.subject || matchEvt.class_name}
                </div>
                <div class="tt-class-tile-meta">
                  <span style="font-weight: 600;">⏰ ${formatTime12h(matchEvt.start_time)}${matchEvt.end_time ? ` – ${formatTime12h(matchEvt.end_time)}` : ''}</span>
                  ${matchEvt.room ? `<span style="background: rgba(0,0,0,0.06); padding: 0.15rem 0.4rem; border-radius: 4px;">📍 ${matchEvt.room}</span>` : ''}
                  ${matchEvt.teacher ? `<span style="background: rgba(0,0,0,0.06); padding: 0.15rem 0.4rem; border-radius: 4px;">👩‍🏫 ${matchEvt.teacher}</span>` : ''}
                </div>
                ${
                  alarmTime
                    ? `
                  <div class="tt-class-tile-alarm" title="Scheduled alarm reminder">
                    <span>🔔 Alarm: ${alarmTime}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </td>
          `;
        } else {
          rowHtml += `
            <td class="tt-empty-slot">
              <span style="color: var(--text-muted); opacity: 0.6; font-size: 0.8rem;">— Free —</span>
            </td>
          `;
        }
      });

      rowHtml += '</tr>';
      tableRows += rowHtml;
    });

    return `
      <div class="tt-matrix-container">
        <table class="tt-matrix-table">
          <thead>
            <tr>
              <th class="tt-time-head">Time / Slot</th>
              ${matrixDays.map((d) => `<th>${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- TAB 2: DAY-BY-DAY AGENDA VIEW ---
  function renderAgendaTab() {
    const dayGroups = {};
    DAYS_LIST.forEach((d) => (dayGroups[d] = []));
    events.forEach((evt) => {
      const d = evt.day || 'Monday';
      if (!dayGroups[d]) dayGroups[d] = [];
      dayGroups[d].push(evt);
    });

    // Sort each day by start time
    Object.keys(dayGroups).forEach((d) => {
      dayGroups[d].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });

    const activeDays = DAYS_LIST.filter((d) => dayGroups[d].length > 0);

    return `
      <div>
        <h3 style="font-size: 1.15rem; margin-bottom: 1.25rem;">
          Daily Class Schedule (روزانہ کا مکمل شیڈول)
        </h3>

        ${
          activeDays.length === 0
            ? '<div class="empty-state">No classes scheduled in this timetable.</div>'
            : `
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            ${activeDays
              .map((day) => {
                const dayClasses = dayGroups[day];
                return `
                <div class="card" style="padding: 1.25rem 1.5rem; border-left: 4px solid var(--primary-purple);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                    <h4 style="font-size: 1.15rem; color: var(--primary-purple); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                      <span>📅</span> ${day}
                    </h4>
                    <span class="badge badge-purple">${dayClasses.length} ${dayClasses.length === 1 ? 'Class' : 'Classes'}</span>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${dayClasses
                      .map((evt) => {
                        const pal = getSubjectPalette(evt.subject || evt.class_name, colorMap);
                        const alarmTime = computeAlarmTimeString(evt.start_time, reminderMinutes);
                        return `
                        <div style="background: var(--bg-main); border-radius: var(--radius-md); padding: 0.85rem 1.15rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border: 1px solid var(--border-color);">
                          <div>
                            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">
                              ${evt.subject || evt.class_name}
                            </div>
                            <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                              <span>⏰ <strong>${formatTime12h(evt.start_time)}</strong> – <strong>${formatTime12h(evt.end_time)}</strong></span>
                              ${evt.room ? `<span>📍 ${evt.room}</span>` : ''}
                              ${evt.teacher ? `<span>👨‍🏫 ${evt.teacher}</span>` : ''}
                            </div>
                          </div>

                          ${
                            alarmTime
                              ? `
                            <div style="background: rgba(16, 185, 129, 0.12); color: #047857; font-weight: 700; font-size: 0.82rem; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 0.3rem;">
                              🔔 Alarm Rings at ${alarmTime}
                            </div>
                          `
                              : ''
                          }
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
  }

  // --- TAB 3: ORIGINAL UPLOADED IMAGE ---
  function renderImageTab() {
    return `
      <div style="text-align: center;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3 style="font-size: 1.15rem; margin: 0;">Original Uploaded Timetable Sheet (اصل اپلوڈ شدہ تصویر)</h3>
          ${
            timetable.image_url
              ? `
            <a href="${timetable.image_url}" target="_blank" download="timetable_${timetable.id}.png" class="btn btn-outline btn-sm">
              ⬇️ Download Original Image
            </a>
          `
              : ''
          }
        </div>

        ${
          timetable.image_url
            ? `
          <div style="background: #181824; border-radius: var(--radius-lg); padding: 1rem; border: 1px solid var(--border-color); max-height: 550px; overflow: auto;">
            <img 
              src="${timetable.image_url}" 
              alt="${timetable.name}" 
              style="max-width: 100%; height: auto; border-radius: var(--radius-md); box-shadow: var(--shadow-md); object-fit: contain;" 
            />
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.75rem;">
            This is the original document or photo uploaded when creating "${timetable.name}".
          </p>
        `
            : `
          <div class="empty-state">
            <p>No original image attached to this timetable (created manually or via voice note).</p>
          </div>
        `
        }
      </div>
    `;
  }

  renderModal();
}

// ==============================================================================
// RENAME TIMETABLE MODAL (ٹائم ٹیبل کا نام تبدیل کریں)
// ==============================================================================
function openRenameModal(container, timetable, onComplete) {
  const holder = container.querySelector('#tt-modals-holder');
  holder.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h3 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <span>✏️</span> Rename Timetable
          </h3>
          <button class="btn btn-ghost btn-icon modal-close">✕</button>
        </div>

        <div class="modal-body">
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            Enter the exact name you want for this timetable (e.g. your original file name or semester title):
          </p>

          <div style="margin-bottom: 1.5rem;">
            <label for="input-rename-tt-val" style="display: block; font-weight: 700; font-size: 0.9rem; margin-bottom: 0.4rem; color: var(--text-primary);">
              Timetable Title (ٹائم ٹیبل کا نام):
            </label>
            <input 
              type="text" 
              id="input-rename-tt-val" 
              class="form-input" 
              value="${timetable.name || ''}" 
              placeholder="e.g. BSCS 5th Semester Section A"
              style="width: 100%; font-size: 1.05rem; font-weight: 600; padding: 0.7rem 0.9rem; margin-bottom: 0.6rem;"
            />
            <select id="rename-preset-select" class="form-input" style="width: 100%; font-size: 0.9rem; font-weight: 600; padding: 0.6rem 0.85rem; cursor: pointer;">
              <option value="">⚡ Or Choose from Presets (اختیارات میں سے چنیں)...</option>
              <option value="BSCS 5th Semester Section A">BSCS 5th Semester Section A</option>
              <option value="Semester Routine 2026">Semester Routine 2026</option>
              <option value="Fall 2026 Class Schedule">Fall 2026 Class Schedule</option>
              <option value="Spring 2026 Class Routine">Spring 2026 Class Routine</option>
              <option value="University Weekly Schedule">University Weekly Schedule</option>
              <option value="College Routine">College Routine</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-ghost modal-close">Cancel</button>
            <button id="btn-save-rename-tt" class="btn btn-primary">
              ✓ Save New Name
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  holder.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => (holder.innerHTML = ''));
  });

  const saveBtn = holder.querySelector('#btn-save-rename-tt');
  const input = holder.querySelector('#input-rename-tt-val');
  const presetSel = holder.querySelector('#rename-preset-select');
  if (presetSel) {
    presetSel.addEventListener('change', (e) => {
      if (e.target.value) {
        input.value = e.target.value;
      }
    });
  }
  input?.focus();

  const handleSave = async () => {
    const newName = input.value.trim();
    if (!newName) {
      showToast('Timetable name cannot be empty', 'warning');
      return;
    }
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';
      const res = await api.renameTimetable(timetable.id, newName);
      showToast(res.message || 'Timetable renamed successfully!', 'success');
      timetable.name = newName;
      holder.innerHTML = '';
      if (onComplete) onComplete();
      await renderTimetables(container);
    } catch (err) {
      showToast(err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Save New Name';
    }
  };

  saveBtn?.addEventListener('click', handleSave);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
  });
}

// ==============================================================================
// EXTEND VALIDITY MODAL
// ==============================================================================
function openExtendModal(container, timetableId, name, currentEnd, currentStart, currentDuration) {
  const holder = container.querySelector('#tt-modals-holder');

  let selectedMonths = 3;
  if (name && (name.includes('1 Year') || name.includes('12 Month'))) {
    selectedMonths = 12;
  } else if (name && (name.includes('6 Month') || name.includes('6 Months'))) {
    selectedMonths = 6;
  } else if (name && (name.includes('1 Month') || name.includes('1 Months'))) {
    selectedMonths = 1;
  } else if (currentDuration && currentDuration.includes('1 Year')) {
    selectedMonths = 12;
  } else if (currentDuration && currentDuration.includes('6 Month')) {
    selectedMonths = 6;
  } else if (currentDuration && currentDuration.includes('1 Month')) {
    selectedMonths = 1;
  } else if (currentEnd) {
    const s = new Date(currentStart || new Date());
    const e = new Date(currentEnd);
    const diffM = Math.round((e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
    if (diffM >= 11) selectedMonths = 12;
    else if (diffM >= 5) selectedMonths = 6;
    else if (diffM >= 2) selectedMonths = 3;
    else if (diffM >= 1) selectedMonths = 1;
  }

  let selectedMode = 'from_today'; // 'from_today' | 'add_months' | 'custom'
  let customDateValue = currentEnd || new Date().toISOString().split('T')[0];

  function calculateNewDate() {
    if (selectedMode === 'custom') {
      return customDateValue;
    }
    const base = selectedMode === 'from_today' ? new Date() : (currentEnd || new Date());
    return addMonthsSafe(base, selectedMonths);
  }

  function renderModalContent() {
    const newDate = calculateNewDate();

    holder.innerHTML = `
      <div class="modal-backdrop open">
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
              <span>⏳</span> Extend Timetable Validity
            </h3>
            <button class="btn btn-ghost btn-icon modal-close">✕</button>
          </div>

          <div class="modal-body">
            <div style="background: var(--bg-main); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; margin-bottom: 1.25rem;">
              <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Current Timetable</div>
              <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary); margin-top: 0.15rem;">${name}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Current Expiry: <strong>${formatDatePretty(currentEnd)}</strong>
              </div>
            </div>

            <!-- Mode Selector -->
            <div style="display: flex; gap: 0.4rem; margin-bottom: 1.25rem; background: var(--bg-main); padding: 0.35rem; border-radius: var(--radius-md); flex-wrap: wrap;">
              <button class="btn btn-sm ${selectedMode === 'from_today' ? 'btn-primary' : 'btn-ghost'} ext-mode-btn" data-mode="from_today" style="flex: 1; font-size: 0.82rem; min-width: 100px;">
                Set from Today
              </button>
              <button class="btn btn-sm ${selectedMode === 'add_months' ? 'btn-primary' : 'btn-ghost'} ext-mode-btn" data-mode="add_months" style="flex: 1; font-size: 0.82rem; min-width: 110px;">
                Add to Expiry
              </button>
              <button class="btn btn-sm ${selectedMode === 'custom' ? 'btn-primary' : 'btn-ghost'} ext-mode-btn" data-mode="custom" style="flex: 1; font-size: 0.82rem; min-width: 100px;">
                📅 Custom Date
              </button>
            </div>

            ${
              selectedMode === 'custom'
                ? `
              <div style="margin-bottom: 1.25rem; background: var(--bg-main); border-radius: var(--radius-md); padding: 1rem 1.25rem;">
                <label style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.4rem;">
                  Pick Custom Expiry Date:
                </label>
                <input type="date" id="ext-custom-date-input" class="form-input" value="${customDateValue}" style="width: 100%; font-size: 1rem; padding: 0.6rem 0.85rem;" />
              </div>
            `
                : `
              <h4 style="margin-bottom: 0.65rem; font-size: 0.95rem;">Choose Duration:</h4>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
                <button class="btn ${selectedMonths === 1 && selectedMode !== 'custom' ? 'btn-primary' : 'btn-outline'} ext-period-btn" data-months="1" style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.75rem;">
                  ${selectedMonths === 1 && selectedMode !== 'custom' ? '✓ ' : ''}1 Month
                </button>
                <button class="btn ${selectedMonths === 3 && selectedMode !== 'custom' ? 'btn-primary' : 'btn-outline'} ext-period-btn" data-months="3" style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.75rem;">
                  ${selectedMonths === 3 && selectedMode !== 'custom' ? '✓ ' : ''}3 Months
                </button>
                <button class="btn ${selectedMonths === 6 && selectedMode !== 'custom' ? 'btn-primary' : 'btn-outline'} ext-period-btn" data-months="6" style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.75rem;">
                  ${selectedMonths === 6 && selectedMode !== 'custom' ? '✓ ' : ''}6 Months
                </button>
                <button class="btn ${selectedMonths === 12 && selectedMode !== 'custom' ? 'btn-primary' : 'btn-outline'} ext-period-btn" data-months="12" style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.75rem;">
                  ${selectedMonths === 12 && selectedMode !== 'custom' ? '✓ ' : ''}1 Year
                </button>
              </div>
            `
            }

            <!-- New Expiry Preview Banner -->
            <div style="background: var(--bg-soft-purple); border-left: 4px solid var(--primary-purple); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; margin-bottom: 1.5rem;">
              <div style="font-size: 0.8rem; color: var(--primary-purple); font-weight: 700; text-transform: uppercase;">✨ New Expiry Date Preview</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;">
                ${formatDatePretty(newDate)}
              </div>
            </div>

            <div class="modal-footer" style="padding: 0; display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button class="btn btn-ghost modal-close">Cancel</button>
              <button class="btn btn-primary" id="btn-confirm-extend">
                ✓ Confirm & Save Expiry Date
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Listeners
    holder.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => (holder.innerHTML = ''));
    });

    holder.querySelectorAll('.ext-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedMode = btn.getAttribute('data-mode');
        renderModalContent();
      });
    });

    holder.querySelectorAll('.ext-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedMonths = parseInt(btn.getAttribute('data-months'), 10);
        if (selectedMode === 'custom') selectedMode = 'from_today';
        renderModalContent();
      });
    });

    const customDateInput = holder.querySelector('#ext-custom-date-input');
    if (customDateInput) {
      customDateInput.addEventListener('change', (e) => {
        customDateValue = e.target.value;
        renderModalContent();
      });
    }

    holder.querySelector('#btn-confirm-extend')?.addEventListener('click', async () => {
      const confirmBtn = holder.querySelector('#btn-confirm-extend');
      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Saving...';
        const payload =
          selectedMode === 'custom'
            ? { custom_end_date: customDateValue }
            : { extension_months: selectedMonths, mode: selectedMode };

        const res = await api.extendTimetable(timetableId, payload);
        showToast(res.message || 'Timetable validity updated!', 'success');
        holder.innerHTML = '';
        await renderTimetables(container);
      } catch (err) {
        showToast(err.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ Confirm & Save Expiry Date';
      }
    });
  }

  renderModalContent();
}

// ==============================================================================
// REPLACE ACTIVE TIMETABLE MODAL
// ==============================================================================
function openReplaceModal(container, timetableId, name) {
  const holder = container.querySelector('#tt-modals-holder');
  holder.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="margin: 0;">Replace Active Timetable</h3>
          <button class="btn btn-ghost btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="badge badge-warning" style="margin-bottom: 0.75rem;">Important Notice</div>
          <p style="margin-bottom: 1rem;">
            You currently have <strong>${name}</strong> active. Replacing it will:
          </p>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 1.5rem;">
            <li>✓ <strong>Preserve</strong> all past attendance and historical event records</li>
            <li>✓ <strong>Stop</strong> future old events and reminders</li>
            <li>✓ <strong>Activate</strong> your new timetable routine automatically</li>
          </ul>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-ghost modal-close">Cancel</button>
            <button id="btn-confirm-replace" class="btn btn-primary">
              Proceed to Add New Timetable ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  holder.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => (holder.innerHTML = ''));
  });

  holder.querySelector('#btn-confirm-replace').addEventListener('click', () => {
    holder.innerHTML = '';
    state.setView('add-schedule');
  });
}
