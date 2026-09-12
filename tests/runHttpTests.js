/**
 * Live HTTP Integration Test for SmartTime AI
 * Performs end-to-end HTTP requests against http://localhost:3000
 */

async function runLiveHttpTests() {
  const baseUrl = 'http://localhost:3000';
  console.log(`\n==================================================`);
  console.log(`🌐 TESTING LIVE RUNNING SMARTTIME AI SERVER (${baseUrl})`);
  console.log(`==================================================\n`);

  let passes = 0;
  let fails = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ HTTP PASS: ${msg}`);
      passes++;
    } else {
      console.error(`  ✕ HTTP FAIL: ${msg}`);
      fails++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    assert(health.status === 'ok', 'GET /api/health returned status ok');
    assert(health.app === 'SmartTime AI', 'GET /api/health confirmed app name');

    // 2. Auth Register Fresh User
    const testEmail = `user_${Date.now()}@smarttime.ai`;
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sarah Khan',
        email: testEmail,
        password: 'password123',
        role: 'Student'
      })
    });
    const regData = await registerRes.json();
    assert(regData.success === true, 'POST /api/auth/register created new user account');
    const token = regData.token;

    // 3. Verify Empty Dashboard on Fresh Account
    const dashRes = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { 'x-user-id': token }
    });
    const dash = await dashRes.json();
    assert(dash.user && dash.user.name === 'Sarah Khan', 'GET /api/dashboard returned registered user profile');
    assert(dash.timetable_status.has_active === false, 'Fresh user starts with no active timetable (clean slate)');

    // 4. Voice NLU Schedule Parsing API
    const voiceRes = await fetch(`${baseUrl}/api/ai/parse-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': token },
      body: JSON.stringify({
        transcript: 'Monday ko meri Digital Marketing class 5:00 PM to 6:00 PM hai Room 204 me by Prof Sarah'
      })
    });
    const voice = await voiceRes.json();
    assert(voice.success === true && voice.events.length === 1, 'POST /api/ai/parse-voice parsed voice transcript');
    assert(voice.events[0].class_name === 'Digital Marketing', 'Extracted class name Digital Marketing');

    // 5. Create Custom Timetable with User's Schedule & Reminders
    const createTtRes = await fetch(`${baseUrl}/api/timetables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': token },
      body: JSON.stringify({
        name: 'My University Schedule',
        source_type: 'voice',
        start_date: '2026-08-30',
        end_date: '2026-11-30',
        duration: '3 Months',
        events: voice.events,
        reminder_1_minutes: 30,
        reminder_2_minutes: 5
      })
    });
    const ttCreated = await createTtRes.json();
    assert(ttCreated.success === true, 'POST /api/timetables created custom timetable');

    // 6. Calendar Events API
    const eventsRes = await fetch(`${baseUrl}/api/events?start_date=2026-08-30&end_date=2026-09-30`, {
      headers: { 'x-user-id': token }
    });
    const eventsData = await eventsRes.json();
    assert(eventsData.events.length > 0, `GET /api/events returned ${eventsData.events.length} recurring occurrences`);

    // 7. Timetables Management API
    const ttRes = await fetch(`${baseUrl}/api/timetables`, {
      headers: { 'x-user-id': token }
    });
    const ttData = await ttRes.json();
    assert(ttData.timetables.length === 1, `GET /api/timetables returned 1 user timetable`);

    // 8. Notification Center API
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { 'x-user-id': token }
    });
    const notifData = await notifRes.json();
    assert(Array.isArray(notifData.notifications), 'GET /api/notifications returned notification array');

    // 9. Test Chime trigger
    const chimeRes = await fetch(`${baseUrl}/api/notifications/test-chime`, {
      method: 'POST',
      headers: { 'x-user-id': token }
    });
    const chimeData = await chimeRes.json();
    assert(chimeData.success === true, 'POST /api/notifications/test-chime triggered alert');

    console.log(`\n==================================================`);
    console.log(`📊 LIVE HTTP TEST RESULTS: ${passes} PASSED, ${fails} FAILED`);
    console.log(`==================================================\n`);

    if (fails > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal HTTP test error:', err);
    process.exit(1);
  }
}

runLiveHttpTests();
