const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    trim: true,
    // Format: "HH:MM" (24-hour format)
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM (24-hour)']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    trim: true,
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM (24-hour)']
  },
  order: {
    type: Number,
    required: [true, 'Order is required for sorting'],
    min: [1, 'Order must be at least 1']
  },
  label: {
    type: String,
    trim: true,
    // Optional label like "Period 1", "Break", "Lunch"
  },
  isBreak: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number,
    // Duration in minutes (auto-calculated)
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
timeSlotSchema.index({ order: 1 });
timeSlotSchema.index({ isActive: 1 });

// Virtual to get formatted time range
timeSlotSchema.virtual('timeRange').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

// Pre-save hook to calculate duration
timeSlotSchema.pre('save', function () {
  if (!this.startTime || !this.endTime) return;

  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes <= startMinutes) {
    throw new Error('End time must be after start time');
  }

  this.duration = endMinutes - startMinutes;
});


// Static method to get all active time slots sorted by order
timeSlotSchema.statics.getActiveSlots = function() {
  return this.find({ isActive: true }).sort({ order: 1 });
};

// Static method to check for overlapping time slots
timeSlotSchema.statics.checkOverlap = async function(startTime, endTime, excludeId = null) {
  const [newStartHour, newStartMin] = startTime.split(':').map(Number);
  const [newEndHour, newEndMin] = endTime.split(':').map(Number);
  
  const newStartMinutes = newStartHour * 60 + newStartMin;
  const newEndMinutes = newEndHour * 60 + newEndMin;
  
  const query = { isActive: true };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const existingSlots = await this.find(query);
  
  for (const slot of existingSlots) {
    const [existingStartHour, existingStartMin] = slot.startTime.split(':').map(Number);
    const [existingEndHour, existingEndMin] = slot.endTime.split(':').map(Number);
    
    const existingStartMinutes = existingStartHour * 60 + existingStartMin;
    const existingEndMinutes = existingEndHour * 60 + existingEndMin;
    
    // Check for overlap
    if (
      (newStartMinutes >= existingStartMinutes && newStartMinutes < existingEndMinutes) ||
      (newEndMinutes > existingStartMinutes && newEndMinutes <= existingEndMinutes) ||
      (newStartMinutes <= existingStartMinutes && newEndMinutes >= existingEndMinutes)
    ) {
      return {
        overlap: true,
        conflictingSlot: slot
      };
    }
  }
  
  return { overlap: false };
};

// Enable virtuals in JSON
timeSlotSchema.set('toJSON', { virtuals: true });
timeSlotSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TimeSlot', timeSlotSchema);