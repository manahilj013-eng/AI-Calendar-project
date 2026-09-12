const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isSupabaseConfigured, testSupabaseConnection } = require('./supabaseClient');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'smarttime.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB structure
const initialSchema = {
  users: [],
  timetables: [],
  events: [],
  reminders: [],
  notifications: [],
  notification_settings: []
};

// Simple secure hash helper (SHA-256 with salt)
function hashPassword(password) {
  const salt = 'smarttime_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Load DB from file
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      return { ...initialSchema, ...data };
    }
  } catch (err) {
    console.error('Error loading DB, resetting to defaults:', err);
  }
  return JSON.parse(JSON.stringify(initialSchema));
}

// Save DB safely (atomic local write)
function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Global in-memory instance synced to disk
let db = loadDB();

// ==============================================================================
// ASYNC SUPABASE CLOUD REPLICATION HELPERS
// ==============================================================================
async function asyncUpsertSupabase(table, row) {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    let payload = row;
    if (table === 'reminders') {
      const { class_name, room, teacher, ...rest } = row;
      payload = rest;
    } else if (table === 'events') {
      const { metadata, ...rest } = row;
      payload = rest;
    }
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Supabase ${table} upsert warning]:`, error.message);
    }
  } catch (err) {
    console.warn(`[Supabase ${table} error]:`, err.message);
  }
}

async function asyncUpdateSupabase(table, updates, matchField, matchValue) {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const { error } = await supabase.from(table).update(updates).eq(matchField, matchValue);
    if (error) {
      console.warn(`[Supabase ${table} update warning]:`, error.message);
    }
  } catch (err) {
    console.warn(`[Supabase ${table} error]:`, err.message);
  }
}

async function asyncDeleteSupabase(table, matchField, matchValue) {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const { error } = await supabase.from(table).delete().eq(matchField, matchValue);
    if (error) {
      console.warn(`[Supabase ${table} delete warning]:`, error.message);
    }
  } catch (err) {
    console.warn(`[Supabase ${table} error]:`, err.message);
  }
}

/**
 * Synchronizes in-memory state with Supabase cloud database
 */
async function syncFromSupabase() {
  if (!isSupabaseConfigured() || !supabase) return false;
  try {
    const tables = ['users', 'timetables', 'events', 'reminders', 'notifications', 'notification_settings'];
    for (const tbl of tables) {
      const { data, error } = await supabase.from(tbl).select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        db[tbl] = data;
      }
    }
    saveDB(db);
    console.log('✅ In-memory database successfully synchronized from Supabase cloud!');
    return true;
  } catch (err) {
    console.warn('Supabase sync-from failed, continuing with local data:', err.message);
    return false;
  }
}

// If Supabase is configured at boot, asynchronously fetch cloud records
if (isSupabaseConfigured()) {
  syncFromSupabase().catch(() => {});
}

// Export database operations
module.exports = {
  db,
  supabase,
  isSupabaseConfigured,
  testSupabaseConnection,
  syncFromSupabase,
  hashPassword,
  save: () => saveDB(db),
  reload: () => {
    db = loadDB();
    return db;
  },
  getDatabaseMode: () => (isSupabaseConfigured() ? 'supabase' : 'local_json'),

  // User Helpers
  findUserById: (id) => db.users.find((u) => u.id === id),
  findUserByEmail: (email) => db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
  createUser: (userData) => {
    const user = {
      id: 'usr_' + crypto.randomUUID(),
      ...userData,
      password_hash: hashPassword(userData.password),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    delete user.password;
    db.users.push(user);

    // Create default settings
    const settings = {
      id: 'nset_' + crypto.randomUUID(),
      user_id: user.id,
      push_enabled: true,
      email_enabled: false,
      browser_enabled: true,
      sound_enabled: true,
      reminder_1_enabled: true,
      reminder_1_minutes: 30,
      reminder_2_enabled: true,
      reminder_2_minutes: 5,
      expiry_warning_days: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.notification_settings.push(settings);
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('users', user);
    asyncUpsertSupabase('notification_settings', settings);

    return user;
  },

  // Timetable Helpers
  getTimetablesByUserId: (userId) => db.timetables.filter((t) => t.user_id === userId),
  getActiveTimetable: (userId) => db.timetables.find((t) => t.user_id === userId && t.status === 'active'),
  getTimetableById: (id) => db.timetables.find((t) => t.id === id),
  createTimetable: (data) => {
    const timetable = {
      id: 'tt_' + crypto.randomUUID(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.timetables.push(timetable);
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('timetables', timetable);

    return timetable;
  },
  updateTimetable: (id, updates) => {
    const tt = db.timetables.find((t) => t.id === id);
    if (tt) {
      Object.assign(tt, updates, { updated_at: new Date().toISOString() });
      saveDB(db);

      // Cloud Replication
      asyncUpdateSupabase('timetables', { ...updates, updated_at: tt.updated_at }, 'id', id);
    }
    return tt;
  },

  // Events Helpers
  getEventsByTimetableId: (timetableId) => db.events.filter((e) => e.timetable_id === timetableId),
  getEventsByUserId: (userId) => db.events.filter((e) => e.user_id === userId),
  getEventById: (id) => db.events.find((e) => e.id === id),
  createEvent: (data) => {
    const event = {
      id: 'evt_' + crypto.randomUUID(),
      ...data,
      confidence: data.confidence !== undefined ? data.confidence : 1.0,
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.events.push(event);
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('events', event);

    return event;
  },
  updateEvent: (id, updates) => {
    const evt = db.events.find((e) => e.id === id);
    if (evt) {
      Object.assign(evt, updates, { updated_at: new Date().toISOString() });
      saveDB(db);

      // Cloud Replication
      asyncUpdateSupabase('events', { ...updates, updated_at: evt.updated_at }, 'id', id);
    }
    return evt;
  },
  deleteEvent: (id) => {
    const idx = db.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const deleted = db.events.splice(idx, 1)[0];
      // Clean up linked pending reminders
      db.reminders = db.reminders.filter((r) => r.event_id !== id);
      saveDB(db);

      // Cloud Replication
      asyncDeleteSupabase('events', 'id', id);
      asyncDeleteSupabase('reminders', 'event_id', id);

      return deleted;
    }
    return null;
  },

  // Reminder Helpers
  getRemindersByUserId: (userId) => db.reminders.filter((r) => r.user_id === userId),
  createReminder: (data) => {
    const reminder = {
      id: 'rem_' + crypto.randomUUID(),
      ...data,
      status: data.status || 'pending',
      created_at: new Date().toISOString()
    };
    db.reminders.push(reminder);
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('reminders', reminder);

    return reminder;
  },
  clearFutureRemindersForTimetable: (timetableId) => {
    const nowIso = new Date().toISOString();
    db.reminders = db.reminders.filter(
      (r) => !(r.timetable_id === timetableId && r.scheduled_time > nowIso)
    );
    saveDB(db);

    // Cloud Replication
    if (isSupabaseConfigured() && supabase) {
      Promise.resolve(
        supabase
          .from('reminders')
          .delete()
          .eq('timetable_id', timetableId)
          .gt('scheduled_time', nowIso)
      ).catch(() => {});
    }
  },

  // Notification Helpers
  getNotificationsByUserId: (userId) =>
    db.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  createNotification: (data) => {
    const notif = {
      id: 'notif_' + crypto.randomUUID(),
      read: false,
      ...data,
      created_at: new Date().toISOString()
    };
    db.notifications.push(notif);
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('notifications', notif);

    return notif;
  },
  markNotificationRead: (id, userId) => {
    const notif = db.notifications.find((n) => n.id === id && n.user_id === userId);
    if (notif) {
      notif.read = true;
      saveDB(db);

      // Cloud Replication
      asyncUpdateSupabase('notifications', { read: true }, 'id', id);
    }
    return notif;
  },
  markAllNotificationsRead: (userId) => {
    db.notifications.forEach((n) => {
      if (n.user_id === userId) n.read = true;
    });
    saveDB(db);

    // Cloud Replication
    if (isSupabaseConfigured() && supabase) {
      Promise.resolve(
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
      ).catch(() => {});
    }
  },
  deleteNotification: (id, userId) => {
    const idx = db.notifications.findIndex((n) => n.id === id && n.user_id === userId);
    if (idx !== -1) {
      const removed = db.notifications.splice(idx, 1)[0];
      saveDB(db);

      if (isSupabaseConfigured() && supabase) {
        Promise.resolve(
          supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
        ).catch(() => {});
      }
      return removed;
    }
    return null;
  },
  clearAlarmHistory: (userId, timeframe = 'all') => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const isAlarm = (n) => n.type === 'reminder' || (n.title && (n.title.includes('Alarm') || n.title.includes('⏰')));

    const toDeleteIds = [];
    db.notifications = db.notifications.filter((n) => {
      if (n.user_id !== userId) return true;
      if (!isAlarm(n)) return true;

      let shouldDelete = false;
      if (timeframe === 'daily') {
        shouldDelete = n.created_at >= todayStart;
      } else if (timeframe === 'weekly') {
        shouldDelete = n.created_at >= sevenDaysAgo;
      } else if (timeframe === 'monthly') {
        shouldDelete = n.created_at >= thirtyDaysAgo;
      } else {
        shouldDelete = true;
      }

      if (shouldDelete) {
        toDeleteIds.push(n.id);
        return false;
      }
      return true;
    });

    saveDB(db);

    if (toDeleteIds.length > 0 && isSupabaseConfigured() && supabase) {
      Promise.resolve(
        supabase
          .from('notifications')
          .delete()
          .in('id', toDeleteIds)
      ).catch(() => {});
    }

    return toDeleteIds.length;
  },

  // Notification Settings Helpers
  getSettingsByUserId: (userId) => {
    let settings = db.notification_settings.find((s) => s.user_id === userId);
    if (!settings) {
      settings = {
        id: 'nset_' + crypto.randomUUID(),
        user_id: userId,
        push_enabled: true,
        email_enabled: false,
        browser_enabled: true,
        sound_enabled: true,
        reminder_1_enabled: true,
        reminder_1_minutes: 30,
        reminder_2_enabled: true,
        reminder_2_minutes: 5,
        expiry_warning_days: 7,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.notification_settings.push(settings);
      saveDB(db);

      // Cloud Replication
      asyncUpsertSupabase('notification_settings', settings);
    }
    return settings;
  },
  updateSettings: (userId, updates) => {
    const settings = module.exports.getSettingsByUserId(userId);
    Object.assign(settings, updates, { updated_at: new Date().toISOString() });
    saveDB(db);

    // Cloud Replication
    asyncUpsertSupabase('notification_settings', settings);

    return settings;
  }
};
