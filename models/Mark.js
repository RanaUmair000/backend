const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classes',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: true,
    index: true
  },
  examTitle: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true
  },
  examType: {
    type: String,
    enum: ['Quiz', 'Midterm', 'Final', 'Assignment', 'Practical', 'Other'],
    default: 'Other'
  },
  marksObtained: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 1
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  academicYear: {
    type: String,
    required: true
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    required: true
  },
  examDate: {
    type: Date
  }
}, { timestamps: true });

// Prevent duplicate marks entry
markSchema.index(
  { studentId: 1, classId: 1, courseId: 1, examTitle: 1, academicYear: 1 },
  { unique: true }
);

markSchema.index({ classId: 1, courseId: 1, academicYear: 1 });

// Pre-save: auto-calculate grade
markSchema.pre('save', function (next) {
  const percentage = (this.marksObtained / this.totalMarks) * 100;
  if (percentage >= 90) this.grade = 'A+';
  else if (percentage >= 80) this.grade = 'A';
  else if (percentage >= 75) this.grade = 'B+';
  else if (percentage >= 65) this.grade = 'B';
  else if (percentage >= 55) this.grade = 'C+';
  else if (percentage >= 45) this.grade = 'C';
  else if (percentage >= 33) this.grade = 'D';
  else this.grade = 'F';
  next();
});

module.exports = mongoose.model('Mark', markSchema);
