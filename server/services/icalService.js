/**
 * iCalendar (RFC 5545) & Google Calendar Integration Service for SmartTime AI
 * Generates standard .ics files, live calendar subscription feeds, and
 * direct Google Calendar 1-click web intent URLs.
 */

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
 * Format Date object into iCal UTC string "YYYYMMDDTHHMMSSZ"
 */
function toICalUtc(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Format Date object into iCal local string "YYYYMMDDTHHMMSS"
 */
function toICalLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Format Date object into Google Calendar web intent format "YYYYMMDDTHHmmss"
 */
function toGCalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    '00'
  );
}

/**
 * Clean & fold text according to RFC 5545 specifications
 */
function escapeICalText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Resolves Date objects for an event
 */
function resolveEventDates(event) {
  const now = new Date();
  let baseDate = null;

  if (event.date) {
    const [y, m, d] = event.date.split('-').map(Number);
    baseDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  } else if (event.day) {
    // Find next matching weekday from today
    const targetDayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(event.day);
    if (targetDayIndex !== -1) {
      baseDate = new Date(now);
      const currentDay = baseDate.getDay();
      let diff = targetDayIndex - currentDay;
      if (diff < 0) diff += 7;
      baseDate.setDate(baseDate.getDate() + diff);
      baseDate.setHours(0, 0, 0, 0);
    }
  }

  if (!baseDate) {
    baseDate = new Date(now);
  }

  const [sh, sm] = (event.start_time || '09:00').split(':').map(Number);
  const startObj = new Date(baseDate);
  startObj.setHours(sh || 0, sm || 0, 0, 0);

  let endObj = null;
  if (event.end_time) {
    const [eh, em] = event.end_time.split(':').map(Number);
    endObj = new Date(baseDate);
    endObj.setHours(eh || 0, em || 0, 0, 0);
  } else {
    const durMins = Number(event.duration) || 60;
    endObj = new Date(startObj.getTime() + durMins * 60 * 1000);
  }

  return { startObj, endObj };
}

/**
 * Generates an RFC 5545 compliant VCALENDAR string from a list of events
 */
function generateICalCalendar(events, options = {}) {
  const calendarName = escapeICalText(options.calendarName || 'SmartTime AI Schedule');
  const timezone = options.timezone || 'UTC';
  const nowUtc = toICalUtc(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartTime AI//Academic Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-TIMEZONE:${timezone}`
  ];

  events.forEach((evt) => {
    const { startObj, endObj } = resolveEventDates(evt);
    const uid = (evt.id || 'evt_' + Math.random().toString(36).substring(2)) + '@smarttime.ai';
    const summary = escapeICalText(evt.class_name || evt.subject || 'Class');
    
    let descriptionParts = [];
    if (evt.subject && evt.subject !== evt.class_name) descriptionParts.push(`Subject: ${evt.subject}`);
    if (evt.teacher) descriptionParts.push(`Instructor: ${evt.teacher}`);
    if (evt.room) descriptionParts.push(`Room: ${evt.room}`);
    if (evt.notes) descriptionParts.push(`Notes: ${evt.notes}`);
    descriptionParts.push('Organized by SmartTime AI');
    const description = escapeICalText(descriptionParts.join('\\n'));

    const location = escapeICalText(evt.location || evt.room || '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(`DTSTART:${toICalUtc(startObj)}`);
    lines.push(`DTEND:${toICalUtc(endObj)}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (location) lines.push(`LOCATION:${location}`);

    // If weekly recurring rule is specified and timetable has an end date
    if (evt.recurrence_rule === 'weekly' || (!evt.date && evt.day)) {
      const byDay = DAYS_MAP[evt.day] || 'MO';
      let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
      if (options.endDate) {
        const [ey, em, ed] = options.endDate.split('-').map(Number);
        const untilDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59));
        rrule += `;UNTIL=${toICalUtc(untilDate)}`;
      }
      lines.push(rrule);
    }

    // Add reminder alarms (VALARM)
    const remMins = Number(options.reminderMinutes) || 30;
    if (remMins > 0) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${remMins}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Reminder: ${summary} in ${remMins} minutes!`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Generates a direct 1-click Google Calendar Web Intent Link
 * Opens Google Calendar with pre-filled event details
 */
function generateGoogleCalendarWebLink(event, options = {}) {
  const { startObj, endObj } = resolveEventDates(event);
  const startStr = toGCalDateTime(startObj);
  const endStr = toGCalDateTime(endObj);

  const title = event.class_name || event.subject || 'Class';
  let detailsArr = [];
  if (event.teacher) detailsArr.push(`Instructor: ${event.teacher}`);
  if (event.room) detailsArr.push(`Room: ${event.room}`);
  if (event.notes) detailsArr.push(`Notes: ${event.notes}`);
  detailsArr.push('Organized with SmartTime AI');

  const location = event.location || event.room || '';

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(detailsArr.join('\n'))}`;

  if (location) {
    url += `&location=${encodeURIComponent(location)}`;
  }

  // If weekly recurring
  if (event.recurrence_rule === 'weekly' || (!event.date && event.day)) {
    const byDay = DAYS_MAP[event.day] || 'MO';
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
    if (options.endDate) {
      const [ey, em, ed] = options.endDate.split('-').map(Number);
      const untilDate = new Date(ey, em - 1, ed, 23, 59, 59);
      rrule += `;UNTIL=${toICalUtc(untilDate)}`;
    }
    url += `&recur=${encodeURIComponent(rrule)}`;
  }

  return url;
}

module.exports = {
  generateICalCalendar,
  generateGoogleCalendarWebLink,
  resolveEventDates
};
