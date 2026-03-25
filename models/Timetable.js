const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classes',
    required: [true, 'Class is required'],
    index: true
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: {
      values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      message: '{VALUE} is not a valid day'
    },
    index: true
  },
  timeSlotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeSlot',
    required: [true, 'Time slot is required'],
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: [true, 'Course is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'teachers',
    required: [true, 'Teacher is required'],
    index: true
  },
  room: {
    type: String,
    trim: true,
    // Optional room/location
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    // Format: "2024-2025"
    match: [/^\d{4}-\d{4}$/, 'Academic year format should be YYYY-YYYY']
  },
  semester: {
    type: String,
    enum: ['Spring', 'Fall', 'Summer'],
    // Optional semester field
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound indexes for performance optimization
timetableSchema.index({ classId: 1, day: 1, academicYear: 1 });
timetableSchema.index({ teacherId: 1, day: 1, academicYear: 1 });
timetableSchema.index({ day: 1, timeSlotId: 1, academicYear: 1 });
timetableSchema.index({ academicYear: 1, isActive: 1 });

// Unique compound index to prevent duplicate entries
timetableSchema.index(
  { classId: 1, day: 1, timeSlotId: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Static method to check teacher conflict
timetableSchema.statics.checkTeacherConflict = async function (teacherId, day, timeSlotId, academicYear, excludeId = null) {
  const query = {
    teacherId,
    day,
    timeSlotId,
    academicYear,
    isActive: true
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await this.findOne(query)
    .populate('classId', 'name')
    .populate('courseId', 'name')
    .populate('teacherId', 'firstName lastName')
    .populate('timeSlotId', 'startTime endTime');

  return conflict;
};

// Static method to check class conflict
timetableSchema.statics.checkClassConflict = async function (classId, day, timeSlotId, academicYear, excludeId = null) {
  const query = {
    classId,
    day,
    timeSlotId,
    academicYear,
    isActive: true
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await this.findOne(query)
    .populate('teacherId', 'firstName lastName')
    .populate('courseId', 'name')
    .populate('timeSlotId', 'startTime endTime');

  return conflict;
};

// Static method to get weekly schedule for a class
timetableSchema.statics.getWeeklyScheduleByClass = async function (classId, academicYear) {
  const schedule = await this.find({
    classId,
    academicYear,
    isActive: true
  })
    .populate('timeSlotId', 'startTime endTime order label isBreak')
    .populate('courseId', 'name code')
    .populate('teacherId', 'firstName lastName email')
    .populate('classId', 'name')
    .sort({ day: 1, 'timeSlotId.order': 1 });

  return schedule;
};

// Static method to get teacher's schedule
timetableSchema.statics.getTeacherSchedule = async function (teacherId, academicYear, day = null) {
  const query = {
    teacherId,
    academicYear,
    isActive: true
  };

  if (day) {
    query.day = day;
  }

  const schedule = await this.find(query)
    .populate('timeSlotId', 'startTime endTime order label')
    .populate('courseId', 'name code')
    .populate('classId', 'name section')
    .sort({ day: 1, 'timeSlotId.order': 1 });

  return schedule;
};

// Static method to get today's schedule
timetableSchema.statics.getTodaySchedule = async function (filter, academicYear) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];

  const query = {
    day: today,
    academicYear,
    isActive: true,
    ...filter
  };

  const schedule = await this.find(query)
    .populate('timeSlotId', 'startTime endTime order label isBreak')
    .populate('courseId', 'name code')
    .populate('teacherId', 'firstName lastName')
    .populate('classId', 'name')
    .sort({ 'timeSlotId.order': 1 });

  return schedule;
};

// Instance method to get formatted schedule info
timetableSchema.methods.getFormattedInfo = function () {
  return {
    id: this._id,
    day: this.day,
    time: this.timeSlotId ? `${this.timeSlotId.startTime} - ${this.timeSlotId.endTime}` : '',
    course: this.courseId ? this.courseId.name : '',
    teacher: this.teacherId ? `${this.teacherId.firstName} ${this.teacherId.lastName}` : '',
    class: this.classId ? this.classId.name : '',
    room: this.room || 'N/A',
    academicYear: this.academicYear
  };
};

// Static method to bulk create timetable entries
timetableSchema.statics.bulkCreateSchedule = async function (entries, academicYear) {
  const results = {
    created: [],
    conflicts: [],
    errors: []
  };

  for (const entry of entries) {
    try {
      // Check for conflicts
      const teacherConflict = await this.checkTeacherConflict(
        entry.teacherId,
        entry.day,
        entry.timeSlotId,
        academicYear
      );

      if (teacherConflict) {
        results.conflicts.push({
          entry,
          reason: 'Teacher already has a class at this time',
          conflict: teacherConflict
        });
        continue;
      }

      const classConflict = await this.checkClassConflict(
        entry.classId,
        entry.day,
        entry.timeSlotId,
        academicYear
      );

      if (classConflict) {
        results.conflicts.push({
          entry,
          reason: 'Class already has a lecture at this time',
          conflict: classConflict
        });
        continue;
      }

      // Create entry
      const newEntry = await this.create({ ...entry, academicYear });
      results.created.push(newEntry);

    } catch (error) {
      results.errors.push({
        entry,
        error: error.message
      });
    }
  }

  return results;
};

// Pre-save validation hook
// Pre-save validation hook (modern version)
timetableSchema.pre('save', async function () {
  // Only run on new documents or when key fields change
  if (
    this.isNew ||
    this.isModified('teacherId') ||
    this.isModified('day') ||
    this.isModified('timeSlotId') ||
    this.isModified('classId')
  ) {

    // Check teacher conflict
    const teacherConflict = await this.constructor.checkTeacherConflict(
      this.teacherId,
      this.day,
      this.timeSlotId,
      this.academicYear,
      this._id
    );

    if (teacherConflict) {
      const error = new Error(
        `Teacher conflict: ${teacherConflict.teacherId?.firstName || ''
        } ${teacherConflict.teacherId?.lastName || ''
        } is already teaching ${teacherConflict.courseId?.name || 'Unknown Course'
        } to ${teacherConflict.classId?.name || 'Unknown Class'
        } at ${teacherConflict.timeSlotId?.startTime || ''
        }-${teacherConflict.timeSlotId?.endTime || ''
        } on ${this.day}`
      );
      error.name = 'TeacherConflict';
      throw error;
    }

    // Check class conflict
    const classConflict = await this.constructor.checkClassConflict(
      this.classId,
      this.day,
      this.timeSlotId,
      this.academicYear,
      this._id
    );

    if (classConflict) {
      const error = new Error(
        `Class conflict: This class already has with ${classConflict.teacherId.firstName} ${classConflict.teacherId.lastName} at ${classConflict.timeSlotId.startTime}-${classConflict.timeSlotId.endTime} on ${this.day}`
      );
      error.name = 'ClassConflict';
      throw error;
    }
  }
});


module.exports = mongoose.model('Timetable', timetableSchema);