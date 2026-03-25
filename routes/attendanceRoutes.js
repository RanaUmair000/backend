const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// ============================================
// ATTENDANCE ROUTES
// ============================================

/**
 * @route   POST /api/attendance/mark-bulk
 * @desc    Mark attendance for multiple students at once
 * @access  Private (Teachers/Admin)
 * @body    {
 *            date: "2024-01-15",
 *            classId: "507f1f77bcf86cd799439011",
 *            section: "A",
 *            markedBy: "507f1f77bcf86cd799439012",
 *            records: [
 *              {
 *                studentId: "507f1f77bcf86cd799439013",
 *                status: "Present",
 *                remarks: "On time"
 *              },
 *              ...
 *            ]
 *          }
 */
router.post('/mark-bulk', attendanceController.markBulkAttendance);
router.post('/mark-all-present', attendanceController.markAllPresent);

/**
 * @route   POST /api/attendance/mark
 * @desc    Mark attendance for a single student
 * @access  Private (Teachers/Admin)
 * @body    {
 *            studentId: "507f1f77bcf86cd799439013",
 *            date: "2024-01-15",
 *            status: "Present",
 *            remarks: "On time",
 *            leaveType: "Sick" (optional),
 *            leaveReason: "Fever" (optional),
 *            markedBy: "507f1f77bcf86cd799439012"
 *          }
 */
router.post('/mark', attendanceController.markAttendance);

/**
 * @route   GET /api/attendance/by-date
 * @desc    Get attendance records for a specific date, class, and section
 * @access  Private (Teachers/Admin)
 * @query   date=2024-01-15&classId=507f1f77bcf86cd799439011&section=A
 */
router.get('/by-date', attendanceController.getAttendanceByDate);

/**
 * @route   GET /api/attendance/student/:studentId
 * @desc    Get attendance history for a specific student
 * @access  Private (Teachers/Admin/Student/Parent)
 * @query   startDate=2024-01-01&endDate=2024-01-31 (optional)
 */
router.get('/student/:studentId', attendanceController.getStudentAttendance);

/**
 * @route   GET /api/attendance/monthly-report
 * @desc    Get monthly attendance report for a class/section
 * @access  Private (Teachers/Admin)
 * @query   month=1&year=2024&classId=507f1f77bcf86cd799439011&section=A
 */
router.get('/monthly-report', attendanceController.getMonthlyReport);

/**
 * @route   GET /api/attendance/defaulters
 * @desc    Get list of students with attendance below threshold
 * @access  Private (Teachers/Admin)
 * @query   threshold=75&month=1&year=2024&classId=507f1f77bcf86cd799439011&section=A
 */
router.get('/defaulters', attendanceController.getDefaulters);

/**
 * @route   GET /api/attendance/class-stats
 * @desc    Get class-wise attendance statistics for a date
 * @access  Private (Admin)
 * @query   date=2024-01-15 (optional, defaults to today)
 */
router.get('/class-stats', attendanceController.getClassWiseStats);

/**
 * @route   PUT /api/attendance/:attendanceId
 * @desc    Update an existing attendance record
 * @access  Private (Teachers/Admin)
 * @body    {
 *            status: "Absent",
 *            remarks: "Updated remarks"
 *          }
 */
router.put('/:attendanceId', attendanceController.updateAttendance);

/**
 * @route   DELETE /api/attendance/:attendanceId
 * @desc    Delete an attendance record
 * @access  Private (Admin only)
 */
router.delete('/:attendanceId', attendanceController.deleteAttendance);

// ============================================
// STUDENT ROUTES (for reference)
// ============================================

const studentRouter = express.Router();

/**
 * @route   GET /api/students
 * @desc    Get all students or filter by class/section
 * @query   classId=xxx&section=A&status=Active
 */
studentRouter.get('/', async (req, res) => {
  try {
    const { classId, section, status } = req.query;
    const query = {};
    
    if (classId) query.classId = classId;
    if (section) query.section = section.toUpperCase();
    if (status) query.status = status;

    const { Student } = require('../models');
    const students = await Student.find(query)
      .populate('classId', 'name grade')
      .sort({ rollNumber: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/students/:id
 * @desc    Get a single student by ID
 */
studentRouter.get('/:id', async (req, res) => {
  try {
    const { Student } = require('../models');
    const student = await Student.findById(req.params.id)
      .populate('classId', 'name grade sections');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/students
 * @desc    Create a new student
 */
studentRouter.post('/', async (req, res) => {
  try {
    const { Student } = require('../models');
    const student = new Student(req.body);
    const saved = await student.save();

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: saved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating student',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/students/:id
 * @desc    Update a student
 */
studentRouter.put('/:id', async (req, res) => {
  try {
    const { Student } = require('../models');
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating student',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete a student (soft delete - change status to Inactive)
 */
studentRouter.delete('/:id', async (req, res) => {
  try {
    const { Student } = require('../models');
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status: 'Inactive' },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting student',
      error: error.message
    });
  }
});

// ============================================
// CLASS ROUTES (for reference)
// ============================================

const classRouter = express.Router();

/**
 * @route   GET /api/classes
 * @desc    Get all classes
 */
classRouter.get('/', async (req, res) => {
  try {
    const { Class } = require('../models');
    const classes = await Class.find()
      .populate('classTeacher', 'firstName lastName')
      .sort({ grade: 1 });

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching classes',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/classes/:id
 * @desc    Get a single class by ID
 */
classRouter.get('/:id', async (req, res) => {
  try {
    const { Class } = require('../models');
    const classData = await Class.findById(req.params.id)
      .populate('classTeacher', 'firstName lastName email')
      .populate('subjects.teacher', 'firstName lastName');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.status(200).json({
      success: true,
      data: classData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching class',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/classes
 * @desc    Create a new class
 */
classRouter.post('/', async (req, res) => {
  try {
    const { Class } = require('../models');
    const classData = new Class(req.body);
    const saved = await classData.save();

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: saved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating class',
      error: error.message
    });
  }
});

// ============================================
// Export routers
// ============================================

module.exports = {
  attendanceRouter: router,
  studentRouter,
  classRouter
};