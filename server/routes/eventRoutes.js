const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { generateOccurrences } = require('../services/recurrenceEngine');
const { scheduleRemindersForTimetable } = require('../services/reminderEngine');

// GET /api/events?start_date=2026-08-30&end_date=2026-09-06
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    const now = new Date();
    const startDate = start_date || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const allEvents = db.getEventsByUserId(userId);
    const activeTimetable = db.getActiveTimetable(userId);

    // Generate recurring occurrences
    const occurrences = generateOccurrences(allEvents, startDate, endDate);

    res.json({
      start_date: startDate,
      end_date: endDate,
      total_occurrences: occurrences.length,
      events: occurrences
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// POST /api/events (Add single event or recurring / multi-week / multi-day schedule from Calendar)
router.post('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const activeTimetable = db.getActiveTimetable(userId);

    const {
      class_name,
      subject,
      day,
      date,
      end_date,
      start_time,
      end_time,
      duration_minutes,
      teacher,
      room,
      location,
      notes,
      is_all_day,
      reminder_minutes,
      repeat_type,
      weeks_count,
      has_alarm,
      days_mode,
      selected_days
    } = req.body;

    if (!class_name || (!start_time && !is_all_day) || (!day && !date)) {
      return res.status(400).json({ error: 'Title/Description, and date or day are required' });
    }

    const effectiveStartTime = is_all_day ? '09:00' : (start_time || '09:00');
    const effectiveEndTime = is_all_day ? '18:00' : (end_time || null);
    const effectiveNotes = is_all_day ? (notes ? `[All-Day] ${notes.trim()}` : '[All-Day Event]') : (notes ? notes.trim() : null);

    const timetableId = activeTimetable ? activeTimetable.id : 'custom_events';
    const createdEvents = [];
    const DAYS_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Resolve which days are active based on days_mode or selected_days
    let activeDaysList = [];
    if (days_mode === 'once') {
      const baseD = date ? parseLocalDate(date) : new Date();
      activeDaysList = [DAYS_NAME[baseD.getDay()]];
    } else if (days_mode === 'everyday') {
      activeDaysList = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    } else if (days_mode === 'weekdays') {
      activeDaysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    } else if (days_mode === 'shift') {
      activeDaysList = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    } else if (Array.isArray(selected_days) && selected_days.length > 0) {
      activeDaysList = selected_days;
    } else {
      const baseD = date ? parseLocalDate(date) : new Date();
      activeDaysList = [day || DAYS_NAME[baseD.getDay()]];
    }

    if (repeat_type === 'daily_range' && date && end_date && end_date >= date) {
      const cur = parseLocalDate(date);
      const stop = parseLocalDate(end_date);
      const maxDays = 60;
      let count = 0;

      while (cur <= stop && count < maxDays) {
        const dStr = formatLocalDate(cur);
        const dayName = DAYS_NAME[cur.getDay()];
        const evt = db.createEvent({
          user_id: userId,
          timetable_id: timetableId,
          class_name: class_name.trim(),
          subject: subject ? subject.trim() : class_name.trim(),
          day: dayName,
          date: dStr,
          start_time: effectiveStartTime,
          end_time: effectiveEndTime,
          duration: duration_minutes || (is_all_day ? 540 : 60),
          teacher: teacher ? teacher.trim() : null,
          room: room ? room.trim() : null,
          location: location ? location.trim() : null,
          notes: effectiveNotes,
          recurrence_rule: 'none',
          status: 'active',
          confidence: 1.0
        });
        createdEvents.push(evt);
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    } else if (repeat_type === 'weekly') {
      // Permanent weekly repeating event for each active day
      activeDaysList.forEach((dName) => {
        const newEvent = db.createEvent({
          user_id: userId,
          timetable_id: timetableId,
          class_name: class_name.trim(),
          subject: subject ? subject.trim() : class_name.trim(),
          day: dName,
          date: null,
          start_time: effectiveStartTime,
          end_time: effectiveEndTime,
          duration: duration_minutes || (is_all_day ? 540 : 60),
          teacher: teacher ? teacher.trim() : null,
          room: room ? room.trim() : null,
          location: location ? location.trim() : null,
          notes: effectiveNotes,
          recurrence_rule: 'weekly',
          status: 'active',
          confidence: 1.0
        });
        createdEvents.push(newEvent);
      });
    } else if (days_mode === 'once') {
      // Exactly 1 occurrence on the chosen date
      const baseDate = parseLocalDate(date);
      const dStr = formatLocalDate(baseDate);
      const dayCalc = DAYS_NAME[baseDate.getDay()];
      const newEvent = db.createEvent({
        user_id: userId,
        timetable_id: timetableId,
        class_name: class_name.trim(),
        subject: subject ? subject.trim() : class_name.trim(),
        day: dayCalc,
        date: dStr,
        start_time: effectiveStartTime,
        end_time: effectiveEndTime,
        duration: duration_minutes || (is_all_day ? 540 : 60),
        teacher: teacher ? teacher.trim() : null,
        room: room ? room.trim() : null,
        location: location ? location.trim() : null,
        notes: effectiveNotes,
        recurrence_rule: 'none',
        status: 'active',
        confidence: 1.0
      });
      createdEvents.push(newEvent);
    } else {
      // Reserved for N weeks across activeDaysList
      const numWeeks = Math.max(1, parseInt(weeks_count, 10) || 1);
      const baseDate = parseLocalDate(date);
      const targetTotal = activeDaysList.length * numWeeks;
      const seriesId = targetTotal > 1 ? `series_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` : null;

      let cur = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      let occurrences = [];
      let safetyCount = 0;

      while (occurrences.length < targetTotal && safetyCount < 365) {
        const curDayName = DAYS_NAME[cur.getDay()];
        if (activeDaysList.includes(curDayName)) {
          occurrences.push({
            dateStr: formatLocalDate(cur),
            dayName: curDayName
          });
        }
        cur.setDate(cur.getDate() + 1);
        safetyCount++;
      }

      occurrences.forEach((occ, idx) => {
        const weekNum = Math.floor(idx / activeDaysList.length) + 1;
        const newEvent = db.createEvent({
          user_id: userId,
          timetable_id: timetableId,
          class_name: class_name.trim(),
          subject: subject ? subject.trim() : class_name.trim(),
          day: occ.dayName,
          date: occ.dateStr,
          start_time: effectiveStartTime,
          end_time: effectiveEndTime,
          duration: duration_minutes || (is_all_day ? 540 : 60),
          teacher: teacher ? teacher.trim() : null,
          room: room ? room.trim() : null,
          location: location ? location.trim() : null,
          notes: effectiveNotes,
          recurrence_rule: 'none',
          status: 'active',
          confidence: 1.0,
          metadata: seriesId ? {
            series_id: seriesId,
            week_number: weekNum,
            total_weeks: numWeeks,
            session_index: idx + 1,
            total_sessions: targetTotal
          } : null
        });
        createdEvents.push(newEvent);
      });
    }

    // Schedule Reminders / Alarms
    const remMins = Number(reminder_minutes) >= 0 ? Number(reminder_minutes) : 30;
    const shouldSetAlarm = has_alarm !== false && has_alarm !== 'false';

    if (shouldSetAlarm && remMins >= 0) {
      createdEvents.forEach((evt) => {
        const occDate = evt.date || new Date().toISOString().split('T')[0];
        const [h, m] = (evt.start_time || '09:00').split(':').map(Number);
        const [year, month, dayN] = occDate.split('-').map(Number);
        const startTimeObj = new Date(year, month - 1, dayN, h, m, 0, 0);
        const remTime = new Date(startTimeObj.getTime() - remMins * 60 * 1000);

        if (remTime > new Date()) {
          db.createReminder({
            user_id: userId,
            event_id: evt.id,
            timetable_id: timetableId,
            occurrence_date: occDate,
            class_name: evt.class_name,
            room: evt.room || '',
            teacher: evt.teacher || '',
            reminder_minutes_before: remMins,
            scheduled_time: remTime.toISOString(),
            message: `⏰ Reminder: ${evt.class_name} scheduled for ${occDate} at ${evt.start_time}!`,
            notification_type: 'browser',
            status: 'pending'
          });
        }
      });
    }

    if (activeTimetable) {
      const settings = db.getSettingsByUserId(userId);
      scheduleRemindersForTimetable(
        activeTimetable.id,
        userId,
        settings.reminder_1_minutes,
        settings.reminder_2_minutes
      );
    }

    res.status(201).json({
      success: true,
      message: `Schedule and alarm saved successfully (${createdEvents.length} entry/entries)`,
      event: createdEvents[0],
      events: createdEvents,
      total_created: createdEvents.length
    });
  } catch (err) {
    console.error('Add event error:', err);
    res.status(500).json({ error: 'Failed to add schedule: ' + err.message });
  }
});

// PUT /api/events/:id (Edit / Reschedule event)
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const evt = db.getEventById(req.params.id);
    if (!evt || evt.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const {
      class_name,
      subject,
      day,
      date,
      start_time,
      end_time,
      duration_minutes,
      teacher,
      room,
      location,
      notes
    } = req.body;

    const updates = {};
    if (class_name !== undefined) updates.class_name = class_name.trim();
    if (subject !== undefined) updates.subject = subject.trim();
    if (day !== undefined) updates.day = day;
    if (date !== undefined) updates.date = date;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (duration_minutes !== undefined) updates.duration = duration_minutes;
    if (teacher !== undefined) updates.teacher = teacher ? teacher.trim() : null;
    if (room !== undefined) updates.room = room ? room.trim() : null;
    if (location !== undefined) updates.location = location ? location.trim() : null;
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;

    const updated = db.updateEvent(req.params.id, updates);

    // Reschedule reminders for linked timetable
    if (updated.timetable_id) {
      const settings = db.getSettingsByUserId(req.user.id);
      scheduleRemindersForTimetable(
        updated.timetable_id,
        req.user.id,
        settings.reminder_1_minutes,
        settings.reminder_2_minutes
      );
    }

    res.json({ success: true, message: 'Class updated and reminders rescheduled', event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const evt = db.getEventById(req.params.id);
    if (!evt || evt.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (req.query.delete_series === 'true' && evt.metadata && evt.metadata.series_id) {
      const allUserEvents = db.getEventsByUserId(req.user.id);
      const seriesEvents = allUserEvents.filter(
        (e) => e.metadata && e.metadata.series_id === evt.metadata.series_id
      );
      let count = 0;
      seriesEvents.forEach((e) => {
        db.deleteEvent(e.id);
        count++;
      });
      return res.json({
        success: true,
        message: `All ${count} weekly sessions in this reservation deleted`,
        count
      });
    }

    const deleted = db.deleteEvent(req.params.id);
    res.json({ success: true, message: 'Class deleted and reminders cancelled', event: deleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;
