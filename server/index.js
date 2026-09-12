require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { startReminderTicker } = require('./services/reminderEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files with no-cache in development
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/timetables', require('./routes/timetableRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

const db = require('./database/db');

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SmartTime AI',
    tagline: 'Your Schedule. Automatically Organized.',
    database: {
      mode: db.getDatabaseMode(),
      supabaseConfigured: db.isSupabaseConfigured()
    },
    timestamp: new Date().toISOString()
  });
});

// Single Page App fallback for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Background Reminder & Timetable Expiry Loop
startReminderTicker();

// Listen
const HOST = '0.0.0.0';
app.listen(PORT, HOST, async () => {
  console.log(`=========================================`);
  console.log(`🚀 SmartTime AI Server is running!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📍 Direct IP: http://127.0.0.1:${PORT}`);
  console.log(`🕒 Mode: ${process.env.NODE_ENV || 'development'}`);
  if (db.isSupabaseConfigured()) {
    const health = await db.testSupabaseConnection();
    if (health.connected) {
      console.log(`🟢 Database: Supabase Cloud Connected & Active`);
    } else {
      console.log(`🟡 Database: Supabase Configured (${health.message})`);
    }
  } else {
    console.log(`💾 Database: Local Mode (Add SUPABASE_URL in .env to connect to Supabase Cloud)`);
  }
  console.log(`=========================================`);
});
