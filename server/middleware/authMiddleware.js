const db = require('../database/db');

function authMiddleware(req, res, next) {
  // Check authorization header, x-user-id header, or query param
  let userId = req.headers['x-user-id'] || req.cookies?.user_id;

  if (!userId && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      userId = parts[1];
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const user = db.findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated or user not found' });
  }

  req.user = user;
  next();
}

module.exports = authMiddleware;
