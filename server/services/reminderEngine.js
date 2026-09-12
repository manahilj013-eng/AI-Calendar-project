/**
 * Reminder & Notification Engine for SmartTime AI
 * Proactively generates reminders for upcoming class occurrences,
 * sends in-app notifications, and checks timetable validity expiry warnings.
 */

const db = require('../database/db');
const { generateOccurrences, format12h } = require('./recurrenceEngine');

/**
 * Builds reminder notifications for a newly created or updated timetable
 */
function scheduleRemindersForTimetable(timetableId, userId, reminder1Minutes = 30, reminder2Minutes = 5) {
  const timetable = db.getTimetableById(timetableId);
  if (!timetable || timetable.status !== 'active') return [];

  // Clear existing pending future reminders for this timetable to prevent duplicates
  db.clearFutureRemindersForTimetable(timetableId);

  const events = db.getEventsByTimetableId(timetableId);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Generate occurrences for next 30-day window or up to timetable end
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const effectiveEnd = timetable.end_date < windowEnd ? timetable.end_date : windowEnd;

  const occurrences = generateOccurrences(events, todayStr, effectiveEnd);
  const createdReminders = [];

  occurrences.forEach((occ) => {
    const [h, m] = occ.start_time.split(':').map(Number);
    const [year, month, day] = occ.date.split('-').map(Number);
    const classStartTime = new Date(year, month - 1, day, h, m, 0, 0);

    const roomStr = occ.room ? ` in Room ${occ.room}` : '';

    // Reminder 1
    if (reminder1Minutes && reminder1Minutes > 0) {
      const rem1Time = new Date(classStartTime.getTime() - reminder1Minutes * 60 * 1000);
      if (rem1Time > now) {
        const msg = reminder1Minutes >= 60
          ? `Your ${occ.class_name} class starts in ${reminder1Minutes / 60} hour${roomStr}.`
          : `Your ${occ.class_name} class starts in ${reminder1Minutes} minutes${roomStr}.`;

        const rem = db.createReminder({
          user_id: userId,
          event_id: occ.base_event_id,
          timetable_id: timetableId,
          occurrence_date: occ.date,
          class_name: occ.class_name,
          room: occ.room || '',
          teacher: occ.teacher || '',
          reminder_minutes_before: reminder1Minutes,
          scheduled_time: rem1Time.toISOString(),
          message: msg,
          notification_type: 'browser',
          status: 'pending'
        });
        createdReminders.push(rem);
      }
    }

    // Reminder 2
    if (reminder2Minutes && reminder2Minutes > 0 && reminder2Minutes !== reminder1Minutes) {
      const rem2Time = new Date(classStartTime.getTime() - reminder2Minutes * 60 * 1000);
      if (rem2Time > now) {
        const msg = `Reminder: Your ${occ.class_name} class starts in ${reminder2Minutes} minutes${roomStr}.`;

        const rem = db.createReminder({
          user_id: userId,
          event_id: occ.base_event_id,
          timetable_id: timetableId,
          occurrence_date: occ.date,
          class_name: occ.class_name,
          room: occ.room || '',
          teacher: occ.teacher || '',
          reminder_minutes_before: reminder2Minutes,
          scheduled_time: rem2Time.toISOString(),
          message: msg,
          notification_type: 'browser',
          status: 'pending'
        });
        createdReminders.push(rem);
      }
    }
  });

  return createdReminders;
}

/**
 * Background tick evaluator:
 * 1. Delivers pending reminders whose scheduled_time <= now (ONLY for active timetables)
 * 2. Checks active timetables nearing expiry and posts expiry warnings
 * 3. Marks expired timetables as 'expired'
 */
function processDueRemindersAndExpiry() {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.split('T')[0];

  // 1. Process Due Reminders for active timetables only
  const pending = db.db.reminders.filter((r) => r.status === 'pending' && r.scheduled_time <= nowIso);

  pending.forEach((rem) => {
    // Only deliver reminders if parent timetable is currently active
    const tt = db.getTimetableById(rem.timetable_id);
    if (!tt || tt.status !== 'active') {
      rem.status = 'cancelled';
      return;
    }

    rem.status = 'sent';
    rem.sent_at = nowIso;

    // Create In-App Notification of type 'reminder'
    db.createNotification({
      user_id: rem.user_id,
      event_id: rem.event_id,
      timetable_id: rem.timetable_id,
      title: `Class Reminder 🔔: ${rem.class_name || 'Upcoming Lecture'}`,
      message: rem.message,
      type: 'reminder'
    });
  });

  if (pending.length > 0) {
    db.save();
  }

  // 2. Check Timetable Expiry Warnings and Expirations
  db.db.timetables.forEach((tt) => {
    if (tt.status !== 'active') return;

    const userSettings = db.getSettingsByUserId(tt.user_id);
    const warningDays = userSettings ? userSettings.expiry_warning_days || 7 : 7;

    const expiryDate = new Date(tt.end_date);
    expiryDate.setHours(23, 59, 59, 999);

    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Expiry reached
    if (diffDays < 0) {
      tt.status = 'expired';
      tt.updated_at = nowIso;

      // Cancel remaining future reminders
      db.clearFutureRemindersForTimetable(tt.id);

      db.createNotification({
        user_id: tt.user_id,
        event_id: null,
        timetable_id: tt.id,
        title: 'Timetable Expired ⚠️',
        message: `Your timetable "${tt.name}" has expired. Extend your timetable or upload a new one to continue.`,
        type: 'expiry_warning'
      });
      db.save();
    }
    // Expiry warning trigger
    else if (diffDays <= warningDays) {
      // Check if we already warned today
      const alreadyWarned = db.db.notifications.some(
        (n) =>
          n.user_id === tt.user_id &&
          n.timetable_id === tt.id &&
          n.type === 'expiry_warning' &&
          n.created_at.startsWith(todayStr)
      );

      if (!alreadyWarned) {
        db.createNotification({
          user_id: tt.user_id,
          event_id: null,
          timetable_id: tt.id,
          title: 'Timetable Expiring Soon ⏳',
          message: `Your timetable "${tt.name}" will expire in ${diffDays} day${diffDays === 1 ? '' : 's'} (on ${tt.end_date}).`,
          type: 'expiry_warning'
        });
        db.save();
      }
    }
  });
}

// Start background cron ticker (runs every 30 seconds)
let tickerInterval = null;
function startReminderTicker() {
  if (!tickerInterval) {
    tickerInterval = setInterval(processDueRemindersAndExpiry, 30000);
    // Initial run
    processDueRemindersAndExpiry();
  }
}

module.exports = {
  scheduleRemindersForTimetable,
  processDueRemindersAndExpiry,
  startReminderTicker
};
