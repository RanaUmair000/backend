const { Attendance, MonthlyAttendanceSummary } = require('../models/attendance');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Class = require('../models/Class');

// ============================================
// ATTENDANCE CONTROLLERS
// ============================================

/**
 * Mark attendance for multiple students (Bulk marking)
 * POST /api/attendance/mark-bulk
 */
exports.markBulkAttendance = async (req, res) => {
  try {
    const { date, classId, markedBy, records } = req.body;

    if (!date || !classId || !records) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const selectedDate = normalizeDate(date);

    const operations = records.map(record => ({
      updateOne: {
        filter: {
          studentId: record.studentId,
          date: selectedDate
        },
        update: {
          studentId: record.studentId,
          classId,
          date: selectedDate,
          status: record.status,
          remarks: record.remarks,
          leaveType: record.leaveType,
          leaveReason: record.leaveReason,
          markedBy
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(operations);

    // Update summaries
    for (const record of records) {
      const attendanceDoc = await Attendance.findOne({
        studentId: record.studentId,
        date: selectedDate
      });

      await updateMonthlySummary(attendanceDoc);
    }

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
};

exports.markAllPresent = async (req, res) => {
  try {
    const { date, classId, markedBy } = req.body;

    const selectedDate = normalizeDate(date);

    const students = await Student.find({
      classId,
      status: 'Active'
    });

    const operations = students.map(student => ({
      updateOne: {
        filter: {
          studentId: student._id,
          date: selectedDate
        },
        update: {
          studentId: student._id,
          classId,
          date: selectedDate,
          status: 'Present',
          markedBy
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(operations);

    for (const student of students) {
      const attendanceDoc = await Attendance.findOne({
        studentId: student._id,
        date: selectedDate
      });

      await updateMonthlySummary(attendanceDoc);
    }

    res.status(200).json({
      success: true,
      message: 'All students marked present'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking all present',
      error: error.message
    });
  }
};

/**
 * Mark attendance for a single student
 * POST /api/attendance/mark
 */
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, date, status, remarks, leaveType, leaveReason, markedBy } = req.body;

    // Validation
    if (!studentId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'studentId, date, and status are required'
      });
    }

    // Validate student exists
    const student = await Student.findById(studentId).populate('classId');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const attendanceDate = new Date(date);

    // Check for duplicate
    const existingAttendance = await Attendance.findOne({
      studentId,
      date: attendanceDate
    });

    if (existingAttendance) {
      // Update existing
      existingAttendance.status = status;
      existingAttendance.remarks = remarks;
      existingAttendance.leaveType = leaveType;
      existingAttendance.leaveReason = leaveReason;
      existingAttendance.markedBy = markedBy;

      const updated = await existingAttendance.save();

      // Update monthly summary
      await updateMonthlySummaries(student.classId._id, student.section, attendanceDate);

      return res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data: updated
      });
    }

    // Create new attendance
    const attendance = new Attendance({
      studentId,
      classId: student.classId._id,
      section: student.section,
      date: attendanceDate,
      status,
      remarks,
      leaveType,
      leaveReason,
      markedBy,
      checkInTime: status === 'Present' ? new Date() : null
    });

    const saved = await attendance.save();

    // Update monthly summary
    await updateMonthlySummaries(student.classId._id, student.section, attendanceDate);

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: saved
    });

  } catch (error) {
    console.error('Error in markAttendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
};

/**
 * Get attendance by date for a class/section
 * GET /api/attendance/by-date?date=YYYY-MM-DD&classId=xxx&section=A
 */
// Normalize date (remove time)
const normalizeDate = (date) => {
  const d = new Date(date);

  if (isNaN(d)) {
    throw new Error("Invalid date provided");
  }

  d.setHours(0, 0, 0, 0);
  return d;
};


// Check if date is today
const isToday = (date) => {
  const today = normalizeDate(new Date());
  return normalizeDate(date).getTime() === today.getTime();
};

// Update Monthly Summary
const updateMonthlySummary = async (attendanceDoc) => {
  const date = new Date(attendanceDoc.date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let summary = await MonthlyAttendanceSummary.findOne({
    studentId: attendanceDoc.studentId,
    month,
    year
  });

  if (!summary) {
    summary = new MonthlyAttendanceSummary({
      studentId: attendanceDoc.studentId,
      classId: attendanceDoc.classId,
      section: attendanceDoc.section,
      month,
      year
    });
  }

  // Recalculate counts
  const records = await Attendance.find({
    studentId: attendanceDoc.studentId,
    date: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0)
    }
  });

  summary.totalWorkingDays = records.length;
  summary.totalPresent = records.filter(r => r.status === 'Present').length;
  summary.totalAbsent = records.filter(r => r.status === 'Absent').length;
  summary.totalLeave = records.filter(r => r.status === 'Leave').length;
  summary.totalLate = records.filter(r => r.status === 'Late').length;

  summary.calculateAttendancePercentage();
  summary.lastUpdated = new Date();

  await summary.save();
};

exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date, classId } = req.query;

    if (!date || !classId) {
      return res.status(400).json({
        success: false,
        message: 'date and classId are required'
      });
    }

    // Normalize date
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Get all active students of the class
    const students = await Student.find({ class: classId, status: 'Active' }).sort({ rollNumber: 1 });

    // Get attendance records for that date
    const attendanceRecords = await Attendance.find({
      classId: classId,
      date: normalizedDate
    });

    // Map attendance by studentId for quick lookup
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.studentId.toString()] = record;
    });

    // Prepare response: attach attendance if exists, otherwise null
    const result = students.map(student => ({
      student,
      attendance: attendanceMap[student._id] || null
    }));

    res.json({
      success: true,
      data: result,
      attendanceMarked: attendanceRecords.length > 0,
      attendanceRecords: attendanceRecords
    });

  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Get attendance for a specific student with date range
 * GET /api/attendance/student/:studentId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const query = { studentId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('markedBy', 'firstName lastName')
      .sort({ date: -1 });

    // Calculate statistics
    const stats = {
      totalDays: attendanceRecords.length,
      present: attendanceRecords.filter(a => a.status === 'Present').length,
      absent: attendanceRecords.filter(a => a.status === 'Absent').length,
      leave: attendanceRecords.filter(a => a.status === 'Leave').length,
      late: attendanceRecords.filter(a => a.status === 'Late').length
    };

    stats.attendancePercentage = stats.totalDays > 0
      ? ((stats.present / stats.totalDays) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        student,
        attendanceRecords,
        stats
      }
    });

  } catch (error) {
    console.error('Error in getStudentAttendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student attendance',
      error: error.message
    });
  }
};

/**
 * Get monthly attendance report
 * GET /api/attendance/monthly-report?month=1&year=2024&classId=xxx&section=A
 */
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year, classId } = req.query;

    if (!month || !year || !classId) {
      return res.status(400).json({
        success: false,
        message: 'month, year and classId are required'
      });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Get or create monthly summaries
    const summaries = await MonthlyAttendanceSummary.find({
      classId,
      month: monthNum,
      year: yearNum
    })
      .populate('studentId', 'rollNumber firstName lastName email')
      .sort({ 'studentId.rollNumber': 1 });

    // If summaries don't exist, calculate them
    if (summaries.length === 0) {
      await calculateAndSaveMonthlySummaries(classId, monthNum, yearNum);

      const newSummaries = await MonthlyAttendanceSummary.find({
        classId,
        month: monthNum,
        year: yearNum
      })
        .populate('studentId', 'rollNumber firstName lastName email')
        .sort({ 'studentId.rollNumber': 1 });

      return res.status(200).json({
        success: true,
        data: {
          month: monthNum,
          year: yearNum,
          classId,
          summaries: newSummaries
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        classId,
        summaries
      }
    });

  } catch (error) {
    console.error('Error in getMonthlyReport:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly report',
      error: error.message
    });
  }
};

/**
 * Get defaulters list (students below attendance threshold)
 * GET /api/attendance/defaulters?threshold=75&month=1&year=2024&classId=xxx
 */
exports.getDefaulters = async (req, res) => {
  try {
    const { threshold = 75, month, year, classId, section } = req.query;

    const query = {
      attendancePercentage: { $lt: parseFloat(threshold) }
    };

    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    if (classId) query.classId = classId;
    if (section) query.section = section.toUpperCase();

    const defaulters = await MonthlyAttendanceSummary.find(query)
      .populate('studentId', 'rollNumber firstName lastName email phone guardianPhone')
      .populate('classId', 'name grade')
      .sort({ attendancePercentage: 1 });

    res.status(200).json({
      success: true,
      data: {
        threshold: parseFloat(threshold),
        count: defaulters.length,
        defaulters
      }
    });

  } catch (error) {
    console.error('Error in getDefaulters:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching defaulters',
      error: error.message
    });
  }
};

/**
 * Get class-wise attendance statistics
 * GET /api/attendance/class-stats?date=YYYY-MM-DD
 */
exports.getClassWiseStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const classes = await Class.find({ status: 'Active' });
    const stats = [];

    for (const cls of classes) {
      const students = await Student.find({
        class: cls._id.toString(),
        status: 'Active'
      });
      const attendance = await Attendance.find({
        classId: cls._id,
        date: {
          $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          $lte: new Date(targetDate.setHours(23, 59, 59, 999))
        }
      });

      const present = attendance.filter(a => a.status === 'Present').length;
      const absent = attendance.filter(a => a.status === 'Absent').length;
      const leave = attendance.filter(a => a.status === 'Leave').length;

      stats.push({
        classId: cls._id,
        className: cls.name,
        totalStudents: students.length,
        present,
        absent,
        leave,
        unmarked: students.length - attendance.length,
        attendancePercentage: students.length > 0
          ? ((present / students.length) * 100).toFixed(2)
          : 0
      });
    }

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        stats
      }
    });

  } catch (error) {
    console.error('Error in getClassWiseStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class-wise stats',
      error: error.message
    });
  }
};

/**
 * Update attendance record
 * PUT /api/attendance/:attendanceId
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const updates = req.body;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        attendance[key] = updates[key];
      }
    });

    const updated = await attendance.save();

    // Update monthly summary
    await updateMonthlySummaries(attendance.classId, attendance.section, attendance.date);

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: updated
    });

  } catch (error) {
    console.error('Error in updateAttendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating attendance',
      error: error.message
    });
  }
};

/**
 * Delete attendance record
 * DELETE /api/attendance/:attendanceId
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    const { classId, section, date } = attendance;

    await Attendance.findByIdAndDelete(attendanceId);

    // Update monthly summary
    await updateMonthlySummaries(classId, section, date);

    res.status(200).json({
      success: true,
      message: 'Attendance deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteAttendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting attendance',
      error: error.message
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update monthly summaries for all students in a class/section
 */
async function updateMonthlySummaries(classId, date) {
  try {
    const targetDate = new Date(date);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    const students = await Student.find({
      classId,
      status: 'Active'
    });

    for (const student of students) {
      await calculateAndUpdateStudentMonthlySummary(student._id, classId, month, year);
    }
  } catch (error) {
    console.error('Error updating monthly summaries:', error);
  }
}

/**
 * Calculate and update monthly summary for a single student
 */
async function calculateAndUpdateStudentMonthlySummary(studentId, classId, section, month, year) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendanceRecords = await Attendance.find({
      studentId,
      date: { $gte: startDate, $lte: endDate }
    });

    const totalWorkingDays = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter(a => a.status === 'Present').length;
    const totalAbsent = attendanceRecords.filter(a => a.status === 'Absent').length;
    const totalLeave = attendanceRecords.filter(a => a.status === 'Leave').length;
    const totalLate = attendanceRecords.filter(a => a.status === 'Late').length;
    const totalHolidays = attendanceRecords.filter(a => a.status === 'Holiday').length;

    // Calculate consecutive absences
    const sortedRecords = attendanceRecords
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let consecutiveAbsences = 0;
    for (const record of sortedRecords) {
      if (record.status === 'Absent') {
        consecutiveAbsences++;
      } else {
        break;
      }
    }

    let summary = await MonthlyAttendanceSummary.findOne({
      studentId,
      month,
      year
    });

    if (!summary) {
      summary = new MonthlyAttendanceSummary({
        studentId,
        classId,
        section: section.toUpperCase(),
        month,
        year
      });
    }

    summary.totalWorkingDays = totalWorkingDays;
    summary.totalPresent = totalPresent;
    summary.totalAbsent = totalAbsent;
    summary.totalLeave = totalLeave;
    summary.totalLate = totalLate;
    summary.totalHolidays = totalHolidays;
    summary.consecutiveAbsences = consecutiveAbsences;
    summary.lastUpdated = new Date();

    summary.calculateAttendancePercentage();

    await summary.save();

  } catch (error) {
    console.error('Error calculating student monthly summary:', error);
  }
}

/**
 * Calculate and save monthly summaries for all students in a class
 */
async function calculateAndSaveMonthlySummaries(classId, section, month, year) {
  try {
    const students = await Student.find({
      classId,
      section: section.toUpperCase(),
      status: 'Active'
    });

    for (const student of students) {
      await calculateAndUpdateStudentMonthlySummary(
        student._id,
        classId,
        section,
        month,
        year
      );
    }
  } catch (error) {
    console.error('Error calculating monthly summaries:', error);
  }
}

module.exports = exports;