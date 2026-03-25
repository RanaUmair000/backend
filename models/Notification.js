const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Announcement', 'Assignment', 'Exam', 'Leave', 'General', 'Alert'],
    default: 'General'
  },
  // null = broadcast to all teachers
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    default: null,
    index: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  link: {
    type: String // optional deep link
  }
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
