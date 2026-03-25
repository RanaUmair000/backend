const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Casual', 'Emergency', 'Medical', 'Family', 'Other'],
    required: true
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewRemarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  totalDays: {
    type: Number
  }
}, { timestamps: true });

leaveRequestSchema.pre('save', async function () {
  if (this.startDate && this.endDate) {
    const diff = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1;
    this.totalDays = diff > 0 ? diff : 1;
  }
  // no next() needed in async
});

leaveRequestSchema.index({ teacherId: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
