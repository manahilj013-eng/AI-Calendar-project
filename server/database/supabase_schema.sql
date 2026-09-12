-- ==============================================================================
-- SMARTTIME AI — SUPABASE POSTGRESQL DATABASE SCHEMA
-- ==============================================================================
-- This script creates all required tables, relations, indexes, and triggers
-- for the SmartTime AI application on Supabase.
-- 
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Project -> SQL Editor -> Click "New Query"
-- 3. Paste this complete script and click "RUN".
-- ==============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'Student',
    timezone TEXT DEFAULT 'UTC',
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TIMETABLES TABLE
CREATE TABLE IF NOT EXISTS public.timetables (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    semester TEXT,
    source_type TEXT DEFAULT 'manual',
    validity_period TEXT DEFAULT '3_months',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    raw_schedule_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EVENTS TABLE (Schedule Classes / Routines)
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    timetable_id TEXT NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    room TEXT,
    teacher TEXT,
    color TEXT DEFAULT '#6366f1',
    confidence NUMERIC DEFAULT 1.0,
    is_rescheduled BOOLEAN DEFAULT FALSE,
    original_time TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. REMINDERS TABLE
CREATE TABLE IF NOT EXISTS public.reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    timetable_id TEXT REFERENCES public.timetables(id) ON DELETE CASCADE,
    occurrence_date DATE,
    reminder_minutes_before INTEGER DEFAULT 30,
    scheduled_time TIMESTAMPTZ NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'browser',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    scheduled_for TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTIFICATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE,
    browser_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    reminder_1_enabled BOOLEAN DEFAULT TRUE,
    reminder_1_minutes INTEGER DEFAULT 30,
    reminder_2_enabled BOOLEAN DEFAULT TRUE,
    reminder_2_minutes INTEGER DEFAULT 5,
    expiry_warning_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_timetables_user_id ON public.timetables(user_id);
CREATE INDEX IF NOT EXISTS idx_timetables_status ON public.timetables(status);
CREATE INDEX IF NOT EXISTS idx_events_timetable_id ON public.events(timetable_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_day ON public.events(day_of_week);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON public.reminders(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon and service_role full read/write access (Application server operates via service or anon keys)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access to users" ON public.users;
    CREATE POLICY "Public access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to timetables" ON public.timetables;
    CREATE POLICY "Public access to timetables" ON public.timetables FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to events" ON public.events;
    CREATE POLICY "Public access to events" ON public.events FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to reminders" ON public.reminders;
    CREATE POLICY "Public access to reminders" ON public.reminders FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to notifications" ON public.notifications;
    CREATE POLICY "Public access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to notification_settings" ON public.notification_settings;
    CREATE POLICY "Public access to notification_settings" ON public.notification_settings FOR ALL USING (true) WITH CHECK (true);
END $$;
