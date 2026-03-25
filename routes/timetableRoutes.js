const express = require('express');
const router = express.Router();

// Import controllers
const {
  createTimeSlot,
  getAllTimeSlots,
  getActiveTimeSlots,
  getTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  permanentDeleteTimeSlot,
  bulkCreateTimeSlots
} = require('../controllers/timeSlotController');

const {
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getWeeklyTimetableByClass,
  getTeacherSchedule,
  getTodayScheduleForClass,
  getTodayScheduleForTeacher,
  bulkCreateTimetable,
  copyTimetable,
  getAllTimetableEntries,
  checkConflict
} = require('../controllers/timetableController');

const {
  createHoliday,
  getAllHolidays,
  checkHoliday,
  updateHoliday,
  deleteHoliday,
  bulkCreateHolidays
} = require('../controllers/holidayController');

// Import middleware (assuming these exist in your project)
// const { protect, authorize } = require('../middleware/auth');

// For demonstration, I'll comment out auth middleware
// Uncomment and adjust based on your existing auth setup

// ============================================
// TIME SLOT ROUTES
// ============================================

// Create time slot - Admin only
router.post('/timeslots', /* protect, authorize('admin'), */ createTimeSlot);

// Bulk create time slots - Admin only
router.post('/timeslots/bulk', /* protect, authorize('admin'), */ bulkCreateTimeSlots);

// Get all time slots - All authenticated users
router.get('/timeslots', /* protect, */ getAllTimeSlots);

// Get active time slots - All authenticated users
router.get('/timeslots/active', /* protect, */ getActiveTimeSlots);

// Get single time slot - Admin only
router.get('/timeslots/:id', /* protect, authorize('admin'), */ getTimeSlot);

// Update time slot - Admin only
router.put('/timeslots/:id', /* protect, authorize('admin'), */ updateTimeSlot);

// Delete time slot (soft delete) - Admin only
router.delete('/timeslots/:id', /* protect, authorize('admin'), */ deleteTimeSlot);

// Permanent delete time slot - Admin only
router.delete('/timeslots/:id/permanent', /* protect, authorize('admin'), */ permanentDeleteTimeSlot);

// ============================================
// TIMETABLE ENTRY ROUTES
// ============================================

// Check for conflicts - Admin only
router.post('/check-conflict', /* protect, authorize('admin'), */ checkConflict);

// Create timetable entry - Admin only
router.post('/entries', /* protect, authorize('admin'), */ createTimetableEntry);

// Bulk create timetable entries - Admin only
router.post('/entries/bulk', /* protect, authorize('admin'), */ bulkCreateTimetable);

// Copy timetable - Admin only
router.post('/copy', /* protect, authorize('admin'), */ copyTimetable);

// Get all timetable entries - Admin only
router.get('/entries', /* protect, authorize('admin'), */ getAllTimetableEntries);

// Update timetable entry - Admin only
router.put('/entries/:id', /* protect, authorize('admin'), */ updateTimetableEntry);

// Delete timetable entry - Admin only
router.delete('/entries/:id', /* protect, authorize('admin'), */ deleteTimetableEntry);

// Get weekly timetable by class - All authenticated users
router.get('/class/:classId', /* protect, */ getWeeklyTimetableByClass);

// Get today's schedule for class - All authenticated users
router.get('/today/class/:classId', /* protect, */ getTodayScheduleForClass);

// Get teacher's schedule (weekly or daily) - Admin, Teacher
router.get('/teacher/:teacherId', /* protect, authorize('admin', 'teacher'), */ getTeacherSchedule);

// Get today's schedule for teacher - Admin, Teacher
router.get('/today/teacher/:teacherId', /* protect, authorize('admin', 'teacher'), */ getTodayScheduleForTeacher);

// ============================================
// HOLIDAY ROUTES
// ============================================

// Create holiday - Admin only
router.post('/holidays', /* protect, authorize('admin'), */ createHoliday);

// Bulk create holidays - Admin only
router.post('/holidays/bulk', /* protect, authorize('admin'), */ bulkCreateHolidays);

// Get all holidays - All authenticated users
router.get('/holidays', /* protect, */ getAllHolidays);

// Check if date is holiday - All authenticated users
router.get('/holidays/check/:date', /* protect, */ checkHoliday);

// Update holiday - Admin only
router.put('/holidays/:id', /* protect, authorize('admin'), */ updateHoliday);

// Delete holiday - Admin only
router.delete('/holidays/:id', /* protect, authorize('admin'), */ deleteHoliday);

module.exports = router;