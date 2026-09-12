require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseUrl.startsWith('https://')
  );
}

let supabase = null;
if (isSupabaseConfigured()) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
    supabase = null;
  }
}

/**
 * Health check to test live connectivity to Supabase
 */
async function testSupabaseConnection() {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      configured: false,
      connected: false,
      message: 'Supabase URL or API Key is not configured in .env'
    };
  }

  try {
    // Attempt a light ping by querying the users table count
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // If table does not exist yet
      if (error.code === '42P01') {
        return {
          configured: true,
          connected: true,
          tablesCreated: false,
          message: 'Connected to Supabase, but schema tables are not created yet. Please run server/database/supabase_schema.sql in Supabase SQL Editor.'
        };
      }
      return {
        configured: true,
        connected: false,
        error: error.message,
        message: `Supabase query failed: ${error.message}`
      };
    }

    return {
      configured: true,
      connected: true,
      tablesCreated: true,
      userCount: count,
      message: 'Successfully connected to Supabase PostgreSQL database!'
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err.message,
      message: `Failed to connect to Supabase: ${err.message}`
    };
  }
}

module.exports = {
  supabase,
  isSupabaseConfigured,
  testSupabaseConnection
};
