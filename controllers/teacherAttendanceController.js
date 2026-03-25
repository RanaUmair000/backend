// controllers/teacherAttendanceController.js
const mongoose = require('mongoose');
const TeacherAttendance = require('../models/TeacherAttendance');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeDate = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

// ─── TEACHER: Mark own attendance ─────────────────────────────────────────────
// POST /api/teacher-attendance/mark
exports.markOwnAttendance = async (req, res) => {
  try {
    const teacherId = req.user._id;
    let { date, status, checkInTime, checkOutTime, remarks, leaveType, leaveReason } = req.body;

    if (leaveType === "") leaveType = undefined;
    if (leaveReason === "") leaveReason = undefined;

    if (!date || !status) {
      return res.status(400).json({ success: false, message: 'date and status are required' });
    }

    // Teachers can only mark today's attendance
    const today = normalizeDate(new Date());
    const targetDate = normalizeDate(date);

    if (targetDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'You can only mark attendance for today'
      });
    }

    const existing = await TeacherAttendance.findOne({ teacherId, date: targetDate });

    if (existing) {
      // Allow update only if not yet approved
      if (existing.isApproved) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already approved and cannot be changed'
        });
      }
      existing.status = status;
      existing.checkInTime = checkInTime || existing.checkInTime;
      existing.checkOutTime = checkOutTime || existing.checkOutTime;
      existing.remarks = remarks || existing.remarks;
      existing.leaveType = leaveType || existing.leaveType;
      existing.leaveReason = leaveReason || existing.leaveReason;
      existing.isSelfMarked = true;
      existing.isApproved = false;

      const updated = await existing.save();
      return res.json({ success: true, message: 'Attendance updated', data: updated });
    }

    const record = await TeacherAttendance.create({
      teacherId,
      date: targetDate,
      status,
      checkInTime,
      checkOutTime,
      remarks,
      leaveType,
      leaveReason,
      isSelfMarked: true,
      isApproved: false
    });

    res.status(201).json({ success: true, message: 'Attendance marked successfully', data: record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for today' });
    }
    console.error('markOwnAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── TEACHER: Get own attendance history ──────────────────────────────────────
// GET /api/teacher-attendance/my?month=3&year=2026
exports.getMyAttendance = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { month, year, startDate, endDate } = req.query;

    const query = { teacherId };

    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      query.date = {
        $gte: new Date(y, m - 1, 1),
        $lte: new Date(y, m, 0, 23, 59, 59)
      };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = normalizeDate(startDate);
      if (endDate) {
        const ed = normalizeDate(endDate);
        ed.setHours(23, 59, 59, 999);
        query.date.$lte = ed;
      }
    }

    const records = await TeacherAttendance.find(query)
      .populate('approvedBy', 'firstName lastName')
      .sort({ date: -1 });

    // Stats
    const stats = {
      total: records.length,
      present: records.filter(r => r.status === 'Present').length,
      absent: records.filter(r => r.status === 'Absent').length,
      leave: records.filter(r => r.status === 'Leave').length,
      late: records.filter(r => r.status === 'Late').length,
      halfDay: records.filter(r => r.status === 'Half Day').length,
      pending: records.filter(r => !r.isApproved).length,
    };
    stats.percentage = stats.total > 0
      ? ((stats.present + stats.late) / stats.total * 100).toFixed(1)
      : '0.0';

    // Today's record
    const today = normalizeDate(new Date());
    const todayRecord = records.find(r =>
      normalizeDate(r.date).getTime() === today.getTime()
    ) || null;

    res.json({ success: true, data: { records, stats, todayRecord } });
  } catch (err) {
    console.error('getMyAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Get all teachers attendance ───────────────────────────────────────
// GET /api/teacher-attendance/admin?month=3&year=2026&teacherId=xxx&status=Absent
exports.getAllTeachersAttendance = async (req, res) => {
  try {
    const { month, year, teacherId, status, date, page = 1, limit = 50 } = req.query;

    const query = {};

    if (teacherId) query.teacherId = teacherId;
    if (status) query.status = status;

    if (date) {
      const d = normalizeDate(date);
      query.date = { $gte: d, $lte: new Date(d.getTime() + 86399999) };
    } else if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      query.date = {
        $gte: new Date(y, m - 1, 1),
        $lte: new Date(y, m, 0, 23, 59, 59)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      TeacherAttendance.find(query)
        .populate('teacherId', 'firstName lastName email profileImage subject')
        .populate('approvedBy', 'firstName lastName')
        .sort({ date: -1, 'teacherId.firstName': 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TeacherAttendance.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('getAllTeachersAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Mark attendance for a teacher ─────────────────────────────────────
// POST /api/teacher-attendance/admin/mark
exports.adminMarkAttendance = async (req, res) => {
  try {
    const adminId = req.user._id;
    let { teacherId, date, status, checkInTime, checkOutTime, remarks, leaveType, leaveReason } = req.body;

    if (!teacherId || !date || !status) {
      return res.status(400).json({ success: false, message: 'teacherId, date and status are required' });
    }

    if (leaveType === "") leaveType = undefined;
    if (leaveReason === "") leaveReason = undefined;

    const targetDate = normalizeDate(date);

    const record = await TeacherAttendance.findOneAndUpdate(
      { teacherId, date: targetDate },
      {
        teacherId,
        date: targetDate,
        status,
        checkInTime,
        checkOutTime,
        remarks,
        leaveType,
        leaveReason,
        markedBy: adminId,
        isSelfMarked: false,
        isApproved: true,
        approvedBy: adminId,
        approvedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, message: 'Attendance marked by admin', data: record });
  } catch (err) {
    console.error('adminMarkAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Approve pending attendance ────────────────────────────────────────
// PUT /api/teacher-attendance/admin/approve/:id
exports.approveAttendance = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;

    const record = await TeacherAttendance.findByIdAndUpdate(
      id,
      { isApproved: true, approvedBy: adminId, approvedAt: new Date() },
      { new: true }
    ).populate('teacherId', 'firstName lastName');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, message: 'Attendance approved', data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Bulk approve all pending for a date ───────────────────────────────
// PUT /api/teacher-attendance/admin/approve-bulk
exports.bulkApprove = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { date } = req.body;

    const targetDate = normalizeDate(date || new Date());

    const result = await TeacherAttendance.updateMany(
      { date: { $gte: targetDate, $lte: new Date(targetDate.getTime() + 86399999) }, isApproved: false },
      { isApproved: true, approvedBy: adminId, approvedAt: new Date() }
    );

    res.json({ success: true, message: `${result.modifiedCount} records approved`, count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Summary stats for dashboard ───────────────────────────────────────
// GET /api/teacher-attendance/admin/stats?date=2026-03-25
exports.getAdminStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = normalizeDate(date || new Date());
    const endOfDay = new Date(targetDate.getTime() + 86399999);

    const [todayRecords, pendingCount] = await Promise.all([
      TeacherAttendance.find({ date: { $gte: targetDate, $lte: endOfDay } }),
      TeacherAttendance.countDocuments({ isApproved: false })
    ]);

    const stats = {
      date: targetDate,
      present: todayRecords.filter(r => r.status === 'Present').length,
      absent: todayRecords.filter(r => r.status === 'Absent').length,
      leave: todayRecords.filter(r => r.status === 'Leave').length,
      late: todayRecords.filter(r => r.status === 'Late').length,
      halfDay: todayRecords.filter(r => r.status === 'Half Day').length,
      totalMarked: todayRecords.length,
      pendingApproval: pendingCount
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Delete a record ───────────────────────────────────────────────────
// DELETE /api/teacher-attendance/admin/:id
exports.deleteAttendance = async (req, res) => {
  try {
    const record = await TeacherAttendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};