const Timetable = require('../models/Timetable');
const TimeSlot = require('../models/TimeSlot');
const Holiday = require('../models/Holiday');

/**
 * @desc    Create timetable entry
 * @route   POST /api/timetable/entries
 * @access  Admin
 */
exports.createTimetableEntry = async (req, res) => {
  try {
    const {
      classId,
      day,
      timeSlotId,
      courseId,
      teacherId,
      room,
      academicYear,
      semester,
      notes
    } = req.body;
    
    // Validate required fields
    if (!classId || !day || !timeSlotId || !courseId || !teacherId || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Class, day, time slot, subject, teacher, and academic year are required'
      });
    }
    
    // Verify time slot exists and is active
    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (!timeSlot || !timeSlot.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive time slot'
      });
    }
    
    // Create entry (validation handled in pre-save hook)
    const entry = await Timetable.create({
      classId,
      day,
      timeSlotId,
      courseId,
      teacherId,
      room,
      academicYear,
      semester,
      notes
    });
    
    // Populate and return
    const populatedEntry = await Timetable.findById(entry._id)
      .populate('timeSlotId', 'startTime endTime order label')
      .populate('courseId', 'name code')
      .populate('teacherId', 'firstName lastName email')
      .populate('classId', 'name');

    res.status(201).json({
      success: true,
      message: 'Timetable entry created successfully',
      data: populatedEntry
    });
    
  } catch (error) {
    console.error('Create timetable entry error:', error);
    
    // Handle conflict errors
    if (error.name === 'TeacherConflict' || error.name === 'ClassConflict') {
      return res.status(409).json({
        success: false,
        message: error.message,
        conflictType: error.name
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A timetable entry already exists for this class at this time'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create timetable entry'
    });
  }
};

/**
 * @desc    Update timetable entry
 * @route   PUT /api/timetable/entries/:id
 * @access  Admin
 */
exports.updateTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }
    
    const allowedUpdates = ['subjectId', 'teacherId', 'room', 'notes', 'day', 'timeSlotId', 'isActive'];
    const updates = Object.keys(req.body);
    
    updates.forEach(update => {
      if (allowedUpdates.includes(update)) {
        entry[update] = req.body[update];
      }
    });
    
    await entry.save(); // Will trigger validation hooks
    
    const updatedEntry = await Timetable.findById(entry._id)
      .populate('timeSlotId', 'startTime endTime order label')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'firstName lastName email')
      .populate('classId', 'name');

    res.status(200).json({
      success: true,
      message: 'Timetable entry updated successfully',
      data: updatedEntry
    });
    
  } catch (error) {
    console.error('Update timetable entry error:', error);
    
    if (error.name === 'TeacherConflict' || error.name === 'ClassConflict') {
      return res.status(409).json({
        success: false,
        message: error.message,
        conflictType: error.name
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update timetable entry'
    });
  }
};

/**
 * @desc    Delete timetable entry
 * @route   DELETE /api/timetable/entries/:id
 * @access  Admin
 */
exports.deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findByIdAndDelete(req.params.id);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Timetable entry deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete timetable entry'
    });
  }
};

/**
 * @desc    Get weekly timetable by class
 * @route   GET /api/timetable/class/:classId/:sectionId
 * @access  Admin, Teacher, Student
 */
exports.getWeeklyTimetableByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear } = req.query;
    console.log(academicYear);
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const schedule = await Timetable.getWeeklyScheduleByClass(classId, academicYear);
    
    // Group by day
    const groupedSchedule = schedule.reduce((acc, entry) => {
      if (!acc[entry.day]) {
        acc[entry.day] = [];
      }
      acc[entry.day].push(entry);
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: {
        schedule: groupedSchedule,
        raw: schedule
      }
    });
    
  } catch (error) {
    console.error('Get weekly timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly timetable'
    });
  }
};

/**
 * @desc    Get teacher's weekly schedule
 * @route   GET /api/timetable/teacher/:teacherId
 * @access  Admin, Teacher
 */
exports.getTeacherSchedule = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYear, day } = req.query;
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const schedule = await Timetable.getTeacherSchedule(teacherId, academicYear, day);
    
    // Group by day if getting full week
    if (!day) {
      const groupedSchedule = schedule.reduce((acc, entry) => {
        if (!acc[entry.day]) {
          acc[entry.day] = [];
        }
        acc[entry.day].push(entry);
        return acc;
      }, {});
      
      return res.status(200).json({
        success: true,
        data: {
          schedule: groupedSchedule,
          raw: schedule
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: schedule
    });
    
  } catch (error) {
    console.error('Get teacher schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher schedule'
    });
  }
};

/**
 * @desc    Get today's schedule for class
 * @route   GET /api/timetable/today/class/:classId/:sectionId
 * @access  Admin, Teacher, Student
 */
exports.getTodayScheduleForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear } = req.query;
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const schedule = await Timetable.getTodaySchedule(
      { classId },
      academicYear
    );
    
    // Get current time to determine current and next period
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    let currentPeriod = null;
    let nextPeriod = null;
    
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i];
      if (!entry.timeSlotId) continue;
      
      const [startHour, startMin] = entry.timeSlotId.startTime.split(':').map(Number);
      const [endHour, endMin] = entry.timeSlotId.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes) {
        currentPeriod = entry;
        if (i + 1 < schedule.length) {
          nextPeriod = schedule[i + 1];
        }
        break;
      } else if (currentTimeMinutes < startMinutes && !nextPeriod) {
        nextPeriod = entry;
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        schedule,
        currentPeriod,
        nextPeriod
      }
    });
    
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s schedule'
    });
  }
};

/**
 * @desc    Get today's schedule for teacher
 * @route   GET /api/timetable/today/teacher/:teacherId
 * @access  Admin, Teacher
 */
exports.getTodayScheduleForTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYear } = req.query;
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const schedule = await Timetable.getTodaySchedule(
      { teacherId },
      academicYear
    );
    
    // Determine current and next lecture
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    let currentLecture = null;
    let nextLecture = null;
    
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i];
      if (!entry.timeSlotId) continue;
      
      const [startHour, startMin] = entry.timeSlotId.startTime.split(':').map(Number);
      const [endHour, endMin] = entry.timeSlotId.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes) {
        currentLecture = entry;
        if (i + 1 < schedule.length) {
          nextLecture = schedule[i + 1];
        }
        break;
      } else if (currentTimeMinutes < startMinutes && !nextLecture) {
        nextLecture = entry;
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        schedule,
        currentLecture,
        nextLecture
      }
    });
    
  } catch (error) {
    console.error('Get today teacher schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s schedule'
    });
  }
};

/**
 * @desc    Bulk create timetable entries
 * @route   POST /api/timetable/entries/bulk
 * @access  Admin
 */
exports.bulkCreateTimetable = async (req, res) => {
  try {
    const { entries, academicYear } = req.body;
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Entries array is required'
      });
    }
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const results = await Timetable.bulkCreateSchedule(entries, academicYear);
    
    res.status(201).json({
      success: true,
      message: `Created ${results.created.length} entries. ${results.conflicts.length} conflicts. ${results.errors.length} errors.`,
      data: results
    });
    
  } catch (error) {
    console.error('Bulk create timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk create timetable entries'
    });
  }
};

/**
 * @desc    Copy timetable from one academic year to another
 * @route   POST /api/timetable/copy
 * @access  Admin
 */
exports.copyTimetable = async (req, res) => {
  try {
    const { sourceAcademicYear, targetAcademicYear, classId, sectionId } = req.body;
    
    if (!sourceAcademicYear || !targetAcademicYear) {
      return res.status(400).json({
        success: false,
        message: 'Source and target academic years are required'
      });
    }
    
    const query = {
      academicYear: sourceAcademicYear,
      isActive: true
    };
    
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
    
    const sourceTimetable = await Timetable.find(query);
    
    if (sourceTimetable.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No timetable found for the source academic year'
      });
    }
    
    const newEntries = sourceTimetable.map(entry => ({
      classId: entry.classId,
      sectionId: entry.sectionId,
      day: entry.day,
      timeSlotId: entry.timeSlotId,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      room: entry.room,
      semester: entry.semester,
      notes: entry.notes
    }));
    
    const results = await Timetable.bulkCreateSchedule(newEntries, targetAcademicYear);
    
    res.status(201).json({
      success: true,
      message: `Copied timetable successfully. Created ${results.created.length} entries.`,
      data: results
    });
    
  } catch (error) {
    console.error('Copy timetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to copy timetable'
    });
  }
};

/**
 * @desc    Get all timetable entries with filters
 * @route   GET /api/timetable/entries
 * @access  Admin
 */
exports.getAllTimetableEntries = async (req, res) => {
  try {
    const { academicYear, classId, sectionId, teacherId, day, subjectId } = req.query;
    
    const query = { isActive: true };
    
    if (academicYear) query.academicYear = academicYear;
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
    if (teacherId) query.teacherId = teacherId;
    if (day) query.day = day;
    if (subjectId) query.subjectId = subjectId;
    
    const entries = await Timetable.find(query)
      .populate('timeSlotId', 'startTime endTime order label')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'firstName lastName email')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .sort({ day: 1, 'timeSlotId.order': 1 });
    
    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries
    });
    
  } catch (error) {
    console.error('Get all timetable entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable entries'
    });
  }
};

/**
 * @desc    Check for conflicts before creating entry
 * @route   POST /api/timetable/check-conflict
 * @access  Admin
 */
exports.checkConflict = async (req, res) => {
  try {
    const { teacherId, classId, sectionId, day, timeSlotId, academicYear } = req.body;
    
    const conflicts = {
      teacherConflict: null,
      classConflict: null
    };
    
    if (teacherId && day && timeSlotId && academicYear) {
      conflicts.teacherConflict = await Timetable.checkTeacherConflict(
        teacherId, day, timeSlotId, academicYear
      );
    }
    
    if (classId && sectionId && day && timeSlotId && academicYear) {
      conflicts.classConflict = await Timetable.checkClassConflict(
        classId, sectionId, day, timeSlotId, academicYear
      );
    }
    
    const hasConflict = conflicts.teacherConflict || conflicts.classConflict;
    
    res.status(200).json({
      success: true,
      hasConflict,
      conflicts
    });
    
  } catch (error) {
    console.error('Check conflict error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check conflicts'
    });
  }
};