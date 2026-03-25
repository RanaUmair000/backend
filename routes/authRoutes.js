/**
 * backend/authRoutes.js
 * Auth routes — mount in app.js as:
 *   app.use('/api/auth', require('./routes/authRoutes'));
 */

const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/authController');

// Optional: rate limiting (install express-rate-limit)
// const rateLimit = require('express-rate-limit');
// const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
// router.post('/login', loginLimiter, login);

router.post('/login', login);
router.post('/logout', logout);

// Protected route example (requires authMiddleware)
// router.get('/me', authMiddleware, getMe);

module.exports = router;
