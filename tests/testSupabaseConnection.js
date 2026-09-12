const db = require('../server/database/db');
const { isSupabaseConfigured, testSupabaseConnection } = require('../server/database/supabaseClient');

async function runTest() {
  console.log('--- TESTING SUPABASE CLIENT & DB INTEGRATION ---');
  console.log('Database Mode:', db.getDatabaseMode());
  console.log('Is Supabase Configured:', isSupabaseConfigured());

  const conn = await testSupabaseConnection();
  console.log('Connection Test Result:', conn);

  console.log('\nTesting DB user lookup...');
  const testUser = db.findUserByEmail('demo@smarttime.ai');
  console.log('User Lookup:', testUser ? `Found (${testUser.id})` : 'Not found (OK for fresh setup)');

  console.log('\nTesting DB settings lookup...');
  const settings = db.getSettingsByUserId('usr_test_123');
  console.log('Settings generated/retrieved:', settings ? 'SUCCESS' : 'FAILED');

  console.log('\n✅ Supabase Database Layer Validation Complete!');
}

runTest();
