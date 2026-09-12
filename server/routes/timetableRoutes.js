const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { scheduleRemindersForTimetable } = require('../services/reminderEngine');
const { generateOccurrences } = require('../services/recurrenceEngine');

// Safe month addition avoiding 31st -> next month rollover bug
function addMonthsSafe(baseDateStrOrObj, months) {
  const d = new Date(baseDateStrOrObj);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return d.toISOString().split('T')[0];
}

// Helper to calculate human-readable duration
function computeDurationText(startDateStr, endDateStr, explicitMonths) {
  if (explicitMonths) {
    if (explicitMonths === 12) return '1 Year';
    if (explicitMonths === 1) return '1 Month';
    return `${explicitMonths} Months`;
  }
  if (!startDateStr || !endDateStr) return '3 Months';
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  const daysDiff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  
  if (daysDiff >= 350) return '1 Year';
  if (daysDiff >= 170 && daysDiff <= 190) return '6 Months';
  if (daysDiff >= 80 && daysDiff <= 100) return '3 Months';
  if (daysDiff >= 25 && daysDiff <= 35) return '1 Month';
  
  const mDiff = Math.round(daysDiff / 30.44);
  if (mDiff >= 12) {
    const yrs = Math.floor(mDiff / 12);
    const remMonths = mDiff % 12;
    return yrs === 1 && remMonths === 0 ? '1 Year' : remMonths === 0 ? `${yrs} Years` : `${yrs} Year ${remMonths} Months`;
  }
  if (mDiff > 0) {
    return mDiff === 1 ? '1 Month' : `${mDiff} Months`;
  }
  return `${daysDiff} Days`;
}

// GET /api/timetables
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const timetables = db.getTimetablesByUserId(userId);
    const events = db.getEventsByUserId(userId);

    const enriched = timetables.map((tt) => {
      const ttEvents = events.filter((e) => e.timetable_id === tt.id);
      const calculatedDuration = computeDurationText(tt.start_date, tt.end_date);
      let cleanName = tt.name;
      if (cleanName && /\(\d+\s*(?:Month|Months|Year|Years|Day|Days)\)/i.test(cleanName)) {
        cleanName = cleanName.replace(/\(\d+\s*(?:Month|Months|Year|Years|Day|Days)\)/i, `(${calculatedDuration})`);
      }
      return {
        ...tt,
        name: cleanName,
        duration: calculatedDuration,
        events_count: ttEvents.length,
        events: ttEvents
      };
    });

    res.json({ timetables: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timetables' });
  }
});

// POST /api/timetables (Create new timetable with 5-step flow data)
router.post('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      image_url,
      source_type,
      start_date,
      end_date,
      duration,
      events,
      reminder_1_minutes,
      reminder_2_minutes,
      replace_active
    } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'At least one class is required' });
    }

    const now = new Date();
    const startDateStr = start_date || now.toISOString().split('T')[0];

    // Calculate default end date based on duration if not explicitly passed
    let endDateStr = end_date;
    if (!endDateStr) {
      const d = new Date(startDateStr);
      let monthsToAdd = 3;
      if (duration === '1 Month') monthsToAdd = 1;
      else if (duration === '2 Months') monthsToAdd = 2;
      else if (duration === '3 Months') monthsToAdd = 3;
      else if (duration === '4 Months') monthsToAdd = 4;
      else if (duration === '6 Months') monthsToAdd = 6;
      else if (duration === '1 Year') monthsToAdd = 12;

      d.setMonth(d.getMonth() + monthsToAdd);
      endDateStr = d.toISOString().split('T')[0];
    }

    // If replace_active is true or active timetable exists, mark previous active timetables as 'replaced'
    const activeTimetable = db.getActiveTimetable(userId);
    if (activeTimetable) {
      activeTimetable.status = 'replaced';
      activeTimetable.updated_at = new Date().toISOString();
      db.clearFutureRemindersForTimetable(activeTimetable.id);
    }

    // Schedule reminders only if enabled by user
    const r1 = (reminder_1_minutes !== undefined && reminder_1_minutes !== null) ? Number(reminder_1_minutes) : 30;
    const r2 = (reminder_2_minutes !== undefined && reminder_2_minutes !== null) ? Number(reminder_2_minutes) : 5;

    // Create new timetable record with configured reminder preferences
    const timetable = db.createTimetable({
      user_id: userId,
      name: name || `My Timetable (${duration || '3 Months'})`,
      image_url: image_url || null,
      source_type: source_type || 'manual',
      start_date: startDateStr,
      end_date: endDateStr,
      duration: duration || '3 Months',
      reminder_1_minutes: r1,
      reminder_2_minutes: r2,
      status: 'active'
    });

    // Sync reminder preferences to user settings
    try {
      db.updateSettings(userId, { reminder_1_minutes: r1, reminder_2_minutes: r2 });
    } catch (_) {}

    // Create event records
    const createdEvents = [];
    events.forEach((evt) => {
      const created = db.createEvent({
        user_id: userId,
        timetable_id: timetable.id,
        class_name: evt.class_name || 'Class',
        subject: evt.subject || evt.class_name || 'Subject',
        day: evt.day || null,
        date: evt.date || null,
        start_time: evt.start_time || '09:00',
        end_time: evt.end_time || null,
        duration: evt.duration_minutes || evt.duration || 60,
        teacher: evt.teacher || null,
        room: evt.room || null,
        location: evt.location || null,
        notes: evt.notes || null,
        recurrence_rule: 'weekly',
        confidence: evt.confidence !== undefined ? evt.confidence : 1.0,
        status: 'active'
      });
      createdEvents.push(created);
    });

    let reminders = [];
    if (r1 > 0 || r2 > 0) {
      reminders = scheduleRemindersForTimetable(timetable.id, userId, r1, r2);
    }

    // Create initial success notification as read so it never triggers alarm pollers
    db.createNotification({
      user_id: userId,
      event_id: null,
      timetable_id: timetable.id,
      title: 'Timetable Activated! 🎉',
      message: `Your schedule "${timetable.name}" is now active with ${createdEvents.length} classes repeating until ${timetable.end_date}.`,
      type: 'system',
      read: true
    });

    res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
      timetable: {
        ...timetable,
        events: createdEvents,
        reminders_count: reminders.length
      }
    });
  } catch (err) {
    console.error('Timetable creation error:', err);
    res.status(500).json({ error: 'Failed to create timetable' });
  }
});

// POST /api/timetables/:id/extend
router.post('/:id/extend', authMiddleware, (req, res) => {
  try {
    const timetable = db.getTimetableById(req.params.id);
    if (!timetable || timetable.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    const { extension_months, custom_end_date, mode } = req.body;
    let newEndDate = custom_end_date;

    let appliedMonths = null;
    if (!newEndDate) {
      const months = parseInt(extension_months, 10) || 3;
      appliedMonths = months;
      if (mode === 'from_today') {
        newEndDate = addMonthsSafe(new Date(), months);
      } else {
        newEndDate = addMonthsSafe(timetable.end_date, months);
      }
    }

    const calculatedDuration = computeDurationText(timetable.start_date, newEndDate, appliedMonths);
    let newName = timetable.name;
    if (newName && /\(\d+\s*(?:Month|Months|Year|Years|Day|Days)\)/i.test(newName)) {
      newName = newName.replace(/\(\d+\s*(?:Month|Months|Year|Years|Day|Days)\)/i, `(${calculatedDuration})`);
    }
    db.updateTimetable(timetable.id, {
      end_date: newEndDate,
      duration: calculatedDuration,
      name: newName,
      status: 'active'
    });

    // Reschedule reminders up to the new end date
    const settings = db.getSettingsByUserId(req.user.id);
    const r1 = settings.reminder_1_minutes !== undefined ? settings.reminder_1_minutes : 30;
    const r2 = settings.reminder_2_minutes !== undefined ? settings.reminder_2_minutes : 5;
    scheduleRemindersForTimetable(timetable.id, req.user.id, r1, r2);

    db.createNotification({
      user_id: req.user.id,
      event_id: null,
      timetable_id: timetable.id,
      title: 'Timetable Validity Extended ⏳',
      message: `Your timetable "${timetable.name}" is now active until ${newEndDate}.`,
      type: 'update'
    });

    res.json({
      success: true,
      message: `Timetable validity updated until ${newEndDate}! ⏳`,
      timetable
    });
  } catch (err) {
    console.error('Timetable extend error:', err);
    res.status(500).json({ error: 'Failed to extend timetable: ' + err.message });
  }
});

// PUT /api/timetables/:id/rename
router.put('/:id/rename', authMiddleware, (req, res) => {
  try {
    const timetable = db.getTimetableById(req.params.id);
    if (!timetable || timetable.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Timetable not found' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Timetable name is required' });
    }
    const updated = db.updateTimetable(timetable.id, { name: name.trim() });
    res.json({ success: true, message: 'Timetable renamed successfully', timetable: updated || timetable });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename timetable: ' + err.message });
  }
});

// POST /api/timetables/:id/pause
router.post('/:id/pause', authMiddleware, (req, res) => {
  try {
    const timetable = db.getTimetableById(req.params.id);
    if (!timetable || timetable.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    const newStatus = timetable.status === 'active' ? 'paused' : 'active';
    timetable.status = newStatus;
    timetable.updated_at = new Date().toISOString();

    if (newStatus === 'paused') {
      db.clearFutureRemindersForTimetable(timetable.id);
    } else {
      // If resuming this timetable to active, pause any other active timetables for this user
      const userTimetables = db.getTimetablesByUserId(req.user.id);
      userTimetables.forEach((tt) => {
        if (tt.id !== timetable.id && tt.status === 'active') {
          tt.status = 'paused';
          tt.updated_at = new Date().toISOString();
          db.clearFutureRemindersForTimetable(tt.id);
        }
      });

      const settings = db.getSettingsByUserId(req.user.id);
      const r1 = settings.reminder_1_minutes !== undefined ? settings.reminder_1_minutes : 30;
      const r2 = settings.reminder_2_minutes !== undefined ? settings.reminder_2_minutes : 5;
      scheduleRemindersForTimetable(timetable.id, req.user.id, r1, r2);
    }

    db.save();
    res.json({
      success: true,
      message: newStatus === 'active' ? 'Timetable Resumed & Activated! ▶' : 'Timetable Paused ⏸',
      status: newStatus,
      timetable
    });
  } catch (err) {
    console.error('Pause/Resume toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle timetable state: ' + err.message });
  }
});

// DELETE /api/timetables/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const timetable = db.getTimetableById(req.params.id);
    if (!timetable || timetable.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    // Remove future reminders
    db.clearFutureRemindersForTimetable(timetable.id);

    // Delete timetable
    const idx = db.db.timetables.findIndex((t) => t.id === req.params.id);
    if (idx !== -1) {
      db.db.timetables.splice(idx, 1);
      // Soft-delete/remove linked events
      db.db.events = db.db.events.filter((e) => e.timetable_id !== req.params.id);
      db.save();
    }

    res.json({ success: true, message: 'Timetable deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete timetable' });
  }
});

module.exports = router;
