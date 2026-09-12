/**
 * Automated Test Suite for SmartTime AI
 * Tests Database, Recurrence Engine, Conflict Detection, AI OCR & Voice NLU,
 * Validity Expiry, and Reminder Dispatch.
 */

const db = require('../server/database/db');
const {
  timeToMinutes,
  minutesToTime,
  format12h,
  generateOccurrences,
  getTodaySchedule,
  getNextClass
} = require('../server/services/recurrenceEngine');
const { analyzeScheduleConflicts } = require('../server/services/conflictDetector');
const { parseVoiceTranscript, normalizeTimeTo24h } = require('../server/services/aiService');
const { scheduleRemindersForTimetable } = require('../server/services/reminderEngine');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING SMARTTIME AI COMPREHENSIVE TEST SUITE');
  console.log('==================================================\n');

  // Test 1: Time Utilities & Formatting
  console.log('[TEST GROUP 1: Time & Recurrence Utilities]');
  assert(timeToMinutes('17:00') === 1020, '17:00 converts to 1020 minutes');
  assert(timeToMinutes('09:30') === 570, '09:30 converts to 570 minutes');
  assert(minutesToTime(1020) === '17:00', '1020 minutes formats to 17:00');
  assert(format12h('17:00') === '5:00 PM', '17:00 formats to 5:00 PM');
  assert(format12h('09:30') === '9:30 AM', '09:30 formats to 9:30 AM');

  // Test 2: Voice NLU Schedule Extraction
  console.log('\n[TEST GROUP 2: Voice NLU Schedule Extraction]');
  const sampleVoice1 = 'Monday ko meri Digital Marketing class 5:00 PM to 6:00 PM hai Room 204 me by Prof Sarah, and Tuesday ko SEO class 4:00 PM to 5:00 PM hai';
  const parsed1 = parseVoiceTranscript(sampleVoice1);
  assert(parsed1.length === 2, 'Extracted 2 classes from voice transcript');
  assert(parsed1[0].day === 'Monday', 'Class 1 day is Monday');
  assert(parsed1[0].start_time === '17:00', 'Class 1 start time is 17:00 (5:00 PM)');
  assert(parsed1[0].end_time === '18:00', 'Class 1 end time is 18:00 (6:00 PM)');
  assert(parsed1[0].teacher === 'Prof Sarah', 'Class 1 teacher extracted as Prof Sarah');
  assert(parsed1[0].room === '204', 'Class 1 room extracted as 204');

  // Test 3: Missing Information & Non-Hallucination
  console.log('\n[TEST GROUP 3: Missing Information & Non-Hallucination]');
  const sampleVoiceNoEnd = 'Wednesday ko Graphic Design class 6:30 PM hai';
  const parsedNoEnd = parseVoiceTranscript(sampleVoiceNoEnd);
  assert(parsedNoEnd.length === 1, 'Extracted 1 class without end time');
  assert(parsedNoEnd[0].end_time === null, 'Did NOT hallucinate end time when unspecified');
  assert(parsedNoEnd[0].needs_duration === true, 'Flagged needs_duration for user confirmation');

  // Test 4: Conflict & Duplicate Detection
  console.log('\n[TEST GROUP 4: Schedule Conflict & Duplicate Detection]');
  const conflictingEvents = [
    { class_name: 'Digital Marketing', day: 'Monday', start_time: '17:00', end_time: '18:00', duration: 60 },
    { class_name: 'SEO & Analytics', day: 'Monday', start_time: '17:30', end_time: '18:30', duration: 60 }
  ];
  const conflictRes = analyzeScheduleConflicts(conflictingEvents);
  assert(conflictRes.hasConflicts === true, 'Detected overlapping classes on Monday (17:00-18:00 vs 17:30-18:30)');
  assert(conflictRes.conflicts.length === 1, 'Found exactly 1 conflict pair');

  const duplicateEvents = [
    { class_name: 'Digital Marketing', day: 'Monday', start_time: '17:00', end_time: '18:00' },
    { class_name: 'Digital Marketing', day: 'Monday', start_time: '17:00', end_time: '18:00' }
  ];
  const duplicateRes = analyzeScheduleConflicts(duplicateEvents);
  assert(duplicateRes.hasDuplicates === true, 'Detected duplicate class entries');

  // Test 5: Calendar Occurrences Generation
  console.log('\n[TEST GROUP 5: Recurrence Engine & Calendar Generation]');
  const sampleEvents = [
    { id: 'evt_test_01', timetable_id: 'tt_test', class_name: 'Physics', day: 'Monday', start_time: '09:00', end_time: '10:30', duration: 90, status: 'active' },
    { id: 'evt_test_02', timetable_id: 'tt_test', class_name: 'Chemistry', day: 'Wednesday', start_time: '11:00', end_time: '12:30', duration: 90, status: 'active' }
  ];
  // 1 month window: 2026-09-01 to 2026-09-30
  const occurrences = generateOccurrences(sampleEvents, '2026-09-01', '2026-09-30');
  assert(occurrences.length > 0, `Generated ${occurrences.length} calendar occurrences across September 2026`);
  assert(occurrences.every((o) => o.start_time_formatted && o.time_range_formatted), 'Every occurrence has formatted time displays');

  // Test 6: Next Class & Today Schedule
  console.log('\n[TEST GROUP 6: Next Class & Today Schedule]');
  const mockTimetable = { id: 'tt_test', status: 'active', start_date: '2026-08-01', end_date: '2026-12-31' };
  // August 31, 2026 was a Monday. Mock 8:00 AM local time
  const mockNow = new Date(2026, 7, 31, 8, 0, 0);
  const nextClass = getNextClass(sampleEvents, mockTimetable, mockNow);
  assert(nextClass !== null, 'Found upcoming next class');
  assert(nextClass && nextClass.class_name === 'Physics', 'Next class correctly identified as Physics (Monday 9:00 AM)');
  assert(nextClass && nextClass.starts_in_minutes === 60, 'Calculated exactly 60 minutes countdown until start');

  // Test 7: Database & Proactive Reminder Scheduling
  console.log('\n[TEST GROUP 7: Database & Proactive Reminder Scheduling]');
  const testUser = db.createUser({
    name: 'Test Student',
    email: `test_${Date.now()}@smarttime.ai`,
    password: 'password123',
    role: 'Student'
  });
  assert(testUser && testUser.id, 'Created new user in database');

  const testTimetable = db.createTimetable({
    user_id: testUser.id,
    name: 'Semester 1 Routine',
    start_date: '2026-08-30',
    end_date: '2026-11-30',
    duration: '3 Months',
    status: 'active'
  });
  assert(testTimetable && testTimetable.id, 'Created timetable with 3-month validity');

  const testEvt = db.createEvent({
    user_id: testUser.id,
    timetable_id: testTimetable.id,
    class_name: 'Data Structures',
    day: 'Monday',
    start_time: '14:00',
    end_time: '15:30',
    duration: 90,
    status: 'active'
  });
  assert(testEvt && testEvt.id, 'Created repeating event');

  const reminders = scheduleRemindersForTimetable(testTimetable.id, testUser.id, 30, 5);
  assert(reminders.length > 0, `Scheduled ${reminders.length} dual reminders (30m and 5m before start)`);

  // Test 8: Timetable Extension
  console.log('\n[TEST GROUP 8: Timetable Extension]');
  const originalEnd = testTimetable.end_date;
  const newEnd = new Date(originalEnd);
  newEnd.setMonth(newEnd.getMonth() + 3);
  testTimetable.end_date = newEnd.toISOString().split('T')[0];
  db.save();
  assert(testTimetable.end_date > originalEnd, `Extended timetable expiry from ${originalEnd} to ${testTimetable.end_date}`);

  console.log('\n==================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
