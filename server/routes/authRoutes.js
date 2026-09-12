const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, role, timezone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const newUser = db.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'Student',
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        timezone: newUser.timezone
      },
      token: newUser.id
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordHash = db.hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone
      },
      token: user.id
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const settings = db.getSettingsByUserId(req.user.id);
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      timezone: req.user.timezone
    },
    settings
  });
});

// POST /api/auth/onboarding
router.post('/onboarding', authMiddleware, (req, res) => {
  try {
    const { name, role, timezone } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (role) updates.role = role;
    if (timezone) updates.timezone = timezone;

    const user = db.findUserById(req.user.id);
    if (user) {
      Object.assign(user, updates, { updated_at: new Date().toISOString() });
      db.save();
    }

    res.json({ success: true, message: 'Onboarding completed', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, timezone, role } = req.body;
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name) user.name = name.trim();
    if (timezone) user.timezone = timezone;
    if (role) user.role = role;
    user.updated_at = new Date().toISOString();

    db.save();
    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
