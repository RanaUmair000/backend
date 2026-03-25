// models/TeacherAttendance.js
const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Leave', 'Holiday', 'Late', 'Half Day'],
    required: true
  },
  checkInTime: {
    type: String, // "09:15"
    trim: true
  },
  checkOutTime: {
    type: String, // "17:00"
    trim: true
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Casual', 'Emergency', 'Medical', 'Family', 'Maternity', 'Paternity', 'Other']
  },
  leaveReason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // admin who marked, null if self-marked
  },
  isSelfMarked: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false // admin must approve teacher-self-marked attendance
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Prevent duplicate per teacher per day
teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });

// Normalize date on save (strip time)
teacherAttendanceSchema.pre('save', function () {
  if (this.date) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    this.date = d;
  }
});

module.exports =
  mongoose.models.TeacherAttendance ||
  mongoose.model('TeacherAttendance', teacherAttendanceSchema);