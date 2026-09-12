const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { getTodaySchedule, getNextClass } = require('../services/recurrenceEngine');

// GET /api/dashboard
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const activeTimetable = db.getActiveTimetable(userId);
    const allUserEvents = db.getEventsByUserId(userId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Next Class & Countdown
    const nextClass = activeTimetable
      ? getNextClass(allUserEvents, activeTimetable, now)
      : null;

    // 2. Today's Schedule Timeline
    const todaySchedule = activeTimetable
      ? getTodaySchedule(allUserEvents, activeTimetable, now)
      : [];

    // 3. Timetable Expiry & Status
    let timetableStatus = {
      has_active: false,
      status: 'none',
      name: null,
      start_date: null,
      end_date: null,
      days_remaining: null,
      validity_label: 'No active timetable'
    };

    if (activeTimetable) {
      const expiryDate = new Date(activeTimetable.end_date);
      expiryDate.setHours(23, 59, 59, 999);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let statusType = 'active';
      if (diffDays < 0) {
        statusType = 'expired';
      } else if (diffDays <= 7) {
        statusType = 'expiring_soon';
      }

      timetableStatus = {
        has_active: true,
        id: activeTimetable.id,
        status: statusType,
        name: activeTimetable.name,
        start_date: activeTimetable.start_date,
        end_date: activeTimetable.end_date,
        duration: activeTimetable.duration,
        days_remaining: Math.max(0, diffDays),
        validity_label: diffDays >= 0 ? `${diffDays} days remaining` : 'Expired'
      };
    }

    // 4. Unread Notifications Count
    const unreadNotifications = db.db.notifications.filter(
      (n) => n.user_id === userId && !n.read
    ).length;

    // 5. Total classes count
    const totalClassesCount = activeTimetable
      ? allUserEvents.filter((e) => e.timetable_id === activeTimetable.id && e.status === 'active').length
      : 0;

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        timezone: req.user.timezone
      },
      current_date: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      next_class: nextClass,
      today_schedule: todaySchedule,
      timetable_status: timetableStatus,
      total_classes_count: totalClassesCount,
      unread_notifications_count: unreadNotifications
    });
  } catch (err) {
    console.error('Dashboard aggregation error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

module.exports = router;
