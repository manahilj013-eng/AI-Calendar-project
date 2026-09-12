/**
 * Conflict & Duplicate Detector for SmartTime AI
 * Analyzes structured schedules and flags overlapping classes and duplicate entries.
 */

const { timeToMinutes } = require('./recurrenceEngine');

/**
 * Checks a list of events for timing conflicts (overlaps) and duplicate classes
 */
function analyzeScheduleConflicts(events) {
  const conflicts = [];
  const duplicates = [];

  // Group events by day or date
  const groups = {};
  events.forEach((evt, idx) => {
    const key = evt.date ? `date_${evt.date}` : `day_${(evt.day || '').toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...evt, original_index: idx });
  });

  // Check each group
  Object.keys(groups).forEach((key) => {
    const list = groups[key];
    if (list.length < 2) return;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        const aStart = timeToMinutes(a.start_time);
        const aDuration = a.duration || 60;
        const aEnd = a.end_time ? timeToMinutes(a.end_time) : aStart + aDuration;

        const bStart = timeToMinutes(b.start_time);
        const bDuration = b.duration || 60;
        const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + bDuration;

        // Check duplicate (same name, same time)
        const sameName =
          (a.class_name || '').trim().toLowerCase() === (b.class_name || '').trim().toLowerCase();
        if (sameName && aStart === bStart) {
          duplicates.push({
            event_a: a,
            event_b: b,
            message: `We found two similar classes for "${a.class_name}" on ${a.day || a.date}.`
          });
        }

        // Check overlap: (StartA < EndB) and (EndA > StartB)
        const isOverlap = aStart < bEnd && aEnd > bStart;
        if (isOverlap && !sameName) {
          conflicts.push({
            event_a: a,
            event_b: b,
            day: a.day || a.date,
            message: `These two classes overlap: "${a.class_name}" (${a.start_time} - ${a.end_time || '?'}) and "${b.class_name}" (${b.start_time} - ${b.end_time || '?'}).`
          });
        }
      }
    }
  });

  return {
    hasConflicts: conflicts.length > 0,
    hasDuplicates: duplicates.length > 0,
    conflicts,
    duplicates
  };
}

module.exports = {
  analyzeScheduleConflicts
};
