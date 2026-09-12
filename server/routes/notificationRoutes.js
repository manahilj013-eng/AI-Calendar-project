const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { scheduleRemindersForTimetable } = require('../services/reminderEngine');

// GET /api/notifications
router.get('/', authMiddleware, (req, res) => {
  try {
    const notifications = db.getNotificationsByUserId(req.user.id);
    const unreadCount = notifications.filter((n) => !n.read).length;

    // Fetch scheduled upcoming alarms for user's active timetable
    const allReminders = db.getRemindersByUserId(req.user.id);
    const events = db.getEventsByUserId(req.user.id);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Current week boundary (Monday to Sunday)
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const activeTimetable = db.getActiveTimetable(req.user.id);
    const activeEvents = activeTimetable
      ? db.getEventsByTimetableId(activeTimetable.id)
      : db.getEventsByUserId(req.user.id);

    const settings = db.getSettingsByUserId(req.user.id);
    const remMinutes = (activeTimetable && activeTimetable.reminder_1_minutes !== undefined && activeTimetable.reminder_1_minutes > 0)
      ? Number(activeTimetable.reminder_1_minutes)
      : (settings && settings.reminder_1_minutes ? Number(settings.reminder_1_minutes) : 30);

    // Build distinct weekly alarms routine from active timetable events
    const weeklyAlarms = activeEvents.map((evt) => {
      // Calculate alert time (e.g., 30m before start_time)
      const [h, m] = (evt.start_time || '08:30').split(':').map(Number);
      const startMins = h * 60 + m;
      const alertMins = Math.max(0, startMins - remMinutes);
      const alertH = String(Math.floor(alertMins / 60)).padStart(2, '0');
      const alertM = String(alertMins % 60).padStart(2, '0');

      return {
        id: evt.id,
        class_name: evt.class_name,
        day: evt.day || 'Monday',
        start_time: evt.start_time || '08:30',
        end_time: evt.end_time || '10:00',
        room: evt.room || 'Room 1100',
        teacher: evt.teacher || '',
        alert_time: `${alertH}:${alertM}`,
        minutes_before: remMinutes,
        status: activeTimetable && activeTimetable.status === 'active' ? 'active' : 'paused'
      };
    });

    // Current time in minutes from midnight
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // Today's alarms: only show upcoming/active classes where end_time > current time
    const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysArr[now.getDay()];
    const todayAlarms = weeklyAlarms
      .filter((a) => {
        if (a.day.toLowerCase() !== currentDayName.toLowerCase()) return false;
        const [endH, endM] = (a.end_time || '10:00').split(':').map(Number);
        const endTotalMins = endH * 60 + endM;
        // Keep only if class has not ended yet today
        return endTotalMins >= currentMins;
      })
      .map((a) => {
        const [alertH, alertM] = a.alert_time.split(':').map(Number);
        const alertTotalMins = alertH * 60 + alertM;
        return {
          ...a,
          is_past_alert: alertTotalMins < currentMins
        };
      });

    // History filtering (Daily vs Weekly vs Monthly History) - Alarms only
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const isAlarmNotification = (n) => n.type === 'reminder' || (n.title && (n.title.includes('Alarm') || n.title.includes('⏰')));
    const alarmNotifications = notifications.filter(isAlarmNotification);

    const dailyHistory = alarmNotifications.filter((n) => n.created_at >= todayStart);
    const weeklyHistory = alarmNotifications.filter((n) => n.created_at >= sevenDaysAgo);
    const monthlyHistory = alarmNotifications.filter((n) => n.created_at >= thirtyDaysAgo);

    const scheduledAlarms = allReminders
      .filter((r) => r.status === 'pending')
      .map((r) => {
        const linkedEvent = events.find((e) => e.id === r.event_id);
        const schedDate = new Date(r.scheduled_time);
        const diffMins = Math.max(0, Math.round((schedDate - now) / 60000));

        return {
          id: r.id,
          class_name: linkedEvent ? linkedEvent.class_name : 'Scheduled Class',
          day: linkedEvent ? linkedEvent.day : null,
          start_time: linkedEvent ? linkedEvent.start_time : null,
          end_time: linkedEvent ? linkedEvent.end_time : null,
          room: linkedEvent ? linkedEvent.room : null,
          teacher: linkedEvent ? linkedEvent.teacher : null,
          occurrence_date: r.occurrence_date,
          scheduled_time: r.scheduled_time,
          minutes_before: r.reminder_minutes_before,
          diff_mins: diffMins,
          message: r.message,
          status: 'scheduled'
        };
      })
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    res.json({
      notifications,
      unread_count: unreadCount,
      scheduled_alarms: scheduledAlarms,
      today_alarms: todayAlarms,
      weekly_alarms: weeklyAlarms,
      daily_history: dailyHistory,
      weekly_history: weeklyHistory,
      monthly_history: monthlyHistory,
      history_alarms: alarmNotifications
    });
  } catch (err) {
    console.error('Notification fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications: ' + err.message });
  }
});

// POST /api/notifications/trigger-alarm
router.post('/trigger-alarm', authMiddleware, (req, res) => {
  try {
    const events = db.getEventsByUserId(req.user.id);
    const sampleEvent = events[0] || { class_name: 'Computer Vision', start_time: '08:30', room: 'Room 1100' };

    const notif = db.createNotification({
      user_id: req.user.id,
      event_id: sampleEvent.id || null,
      timetable_id: sampleEvent.timetable_id || null,
      title: `⏰ Class Alarm: ${sampleEvent.class_name}`,
      message: `Your ${sampleEvent.class_name} class is starting soon (${sampleEvent.start_time || '08:30 AM'}) in ${sampleEvent.room || 'Room 1100'}!`,
      type: 'reminder'
    });

    res.json({ success: true, notification: notif, message: 'Class alarm triggered with sound!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger alarm' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    const notif = db.markNotificationRead(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, (req, res) => {
  try {
    db.markAllNotificationsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/clear-history?timeframe=daily|weekly|monthly|all
router.delete('/clear-history', authMiddleware, (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'all';
    const deletedCount = db.clearAlarmHistory(req.user.id, timeframe);
    res.json({ success: true, message: `Cleared ${deletedCount} alarm records from history`, deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear alarm history: ' + err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const deleted = db.deleteNotification(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// GET /api/notifications/settings
router.get('/settings', authMiddleware, (req, res) => {
  try {
    const settings = db.getSettingsByUserId(req.user.id);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notification settings' });
  }
});

// PUT /api/notifications/settings
router.put('/settings', authMiddleware, (req, res) => {
  try {
    const updates = req.body;
    const settings = db.updateSettings(req.user.id, updates);

    // If reminder minute preferences changed, update active timetable reminders
    const activeTimetable = db.getActiveTimetable(req.user.id);
    if (activeTimetable) {
      scheduleRemindersForTimetable(
        activeTimetable.id,
        req.user.id,
        settings.reminder_1_minutes,
        settings.reminder_2_minutes
      );
    }

    res.json({ success: true, message: 'Settings saved successfully', settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/notifications/test-chime
router.post('/test-chime', authMiddleware, (req, res) => {
  try {
    const notif = db.createNotification({
      user_id: req.user.id,
      event_id: null,
      timetable_id: null,
      title: 'SmartTime Chime Test 🔔',
      message: 'This is a test notification. Your reminders and sound chimes are configured!',
      type: 'reminder'
    });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test chime' });
  }
});

module.exports = router;
