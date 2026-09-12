/**
 * Recurrence Engine for SmartTime AI
 * Generates calendar occurrences, calculates today's schedule timeline,
 * and determines the exact Next Class countdown.
 */

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Formats a Date object to "YYYY-MM-DD" in local timezone
 */
function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses "YYYY-MM-DD" into a local Date object at midnight
 */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Parses "HH:MM" into minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

/**
 * Formats minutes from midnight to "HH:MM" (24h)
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats "HH:MM" (24h) to "h:mm A" (e.g. "17:00" -> "5:00 PM")
 */
function format12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Returns formatted duration string (e.g., "1h 30m" or "45m")
 */
function formatDuration(durationMinutes) {
  const mins = parseInt(durationMinutes, 10) || 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Generates all calendar occurrences for a list of base events between startDate and endDate
 */
function generateOccurrences(events, startDateStr, endDateStr) {
  const occurrences = [];
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  end.setHours(23, 59, 59, 999);

  // Group events by day of week or specific date
  events.forEach((evt) => {
    if (evt.status === 'cancelled') return;

    if (evt.date) {
      // Specific one-off date event
      const eventDate = parseLocalDate(evt.date);
      if (eventDate >= start && eventDate <= end) {
        occurrences.push(createOccurrenceObject(evt, evt.date));
      }
    } else if (evt.day) {
      // Weekly repeating event on that day
      const targetDayIndex = DAYS_OF_WEEK.findIndex(
        (d) => d.toLowerCase() === evt.day.toLowerCase()
      );

      if (targetDayIndex !== -1) {
        const current = new Date(start.getTime());
        const eventStartLimit = evt.start_date ? parseLocalDate(evt.start_date) : null;
        const eventEndLimit = evt.end_date ? parseLocalDate(evt.end_date) : null;

        while (current <= end) {
          if (eventStartLimit && current < eventStartLimit) {
            current.setDate(current.getDate() + 1);
            continue;
          }
          if (eventEndLimit && current > eventEndLimit) {
            break;
          }
          if (current.getDay() === targetDayIndex) {
            const dateStr = formatLocalDate(current);
            occurrences.push(createOccurrenceObject(evt, dateStr));
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }
  });

  // Sort chronologically by date and start_time
  occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start_time.localeCompare(b.start_time);
  });

  return occurrences;
}

function createOccurrenceObject(event, dateStr) {
  const startMinutes = timeToMinutes(event.start_time);
  const endMinutes = event.end_time
    ? timeToMinutes(event.end_time)
    : startMinutes + (event.duration || 60);

  const endTimeStr = event.end_time || minutesToTime(endMinutes);

  return {
    id: `${event.id}_${dateStr}`,
    base_event_id: event.id,
    timetable_id: event.timetable_id,
    class_name: event.class_name,
    subject: event.subject || event.class_name,
    day: event.day || DAYS_OF_WEEK[parseLocalDate(dateStr).getDay()],
    date: dateStr,
    start_time: event.start_time,
    end_time: endTimeStr,
    start_time_formatted: format12h(event.start_time),
    end_time_formatted: format12h(endTimeStr),
    time_range_formatted: `${format12h(event.start_time)} – ${format12h(endTimeStr)}`,
    duration: event.duration || (endMinutes - startMinutes),
    teacher: event.teacher || null,
    room: event.room || null,
    location: event.location || null,
    notes: event.notes || null,
    status: event.status || 'active',
    confidence: event.confidence || 1.0
  };
}

/**
 * Gets today's events for a user with relative status (ongoing, upcoming, finished)
 */
function getTodaySchedule(events, activeTimetable, userNow = new Date()) {
  if (!activeTimetable || activeTimetable.status !== 'active') return [];

  const todayStr = formatLocalDate(userNow);
  const currentDayName = DAYS_OF_WEEK[userNow.getDay()];
  const currentMinutes = userNow.getHours() * 60 + userNow.getMinutes();

  // Check if timetable is active for today
  if (todayStr < activeTimetable.start_date || todayStr > activeTimetable.end_date) {
    return [];
  }

  const todayEvents = events.filter((evt) => {
    if (evt.timetable_id !== activeTimetable.id || evt.status === 'cancelled') return false;
    if (evt.date === todayStr) return true;
    return evt.day && evt.day.toLowerCase() === currentDayName.toLowerCase();
  });

  return todayEvents
    .map((evt) => {
      const startMin = timeToMinutes(evt.start_time);
      const endMin = evt.end_time ? timeToMinutes(evt.end_time) : startMin + (evt.duration || 60);

      let status = 'upcoming';
      if (currentMinutes >= endMin) {
        status = 'completed';
      } else if (currentMinutes >= startMin && currentMinutes < endMin) {
        status = 'ongoing';
      }

      return {
        ...createOccurrenceObject(evt, todayStr),
        timeline_status: status,
        starts_in_minutes: startMin - currentMinutes
      };
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * Finds the immediately next upcoming class and countdown
 */
function getNextClass(events, activeTimetable, userNow = new Date()) {
  if (!activeTimetable || activeTimetable.status !== 'active') return null;

  const todayStr = formatLocalDate(userNow);
  const occurrences = generateOccurrences(
    events.filter((e) => e.timetable_id === activeTimetable.id),
    todayStr,
    activeTimetable.end_date
  );

  const currentTimestamp = userNow.getTime();

  for (const occ of occurrences) {
    const [y, month, d] = occ.date.split('-').map(Number);
    const [h, m] = occ.start_time.split(':').map(Number);
    const classStart = new Date(y, month - 1, d, h, m, 0, 0);

    const diffMs = classStart.getTime() - currentTimestamp;
    if (diffMs > 0) {
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const days = Math.floor(hours / 24);

      let countdownText = '';
      if (days > 0) {
        countdownText = `Starts in ${days}d ${hours % 24}h`;
      } else if (hours > 0) {
        countdownText = `Starts in ${hours}h ${minutes}m`;
      } else {
        countdownText = `Starts in ${minutes}m`;
      }

      return {
        ...occ,
        target_timestamp: classStart.getTime(),
        countdown_text: countdownText,
        starts_in_minutes: totalMinutes
      };
    }
  }

  return null;
}

module.exports = {
  DAYS_OF_WEEK,
  formatLocalDate,
  parseLocalDate,
  timeToMinutes,
  minutesToTime,
  format12h,
  formatDuration,
  generateOccurrences,
  getTodaySchedule,
  getNextClass
};
