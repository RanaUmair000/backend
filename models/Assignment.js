const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classes',
    required: [true, 'Class is required'],
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: [true, 'Course/Subject is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    required: [true, 'Teacher is required'],
    index: true
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  totalMarks: {
    type: Number,
    default: 100,
    min: [1, 'Total marks must be at least 1']
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Closed'],
    default: 'Published'
  },
  academicYear: {
    type: String,
    required: false,
    trim: true
  }
}, { timestamps: true });

assignmentSchema.index({ classId: 1, courseId: 1, academicYear: 1 });
assignmentSchema.index({ createdBy: 1, academicYear: 1 });
assignmentSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
