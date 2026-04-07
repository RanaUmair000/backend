const Teacher = require("../models/Teacher");
const Timetable = require('../models/Timetable');
const Student = require('../models/Student');
const {Attendance} = require('../models/attendance');
const Assignment = require('../models/Assignment');
const Mark = require('../models/Mark');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
/**
 * Create a new teacher
 */
exports.createTeacher = async (req, res) => {
    try {
        // 1️⃣ Extract body
        const {
            firstName,
            lastName,
            gender,
            dateOfBirth,
            religion,
            phone,
            email,
            password,
            qualification,
            employmentType,
            hireDate,
            status,
            salary,
            emergencyContactName,
            emergencyContactPhone,
            address,
        } = req.body;

        // 2️⃣ Required fields check
        const requiredFields = [
            "firstName",
            "lastName",
            "gender",
            "phone",
            "email",
            "password",
            "qualification",
            "employmentType",
            "hireDate",
            "salary",
        ];

        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`,
                });
            }
        }

        // 3️⃣ Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        // 4️⃣ Date validation
        if (dateOfBirth && isNaN(Date.parse(dateOfBirth))) {
            return res.status(400).json({
                success: false,
                message: "Invalid dateOfBirth",
            });
        }

        if (isNaN(Date.parse(hireDate))) {
            return res.status(400).json({
                success: false,
                message: "Invalid hireDate",
            });
        }

        // 5️⃣ Numeric validation
        if (isNaN(Number(salary))) {
            return res.status(400).json({
                success: false,
                message: "Salary must be a number",
            });
        }

        // 6️⃣ File handling (safe)
        const profilePic = req.files?.profilePic?.[0]?.path || null;
        const cnicPic = req.files?.cnicPic?.[0]?.path || null;

        // 7️⃣ Prepare data
        const teacherData = {
            firstName,
            lastName,
            gender,
            dateOfBirth,
            religion,
            phone,
            email,
            password,
            qualification,
            employmentType,
            hireDate,
            status: status || "Active",
            salary,
            emergencyContactName,
            emergencyContactPhone,
            address,
            profilePic,
            cnicPic,
        };

        // 8️⃣ Save to DB
        const teacher = await Teacher.create(teacherData);

        // 9️⃣ Success response
        return res.status(201).json({
            success: true,
            message: "Teacher created successfully",
            data: teacher,
        });

    } catch (error) {
        console.error("Create Teacher Error:", error);

        // 🔴 Duplicate email error (MongoDB)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already exists",
            });
        }

        // 🔴 Mongoose validation errors
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors)
                    .map(err => err.message)
                    .join(", "),
            });
        }

        // 🔴 Default fallback
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.getAllTeachers = async (req, res) => {
    try {
        const teachers = await Teacher.find();

        res.status(200).json({
            success: true,
            count: teachers.length,
            data: teachers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get teacher by ID
 */
exports.getTeacherById = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id)
            .populate("subjects")
            .populate("classes")
            .populate("userAccount");

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found",
            });
        }

        res.status(200).json({
            success: true,
            data: teacher,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateTeacher = async (req, res) => {
  try {
    // 1️⃣ Validate ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    // 2️⃣ Find teacher (same as Student)
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // 3️⃣ Update normal fields (EXPLICIT ASSIGNMENT)
    Object.assign(teacher, {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      phone: req.body.phone,
      gender: req.body.gender,
      dateOfBirth: req.body.dateOfBirth,
      religion: req.body.religion,
      qualification: req.body.qualification,
      employmentType: req.body.employmentType,
      hireDate: req.body.hireDate,
      status: req.body.status,
      salary: req.body.salary,
      employeeCode: req.body.employeeCode,
      emergencyContactName: req.body.emergencyContactName,
      emergencyContactPhone: req.body.emergencyContactPhone,
      address: req.body.address,
    });

    // 4️⃣ File delete helper (same as Student)
    const deleteFile = (filePath) => {
      if (!filePath) return;
      const fullPath = path.join(__dirname, "..", filePath.replace(/\\/g, "/"));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    };

    // 🔥 PROFILE PIC UPDATE
    if (req.files?.profilePic?.[0]) {
      deleteFile(teacher.profilePic);
      teacher.profilePic = req.files.profilePic[0].path.replace(/\\/g, "/");
    }

    // 🔥 CNIC PIC UPDATE
    if (req.files?.cnicPic?.[0]) {
      deleteFile(teacher.cnicPic);
      teacher.cnicPic = req.files.cnicPic[0].path.replace(/\\/g, "/");
    }

    // 5️⃣ Save (THIS IS THE MAGIC)
    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: teacher,
    });

  } catch (error) {
    console.error("UPDATE TEACHER ERROR:", error);

    // 🔴 Duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    // 🔴 Validation error
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map(err => err.message)
          .join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
/**
 * Delete teacher
 */
exports.deleteTeacher = async (req, res) => {
    try {
        const teacher = await Teacher.findByIdAndDelete(req.params.id);

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Teacher deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};





exports.getDashboard = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const academicYear = req.query.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
    // Get all timetable entries for teacher
    const timetableEntries = await Timetable.find({ teacherId, academicYear, isActive: true })
      .populate('classId', 'name section')
      .populate('courseId', 'name code')
      .populate('timeSlotId', 'startTime endTime order label isBreak');
    // Unique class IDs
    const classIds = [...new Set(timetableEntries.map(e => e.classId?._id?.toString()).filter(Boolean))];

    // Today's schedule
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayClasses = timetableEntries
      .filter(e => e.day === today && !e.timeSlotId?.isBreak)
      .sort((a, b) => (a.timeSlotId?.order || 0) - (b.timeSlotId?.order || 0));

    // Student count across all assigned classes
    const studentCount = await Student.countDocuments({
      class: { $in: classIds },
      status: 'Active'
    });

    // Pending assignments (upcoming due dates)
    const pendingAssignments = await Assignment.countDocuments({
      createdBy: new mongoose.Types.ObjectId(teacherId),
      dueDate: { $gte: new Date() },
      status: 'Published'
    });

    // Recent notifications
    const notifications = await Notification.find({
      $or: [{ recipientId: teacherId }, { recipientId: null }],
      isRead: false
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        stats: {
          totalClasses: classIds.length,
          todayClassesCount: todayClasses.length,
          totalStudents: studentCount,
          pendingAssignments,
          unreadNotifications: notifications.length
        },
        todaySchedule: todayClasses,
        recentNotifications: notifications
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────

exports.getTimetable = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const academicYear = req.query.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
    const schedule = await Timetable.getTeacherSchedule(teacherId, academicYear);

    // Group by day
    const grouped = {};
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    dayOrder.forEach(d => { grouped[d] = []; });

    schedule.forEach(entry => {
      if (grouped[entry.day]) {
        grouped[entry.day].push(entry);
      }
    });

    res.json({ success: true, data: { schedule: grouped, academicYear } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────

exports.getAssignedClasses = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const academicYear = req.query.academicYear || '';

    const query = { teacherId, isActive: true };
    if (academicYear) query.academicYear = academicYear;

    const timetable = await Timetable.find(query)
      .populate('classId', 'name section')
      .populate('courseId', 'name code');

    // Unique classes with courses
    const classMap = {};
    timetable.forEach(entry => {
      if (!entry.classId) return;
      const cid = entry.classId._id.toString();
      if (!classMap[cid]) {
        classMap[cid] = {
          classId: entry.classId._id,
          className: entry.classId.name,
          section: entry.classId.section,
          courses: []
        };
      }
      if (entry.courseId) {
        const alreadyAdded = classMap[cid].courses.some(c => c._id?.toString() === entry.courseId._id?.toString());
        if (!alreadyAdded) classMap[cid].courses.push(entry.courseId);
      }
    });

    res.json({ success: true, data: Object.values(classMap) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudentsForAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1️⃣ Get students
    const students = await Student.find({
      class: classId,
      status: 'Active'
    })
    .select('firstName lastName rollNumber section profilePic')
    .sort({ rollNumber: 1 });

    // 2️⃣ Get attendance for that date
    const existingAttendance = await Attendance.find({
      classId,
      date: { $gte: targetDate, $lt: nextDay }
    }).select('studentId status remarks');

    // 3️⃣ Convert to map
    const attendanceMap = {};
    existingAttendance.forEach(record => {
      attendanceMap[record.studentId.toString()] = {
        status: record.status,
        remarks: record.remarks
      };
    });

    // 4️⃣ Attach attendance to each student
    const studentsWithAttendance = students.map(student => ({
      ...student.toObject(),
      attendance: attendanceMap[student._id.toString()] || null
    }));

    // 5️⃣ Proper check
    const isAlreadyMarked =
      existingAttendance.length === students.length &&
      students.length > 0;

    res.json({
      success: true,
      data: {
        students: studentsWithAttendance,
        isAlreadyMarked
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { classId, date, attendance } = req.body;

    // Verify class ownership
    const assigned = await Timetable.findOne({ teacherId, classId, isActive: true });
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'Not assigned to this class' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const ops = attendance.map(({ studentId, status, remarks }) => ({
      updateOne: {
        filter: { studentId, classId, date: targetDate },
        update: {
          $set: {
            studentId,
            classId,
            date: targetDate,
            status,
            remarks: remarks || '',
            markedBy: teacherId
          }
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(ops);

    res.json({ success: true, message: `Attendance marked for ${attendance.length} students` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendanceByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query;

    const query = { classId };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'firstName lastName rollNumber')
      .sort({ date: -1 });

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────

exports.createAssignment = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { title, description, classId, courseId, dueDate, totalMarks, academicYear } = req.body;

    // Verify class is assigned
    const assigned = await Timetable.findOne({ teacherId, classId, courseId, isActive: true });
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'Not assigned to this class/course combination' });
    }

    const assignment = await Assignment.create({
      title, description, classId, courseId, dueDate,
      totalMarks: totalMarks || 100,
      academicYear: academicYear || '',
      createdBy: teacherId
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { page = 1, limit = 10, classId, status } = req.query;

    const query = { createdBy: teacherId };
    if (classId) query.classId = classId;
    if (status) query.status = status;

    const total = await Assignment.countDocuments(query);
    const assignments = await Assignment.find(query)
      .populate('classId', 'name section')
      .populate('courseId', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: assignments,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const assignment = await Assignment.findOneAndUpdate(
      { _id: req.params.id, createdBy: teacherId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const assignment = await Assignment.findOneAndDelete({ _id: req.params.id, createdBy: teacherId });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// MARKS
// ─────────────────────────────────────────────

exports.enterMarks = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { classId, courseId, examTitle, examType, examDate, academicYear, marks } = req.body;

    // Verify class assignment
    const assigned = await Timetable.findOne({ teacherId, classId, isActive: true });
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'Not assigned to this class' });
    }

    const ops = marks.map(({ studentId, marksObtained, totalMarks, remarks }) => ({
      updateOne: {
        filter: { studentId, classId, courseId, examTitle, academicYear },
        update: {
          $set: {
            studentId, classId, courseId, examTitle, examType: examType || 'Other',
            marksObtained, totalMarks, remarks: remarks || '',
            enteredBy: teacherId, academicYear,
            examDate: examDate ? new Date(examDate) : undefined
          }
        },
        upsert: true
      }
    }));

    await Mark.bulkWrite(ops);

    res.json({ success: true, message: `Marks entered for ${marks.length} students` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMarksByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { courseId, examTitle, academicYear } = req.query;

    const query = { classId };
    if (courseId) query.courseId = courseId;
    if (examTitle) query.examTitle = examTitle;
    if (academicYear) query.academicYear = academicYear;

    const marks = await Mark.find(query)
      .populate('studentId', 'firstName lastName rollNumber')
      .populate('courseId', 'name code')
      .sort({ 'studentId.rollNumber': 1 });

    res.json({ success: true, data: marks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// LEAVE REQUESTS
// ─────────────────────────────────────────────

exports.applyLeave = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { startDate, endDate, leaveType, reason } = req.body;

    const leave = await LeaveRequest.create({
      teacherId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      leaveType,
      reason
    });

    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { status, page = 1, limit = 10 } = req.query;

    const query = { teacherId };
    if (status) query.status = status;

    const total = await LeaveRequest.countDocuments(query);
    const leaves = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: leaves,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

exports.getNotifications = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { page = 1, limit = 20 } = req.query;

    const query = {
      $or: [{ recipientId: teacherId }, { recipientId: null }]
    };

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: notifications,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    await Notification.updateMany(
      { $or: [{ recipientId: teacherId }, { recipientId: null }], isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────

exports.getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user._id)
      .populate('subjects')
      .populate('classes');
    res.json({ success: true, data: teacher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = ['phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'qualification', 'specialization'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const teacher = await Teacher.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, data: teacher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
