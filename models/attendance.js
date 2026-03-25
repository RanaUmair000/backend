// ============================================
// Student Model
// ============================================
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  rollNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  guardianName: {
    type: String,
    trim: true
  },
  guardianPhone: {
    type: String,
    trim: true
  },
  guardianEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  medicalInfo: {
    allergies: [String],
    medications: [String],
    conditions: [String]
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Graduated', 'Transferred', 'Suspended'],
    default: 'Active'
  },
  profileImage: {
    type: String,
    default: null
  },
  previousSchool: {
    name: String,
    lastClass: String,
    transferDate: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
studentSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Indexes for faster queries
studentSchema.index({ rollNumber: 1 });
studentSchema.index({ classId: 1, section: 1 });
studentSchema.index({ firstName: 1, lastName: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ email: 1 });

// Pre-save middleware to ensure uppercase for certain fields
studentSchema.pre('save', function(next) {
  if (this.rollNumber) {
    this.rollNumber = this.rollNumber.toUpperCase();
  }
  if (this.section) {
    this.section = this.section.toUpperCase();
  }
  next();
});

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

// ============================================
// Class Model
// ============================================

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  sections: [{
    type: String,
    trim: true,
    uppercase: true
  }],
  academicYear: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g., 2024-2025)']
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  subjects: [{
    name: String,
    code: String,
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    }
  }],
  maxStrength: {
    type: Number,
    default: 40
  },
  room: {
    building: String,
    floor: Number,
    roomNumber: String
  },
  schedule: {
    startTime: String,
    endTime: String,
    workingDays: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Completed'],
    default: 'Active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for current student count
classSchema.virtual('currentStudentCount', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'classId',
  count: true
});

// Indexes
classSchema.index({ grade: 1, academicYear: 1 });
classSchema.index({ name: 1 });
classSchema.index({ status: 1 });

const Class = mongoose.models.Class || mongoose.model('Class', classSchema);

// ============================================
// Attendance Model
// ============================================

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Leave', 'Holiday', 'Late'],
    required: true
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Casual', 'Emergency', 'Medical', 'Family', 'Other']
  },
  leaveReason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  parentNotified: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate attendance on same date
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Other indexes for faster queries
attendanceSchema.index({ classId: 1, section: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ studentId: 1, date: -1 });

// Virtual to calculate date parts
attendanceSchema.virtual('dateInfo').get(function() {
  const date = new Date(this.date);
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    dayName: date.toLocaleDateString('en-US', { weekday: 'long' })
  };
});

// Pre-save middleware
attendanceSchema.pre('save', async function(next) {
  if (this.status === 'Absent' && !this.parentNotified) {
    this.parentNotified = false;
  }

  if (this.section) {
    this.section = this.section.toUpperCase();
  }

});

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);


// ============================================
// Monthly Attendance Summary Model (for optimization)
// ============================================

const monthlyAttendanceSummarySchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classes',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  totalWorkingDays: {
    type: Number,
    required: true,
    default: 0
  },
  totalPresent: {
    type: Number,
    default: 0
  },
  totalAbsent: {
    type: Number,
    default: 0
  },
  totalLeave: {
    type: Number,
    default: 0
  },
  totalLate: {
    type: Number,
    default: 0
  },
  totalHolidays: {
    type: Number,
    default: 0
  },
  attendancePercentage: {
    type: Number,
    default: 0
  },
  consecutiveAbsences: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index
monthlyAttendanceSummarySchema.index(
  { studentId: 1, month: 1, year: 1 },
  { unique: true }
);

// Other indexes
monthlyAttendanceSummarySchema.index({ classId: 1, section: 1, month: 1, year: 1 });
monthlyAttendanceSummarySchema.index({ attendancePercentage: 1 });

// Method to calculate and update attendance percentage
monthlyAttendanceSummarySchema.methods.calculateAttendancePercentage = function() {
  if (this.totalWorkingDays === 0) {
    this.attendancePercentage = 0;
    return 0;
  }
  
  this.attendancePercentage = Number(
    ((this.totalPresent / this.totalWorkingDays) * 100).toFixed(2)
  );
  return this.attendancePercentage;
};

const MonthlyAttendanceSummary = mongoose.models.MonthlyAttendanceSummary || mongoose.model('MonthlyAttendanceSummary', monthlyAttendanceSummarySchema);
// ============================================
// Export all models
// ============================================

module.exports = {
  Student,
  Class,
  Attendance,
  MonthlyAttendanceSummary
};