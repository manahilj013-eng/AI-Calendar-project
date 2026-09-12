/**
 * CSV Utilities for SmartTime AI
 * Handles timetable-to-CSV generation, automatic browser downloads, and CSV parsing.
 */

import { formatTime12h, DAYS_LIST } from './dateUtils.js';

/**
 * Escapes a value according to RFC-4180 CSV standards
 */
export function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a list of schedule event objects into a standard CSV string
 * @param {Array} events 
 * @param {string} title 
 * @returns {string}
 */
export function eventsToCSV(events = [], title = 'Timetable Schedule') {
  const headers = [
    'Day',
    'Subject',
    'Course Code',
    'Start Time',
    'End Time',
    'Duration (Minutes)',
    'Room',
    'Teacher',
    'Credits'
  ];

  const rows = [headers.join(',')];

  // Sort events by Day and Start Time
  const sorted = [...events].sort((a, b) => {
    const dayOrder = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };
    const dayA = dayOrder[a.day] || 99;
    const dayB = dayOrder[b.day] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  sorted.forEach((evt) => {
    const day = evt.day || 'Monday';
    const subject = evt.subject || evt.class_name || 'Class';
    const code = evt.course_code || evt.code || '';
    const startTime = evt.start_time ? formatTime12h(evt.start_time) : '';
    const endTime = evt.end_time ? formatTime12h(evt.end_time) : '';
    const duration = evt.duration_minutes || '';
    const room = evt.room || '';
    const teacher = evt.teacher || '';
    const credits = evt.credits || '';

    rows.push([
      escapeCSV(day),
      escapeCSV(subject),
      escapeCSV(code),
      escapeCSV(startTime),
      escapeCSV(endTime),
      escapeCSV(duration),
      escapeCSV(room),
      escapeCSV(teacher),
      escapeCSV(credits)
    ].join(','));
  });

  return rows.join('\r\n');
}

/**
 * Triggers an immediate browser download of the CSV file
 * @param {string} csvContent 
 * @param {string} filename 
 */
export function downloadCSV(csvContent, filename = 'timetable_schedule.csv') {
  if (!csvContent) return;
  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanName);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes time string to 24h format "HH:MM"
 */
function normalizeTimeTo24h(str) {
  if (!str) return null;
  const clean = str.trim().toUpperCase();
  const ampmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] || '00';
    if (ampmMatch[3] === 'PM' && h < 12) h += 12;
    if (ampmMatch[3] === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const h24Match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return `${String(parseInt(h24Match[1], 10)).padStart(2, '0')}:${h24Match[2]}`;
  }
  return null;
}

/**
 * Parses raw CSV text into schedule event objects
 * @param {string} csvText 
 * @returns {Array}
 */
export function parseCSVToEvents(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const getCol = (patterns) => headers.findIndex((h) => patterns.some((p) => h.includes(p)));

  const dayIdx = getCol(['day', 'weekday']);
  const subjIdx = getCol(['subject', 'class', 'course', 'title', 'name']);
  const codeIdx = getCol(['code']);
  const startIdx = getCol(['start', 'from', 'begintime']);
  const endIdx = getCol(['end', 'to', 'stoptime']);
  const durIdx = getCol(['duration']);
  const roomIdx = getCol(['room', 'loc', 'hall', 'lab']);
  const teacherIdx = getCol(['teacher', 'instructor', 'prof']);
  const creditsIdx = getCol(['credit', 'crhr']);

  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols || cols.length === 0 || cols.every((c) => !c)) continue;

    const rawDay = dayIdx >= 0 && cols[dayIdx] ? cols[dayIdx] : 'Monday';
    const matchedDay = DAYS_LIST.find((d) => d.toLowerCase() === rawDay.toLowerCase()) || rawDay;
    const subj = subjIdx >= 0 && cols[subjIdx] ? cols[subjIdx] : `Class ${i}`;
    const code = codeIdx >= 0 && cols[codeIdx] ? cols[codeIdx] : null;
    const rawStart = startIdx >= 0 && cols[startIdx] ? cols[startIdx] : '09:00';
    const rawEnd = endIdx >= 0 && cols[endIdx] ? cols[endIdx] : null;
    const room = roomIdx >= 0 && cols[roomIdx] ? cols[roomIdx] : null;
    const teacher = teacherIdx >= 0 && cols[teacherIdx] ? cols[teacherIdx] : null;
    const credits = creditsIdx >= 0 && cols[creditsIdx] ? cols[creditsIdx] : null;

    const start = normalizeTimeTo24h(rawStart) || rawStart;
    const end = rawEnd ? (normalizeTimeTo24h(rawEnd) || rawEnd) : null;
    let duration = 60;
    if (durIdx >= 0 && cols[durIdx]) {
      const parsedDur = parseInt(cols[durIdx], 10);
      if (!isNaN(parsedDur) && parsedDur > 0) duration = parsedDur;
    } else if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) duration = diff;
    }

    events.push({
      class_name: subj,
      subject: subj,
      course_code: code,
      day: matchedDay,
      start_time: start,
      end_time: end,
      duration_minutes: duration,
      room,
      teacher,
      credits,
      confidence: 1.0
    });
  }

  return events;
}
