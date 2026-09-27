/**
 * Google Calendar API v3 Integration Service
 * Manages OAuth2 tokens and direct REST synchronization to Google Calendar.
 */

const db = require('../database/db');
const { resolveEventDates } = require('./icalService');

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

const DAYS_MAP = {
  Sunday: 'SU',
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA'
};

/**
 * Check if Google OAuth credentials are configured in .env
 */
function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Build Google OAuth2 authorization URL
 */
function getGoogleAuthUrl(stateParam = '') {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google/callback';

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in .env');
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: stateParam
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange OAuth2 code for tokens
 */
async function exchangeCodeForTokens(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google/callback';

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed: ${errorBody}`);
  }

  const tokenData = await response.json();

  // Also get user email for display
  let userEmail = null;
  if (tokenData.access_token) {
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (userRes.ok) {
        const u = await userRes.json();
        userEmail = u.email;
      }
    } catch (_) {}
  }

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    email: userEmail
  };
}

/**
 * Refreshes an expired access token using refresh_token
 */
async function refreshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token refresh failed: ${errorBody}`);
  }

  return response.json();
}

/**
 * Gets a valid access token for a user, auto-refreshing if needed
 */
async function getValidAccessToken(userId) {
  const settings = db.getSettingsByUserId(userId);
  if (!settings || !settings.google_access_token) {
    return null;
  }

  const now = Date.now();
  const expiry = settings.google_token_expiry ? new Date(settings.google_token_expiry).getTime() : 0;

  // If token is still valid (with 5 min safety buffer), return it
  if (expiry > now + 5 * 60 * 1000) {
    return settings.google_access_token;
  }

  // Refresh if refresh_token is available
  if (settings.google_refresh_token) {
    try {
      const refreshed = await refreshAccessToken(settings.google_refresh_token);
      const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();

      db.updateSettings(userId, {
        google_access_token: refreshed.access_token,
        google_token_expiry: newExpiry
      });

      return refreshed.access_token;
    } catch (err) {
      console.error('Failed to refresh Google token for user:', userId, err.message);
      return null;
    }
  }

  return null;
}

/**
 * Push a single event to Google Calendar
 */
async function pushEventToGoogleCalendar(accessToken, event, options = {}) {
  const { startObj, endObj } = resolveEventDates(event);

  const timeZone = options.timeZone || 'UTC';
  const title = event.class_name || event.subject || 'Class';
  
  let descParts = [];
  if (event.subject && event.subject !== event.class_name) descParts.push(`Subject: ${event.subject}`);
  if (event.teacher) descParts.push(`Instructor: ${event.teacher}`);
  if (event.room) descParts.push(`Room: ${event.room}`);
  if (event.notes) descParts.push(`Notes: ${event.notes}`);
  descParts.push('Organized by SmartTime AI');

  const gEvent = {
    summary: title,
    description: descParts.join('\n'),
    location: event.location || event.room || '',
    start: {
      dateTime: startObj.toISOString(),
      timeZone
    },
    end: {
      dateTime: endObj.toISOString(),
      timeZone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: options.reminderMinutes || 30 },
        { method: 'popup', minutes: 5 }
      ]
    }
  };

  // Add recurrence rule for weekly classes
  if (event.recurrence_rule === 'weekly' || (!event.date && event.day)) {
    const byDay = DAYS_MAP[event.day] || 'MO';
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
    if (options.endDate) {
      const [ey, em, ed] = options.endDate.split('-').map(Number);
      const untilDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59));
      const pad = (n) => String(n).padStart(2, '0');
      const untilStr = untilDate.getUTCFullYear() + pad(untilDate.getUTCMonth() + 1) + pad(untilDate.getUTCDate()) + 'T235959Z';
      rrule += `;UNTIL=${untilStr}`;
    }
    gEvent.recurrence = [rrule];
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(gEvent)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API Error: ${errText}`);
  }

  return response.json();
}

/**
 * Synchronize all events for a user to their Google Calendar
 */
async function syncAllEventsToGoogle(userId) {
  const token = await getValidAccessToken(userId);
  if (!token) {
    throw new Error('Google Calendar is not connected. Please connect your Google account first.');
  }

  const activeTimetable = db.getActiveTimetable(userId);
  const events = activeTimetable
    ? db.getEventsByTimetableId(activeTimetable.id)
    : db.getEventsByUserId(userId);

  if (events.length === 0) {
    return { success: true, count: 0, message: 'No events found to sync' };
  }

  const settings = db.getSettingsByUserId(userId);
  const user = db.findUserById(userId);
  const timeZone = user?.timezone || 'UTC';
  const reminderMins = settings.reminder_1_minutes || 30;
  const endDate = activeTimetable?.end_date || null;

  let successCount = 0;
  const errors = [];

  for (const evt of events) {
    try {
      await pushEventToGoogleCalendar(token, evt, {
        timeZone,
        reminderMinutes: reminderMins,
        endDate
      });
      successCount++;
    } catch (err) {
      console.warn(`Failed to push event "${evt.class_name}" to Google Calendar:`, err.message);
      errors.push({ event: evt.class_name, error: err.message });
    }
  }

  db.createNotification({
    user_id: userId,
    title: 'Google Calendar Synced! 📅',
    message: `Successfully synchronized ${successCount} classes into your Google Calendar.`,
    type: 'system',
    read: false
  });

  return {
    success: true,
    total: events.length,
    synced: successCount,
    failed: errors.length,
    errors
  };
}

module.exports = {
  isGoogleConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  pushEventToGoogleCalendar,
  syncAllEventsToGoogle
};
