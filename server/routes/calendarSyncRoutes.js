const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { generateICalCalendar, generateGoogleCalendarWebLink } = require('../services/icalService');
const {
  isGoogleConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  syncAllEventsToGoogle
} = require('../services/googleCalendarService');

/**
 * 1. Download full schedule as .ics file
 * GET /api/calendar/export/ics
 */
router.get('/export/ics', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const activeTimetable = db.getActiveTimetable(userId);
    const events = activeTimetable
      ? db.getEventsByTimetableId(activeTimetable.id)
      : db.getEventsByUserId(userId);

    const settings = db.getSettingsByUserId(userId);
    const icsContent = generateICalCalendar(events, {
      calendarName: activeTimetable ? activeTimetable.name : 'SmartTime AI Schedule',
      timezone: req.user.timezone || 'UTC',
      reminderMinutes: settings.reminder_1_minutes || 30,
      endDate: activeTimetable?.end_date
    });

    const safeFilename = (activeTimetable ? activeTimetable.name.replace(/[^a-z0-9_-]/gi, '_') : 'smarttime_schedule') + '.ics';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(icsContent);
  } catch (err) {
    console.error('ICS export error:', err);
    res.status(500).json({ error: 'Failed to generate calendar file: ' + err.message });
  }
});

/**
 * 2. Live Calendar Subscription Feed (for Google Calendar & Apple Calendar Webcal sync)
 * GET /api/calendar/feed/:userIdOrToken.ics
 */
router.get('/feed/:userIdOrToken', (req, res) => {
  try {
    const param = req.params.userIdOrToken.replace(/\.ics$/i, '');
    let user = db.findUserById(param);

    if (!user) {
      // Check if param matches a user whose id starts or matches
      user = db.db.users.find((u) => u.id === param || u.id.replace('usr_', '') === param);
    }

    if (!user) {
      return res.status(404).send('Calendar feed not found or expired token.');
    }

    const activeTimetable = db.getActiveTimetable(user.id);
    const events = activeTimetable
      ? db.getEventsByTimetableId(activeTimetable.id)
      : db.getEventsByUserId(user.id);

    const settings = db.getSettingsByUserId(user.id);
    const icsContent = generateICalCalendar(events, {
      calendarName: activeTimetable ? activeTimetable.name : `${user.name}'s Schedule`,
      timezone: user.timezone || 'UTC',
      reminderMinutes: settings?.reminder_1_minutes || 30,
      endDate: activeTimetable?.end_date
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Disposition', `inline; filename="smarttime_feed.ics"`);
    res.send(icsContent);
  } catch (err) {
    console.error('Calendar feed error:', err);
    res.status(500).send('Error generating calendar subscription feed');
  }
});

/**
 * 3. Get 1-click Google Calendar Web link for a single event
 * GET /api/calendar/google-link/:eventId
 */
router.get('/google-link/:eventId', authMiddleware, (req, res) => {
  try {
    const event = db.getEventById(req.params.eventId);
    if (!event || event.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const activeTimetable = db.getActiveTimetable(req.user.id);
    const link = generateGoogleCalendarWebLink(event, {
      endDate: activeTimetable?.end_date
    });

    res.json({ success: true, url: link });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Google Calendar link' });
  }
});

/**
 * 4. Google OAuth status
 * GET /api/integrations/google/status
 */
router.get('/google/status', authMiddleware, async (req, res) => {
  try {
    const settings = db.getSettingsByUserId(req.user.id);
    const token = await getValidAccessToken(req.user.id);

    res.json({
      configured: isGoogleConfigured(),
      connected: Boolean(token),
      email: settings.google_user_email || null,
      feed_url: `${req.protocol}://${req.get('host')}/api/calendar/feed/${req.user.id}.ics`,
      webcal_url: `webcal://${req.get('host')}/api/calendar/feed/${req.user.id}.ics`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Google integration status' });
  }
});

/**
 * 5. Get Google OAuth URL
 * GET /api/integrations/google/auth-url
 */
router.get('/google/auth-url', authMiddleware, (req, res) => {
  try {
    if (!isGoogleConfigured()) {
      return res.status(400).json({
        error: 'Google Calendar API credentials are not yet configured in .env (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET). You can still use the 1-click iCal / Webcal sync!'
      });
    }

    const url = getGoogleAuthUrl(req.user.id);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. Google OAuth Redirect Callback
 * GET /api/integrations/google/callback
 */
router.get('/google/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;

  if (error || !code) {
    return res.redirect(`/#settings?google_status=error&msg=${encodeURIComponent(error || 'Authorization was cancelled')}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (userId) {
      const expiryDate = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
      db.updateSettings(userId, {
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: expiryDate,
        google_user_email: tokens.email || null,
        google_sync_enabled: true
      });

      db.createNotification({
        user_id: userId,
        title: 'Google Calendar Connected! 🔗',
        message: `Your Google Account (${tokens.email || 'connected'}) is now linked for calendar synchronization.`,
        type: 'system',
        read: false
      });
    }

    res.redirect('/#settings?google_status=connected');
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`/#settings?google_status=error&msg=${encodeURIComponent(err.message)}`);
  }
});

/**
 * 7. Sync all events to Google Calendar
 * POST /api/integrations/google/sync-all
 */
router.post('/google/sync-all', authMiddleware, async (req, res) => {
  try {
    const result = await syncAllEventsToGoogle(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Google sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. Disconnect Google Calendar
 * POST /api/integrations/google/disconnect
 */
router.post('/google/disconnect', authMiddleware, (req, res) => {
  try {
    db.updateSettings(req.user.id, {
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_user_email: null,
      google_sync_enabled: false
    });

    res.json({ success: true, message: 'Google Calendar disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

module.exports = router;
