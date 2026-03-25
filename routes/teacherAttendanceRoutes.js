// routes/teacherAttendanceRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/teacherAttendanceController');
const authMiddleware = require('../middlewares/authMiddleware');

// ── Middleware shorthand ──────────────────────────────────────────────────────
const auth = authMiddleware;

// You can add role-guard middleware like:
// const adminOnly = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin only' });
// const teacherOnly = (req, res, next) => ['teacher', 'admin'].includes(req.user.role) ? next() : res.status(403).json({ message: 'Forbidden' });

// ── TEACHER routes (self) ─────────────────────────────────────────────────────

/**
 * POST /api/teacher-attendance/mark
 * Teacher marks own attendance for today
 */
router.post('/mark', auth, ctrl.markOwnAttendance);

/**
 * GET /api/teacher-attendance/my
 * Teacher views own attendance history
 * Query: month, year, startDate, endDate
 */
router.get('/my', auth, ctrl.getMyAttendance);

// ── ADMIN routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/teacher-attendance/admin/stats
 * Admin dashboard stats for a specific date
 * Query: date (optional, defaults to today)
 */
router.get('/admin/stats', auth, ctrl.getAdminStats);

/**
 * GET /api/teacher-attendance/admin
 * Admin views all teachers' attendance
 * Query: month, year, teacherId, status, date, page, limit
 */
router.get('/admin', auth, ctrl.getAllTeachersAttendance);

/**
 * POST /api/teacher-attendance/admin/mark
 * Admin marks attendance for any teacher
 * Body: { teacherId, date, status, ... }
 */
router.post('/admin/mark', auth, ctrl.adminMarkAttendance);

/**
 * PUT /api/teacher-attendance/admin/approve/:id
 * Admin approves a single pending attendance record
 */
router.put('/admin/approve/:id', auth, ctrl.approveAttendance);

/**
 * PUT /api/teacher-attendance/admin/approve-bulk
 * Admin approves all pending records for a date
 * Body: { date }
 */
router.put('/admin/approve-bulk', auth, ctrl.bulkApprove);

/**
 * DELETE /api/teacher-attendance/admin/:id
 * Admin deletes an attendance record
 */
router.delete('/admin/:id', auth, ctrl.deleteAttendance);

module.exports = router;

// ─────────────────────────────────────────────
// Register in your main app.js / index.js:
// const teacherAttendanceRoutes = require('./routes/teacherAttendanceRoutes');
// app.use('/api/teacher-attendance', teacherAttendanceRoutes);
// ─────────────────────────────────────────────