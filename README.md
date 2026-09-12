
# SMARTTIME AI ⏰✨

> **"Your Schedule. Automatically Organized."**

SmartTime AI is a production-ready, AI-powered timetable and schedule management application designed for students, teachers, and professionals. It allows users to provide schedules via **Image Upload / Camera OCR**, **Natural Language Voice Input**, or **Manual Schedule Builder**, normalizing them into structured JSON schedules, managing timetable validity/expiry, automatically generating recurring calendar events, and scheduling proactive reminders and notifications.

---

## 🌟 Key Features

### 1. Three Input Methods → Unified Schedule Engine

- **Image Upload & Camera OCR**: Drag-and-drop or capture photos of weekly/monthly routines. Includes real-time laser scanning effect and 7-step quality checklist.
- **Voice Schedule Input**: Web Speech API speech-to-text with support for English & Hinglish (e.g. *"Monday ko meri Digital Marketing class 5 baje hai..."*).
- **Manual Schedule Builder**: Clean, responsive multi-class builder form.
- **Unified Normalization**: All methods feed into the exact same structured JSON schedule schema.

### 2. 5-Step Schedule Creation Flow

1. **Add Schedule**: Upload image, capture photo, speak schedule, or type classes.
2. **Review & Confirm**: Day-grouped cards with AI confidence scores (e.g., 98%), conflict detection (overlapping classes), duplicate alerts, and missing duration picker (no hallucinations).
3. **Choose Validity**: 1, 2, 3, 6 months, 1 year, or custom end dates.
4. **Choose Reminders**: Dual reminder controls (Reminder 1 e.g. 30m before, Reminder 2 e.g. 5m before).
5. **Done & Generate**: Automated generation checklist, sound chime, and instant calendar setup.

### 3. Dynamic Dashboard

- **Next Class Hero Card**: Dynamic second-by-second live countdown ticker (*"Starts in 1h 24m 15s"*), teacher, room, and location.
- **Today's Schedule Timeline**: Color-coded status tags (*Upcoming*, *Ongoing Now*, *Completed*) with reminder indicators.
- **Current Timetable Status Card**: Active validity window, remaining days countdown (*7 days remaining*), and manage timetable action.
- **Quick Action Shortcuts**: 1-click shortcuts to Upload, Speak, Add Class, or View Calendar.

### 4. Interactive Calendar

- **Day, Week, and Month Views**: Smooth transitions with subject color tags.
- **Event Details Modal**: View class details, Edit, Reschedule (automatically recalculates future reminders), Delete, and Pause reminders.

### 5. Proactive Dual-Reminder & Notification Engine

- **Web Audio Chime Synthesizer**: Harmonious two-tone chime played on alerts and test triggers.
- **Web Notifications API**: Desktop & mobile browser notification support.
- **In-App Notification Center**: Unread badge counter, filter tabs (*Class Reminders*, *Expiry Warnings*, *System*), and Mark All Read.
- **Timetable Expiry Warnings**: Automatic proactive alerts (e.g., 7 days before semester ends).

### 6. Timetable Lifecycle Management

- **Extend Timetable**: Add 1, 3, 6, or 12 months with automatic recurring event extension.
- **Replace Timetable**: Safely archive current active timetable, stopping future old events/reminders while preserving historical records.
- **Pause & Resume**: Temporary schedule pausing with one click.

---

## 🎨 Visual Design System

- **Primary Colors**: Primary Purple (`#6C63FF`), Soft Purple (`#8B84FF`)
- **Secondary Colors**: Sky Blue (`#5BC0EB`), Mint Green (`#6EE7B7`)
- **Accent Colors**: Soft Pink (`#F8A5C2`)
- **Backgrounds**: Soft Tinted Light (`#F8F9FF` / `#FFFFFF`) and Full Dark Theme (`#12111E` / `#1C1A2E`)
- **Typography**: `Poppins` (Headings) + `Inter` (Body)

---

## 🚀 Quick Start & Local Development

### 1. Prerequisites

- Node.js (v18+)

### 2. Run the Application

```bash
# Start the server (runs on http://localhost:3000)
node server/index.js
```

### 3. Run Automated & Live HTTP Tests

```bash
# Run unit tests and live HTTP integration tests
node tests/runTests.js
node tests/runHttpTests.js
```

---

## 📁 Project Structure

```text
smarttime-ai/
├── public/
│   ├── index.html                   # SEO-optimized Single Page App entry point
│   ├── css/
│   │   ├── base.css                 # Design system tokens, typography, CSS reset
│   │   ├── components.css           # Buttons, cards, modals, badges, steppers, toasts
│   │   ├── animations.css           # Laser scan, audio waveform visualizer, glow
│   │   └── pages.css                # Landing, dashboard, calendar, wizard layouts
│   └── js/
│       ├── app.js                   # Application router & background poller
│       ├── state.js                 # Global reactive store
│       ├── api.js                   # Client HTTP API client
│       ├── utils/
│       │   ├── dateUtils.js         # Timezone-safe date/time utilities
│       │   ├── audioUtils.js        # Web Audio chime synthesizer & Web Speech API
│       │   └── notificationUtils.js # Browser notification permissions & triggers
│       └── components/
│           ├── navbar.js            # Desktop sidebar & mobile bottom bar
│           ├── landingPage.js       # Modern public landing page
│           ├── authModals.js        # Login, Signup, and 3-step Onboarding
│           ├── dashboardView.js     # Live countdown, today timeline, quick actions
│           ├── addScheduleWizard.js # 5-step unified creation wizard
│           ├── cameraModal.js       # Live camera capture & stream modal
│           ├── calendarView.js      # Day/Week/Month interactive calendar
│           ├── timetablesView.js    # My Timetables, Extend, Replace modals
│           ├── notificationsView.js # Notification center & sound chime tester
│           ├── settingsView.js      # Profile, timezone, reminders, theme toggle
│           └── toast.js             # Toast notification component
│
├── server/
│   ├── index.js                     # Express server & cron loop
│   ├── database/
│   │   └── db.js                    # Persistent relational JSON database layer
│   ├── routes/
│   │   ├── authRoutes.js            # Register, Login, Me, Profile, Onboarding
│   │   ├── dashboardRoutes.js       # Dynamic dashboard data aggregation
│   │   ├── aiRoutes.js              # Vision OCR & Voice NLU extraction
│   │   ├── timetableRoutes.js       # Timetable lifecycle & validity
│   │   ├── eventRoutes.js           # Calendar events & rescheduling
│   │   └── notificationRoutes.js    # Notification center & settings
│   ├── services/
│   │   ├── aiService.js             # Unified OCR & Speech NLU engine
│   │   ├── recurrenceEngine.js      # Weekly recurring dates & countdown calculation
│   │   ├── reminderEngine.js        # Proactive dual reminders & cron ticker
│   │   └── conflictDetector.js      # Overlapping schedule & duplicate detection
│   └── middleware/
│       └── authMiddleware.js        # Auth session validation
│
├── tests/
│   ├── runTests.js                  # Unit & logic test suite (27 tests)
│   └── runHttpTests.js              # Live HTTP API integration test suite (12 tests)
│
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Security & Quality Assurance

- **User Data Isolation**: Multi-tenant authorization middleware ensuring users only access their own schedule data.
- **Input & File Validation**: Multer image limits, MIME type verification, non-executable storage.
- **Zero Hallucination Guarantee**: If end time or duration is missing, the AI prompts the user rather than guessing.
- **Idempotent Scheduling**: Duplicate reminder prevention with timezone consistency.
