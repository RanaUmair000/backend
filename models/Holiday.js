const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Holiday name is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Holiday date is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['National', 'Religious', 'Academic', 'Other'],
    default: 'Academic'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    match: [/^\d{4}-\d{4}$/, 'Academic year format should be YYYY-YYYY']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
holidaySchema.index({ date: 1, academicYear: 1 });
holidaySchema.index({ academicYear: 1, isActive: 1 });

// Static method to check if a date is a holiday
holidaySchema.statics.isHoliday = async function(date, academicYear) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const holiday = await this.findOne({
    date: { $gte: startOfDay, $lte: endOfDay },
    academicYear,
    isActive: true
  });
  
  return holiday;
};

// Static method to get upcoming holidays
holidaySchema.statics.getUpcomingHolidays = async function(academicYear, limit = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.find({
    date: { $gte: today },
    academicYear,
    isActive: true
  })
    .sort({ date: 1 })
    .limit(limit);
};

// Static method to get holidays in a date range
holidaySchema.statics.getHolidaysInRange = async function(startDate, endDate, academicYear) {
  return this.find({
    date: { $gte: startDate, $lte: endDate },
    academicYear,
    isActive: true
  }).sort({ date: 1 });
};

module.exports = mongoose.model('Holiday', holidaySchema);