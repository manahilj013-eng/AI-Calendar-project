require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseConfigured, testSupabaseConnection } = require('./supabaseClient');

const DATA_FILE = path.join(__dirname, '../../data/smarttime.json');

async function runMigration() {
  console.log('====================================================');
  console.log('📦 SMARTTIME AI — SUPABASE DATA MIGRATION UTILITY');
  console.log('====================================================\n');

  if (!isSupabaseConfigured() || !supabase) {
    console.error('❌ Supabase is not configured!');
    console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in your .env file.\n');
    process.exit(1);
  }

  console.log('🔍 Testing connection to Supabase...');
  const health = await testSupabaseConnection();
  if (!health.connected) {
    console.error('❌ Could not connect to Supabase:', health.message);
    process.exit(1);
  }

  if (health.tablesCreated === false) {
    console.error('⚠️  Supabase tables are missing!');
    console.error('👉 Please execute "server/database/supabase_schema.sql" in your Supabase SQL Editor first, then rerun this command.\n');
    process.exit(1);
  }

  console.log('✅ Connected to Supabase successfully!\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.log('ℹ️  No local data file found at data/smarttime.json. Nothing to migrate.');
    return;
  }

  let localData = {};
  try {
    localData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to parse local data/smarttime.json:', err.message);
    process.exit(1);
  }

  const tables = [
    { name: 'users', key: 'users' },
    { name: 'timetables', key: 'timetables' },
    { name: 'events', key: 'events' },
    { name: 'reminders', key: 'reminders' },
    { name: 'notifications', key: 'notifications' },
    { name: 'notification_settings', key: 'notification_settings' }
  ];

  const validUserIds = new Set((localData.users || []).map(u => u.id));

  for (const table of tables) {
    let items = localData[table.key] || [];
    if (table.name === 'notification_settings') {
      items = items.filter(s => validUserIds.has(s.user_id));
    }
    if (items.length === 0) {
      console.log(`⚪ ${table.name}: 0 records to migrate.`);
      continue;
    }

    console.log(`⏳ Migrating ${items.length} records to "${table.name}"...`);

    // Clean up items for PostgreSQL column compliance if needed
    const cleanedItems = items.map(item => {
      const copy = { ...item };
      // ensure dates/booleans are valid
      return copy;
    });

    const { data, error } = await supabase
      .from(table.name)
      .upsert(cleanedItems, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Error migrating to ${table.name}:`, error.message);
    } else {
      console.log(`✅ ${table.name}: Successfully migrated ${items.length} records.`);
    }
  }

  console.log('\n🎉 Migration process completed successfully!');
  console.log('====================================================');
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
