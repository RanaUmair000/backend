const TimeSlot = require('../models/TimeSlot');

/**
 * @desc    Create a new time slot
 * @route   POST /api/timetable/timeslots
 * @access  Admin
 */
exports.createTimeSlot = async (req, res) => {
  try {
    const { startTime, endTime, order, label, isBreak } = req.body;
    
    // Validate required fields
    if (!startTime || !endTime || !order) {
      return res.status(400).json({
        success: false,
        message: 'Start time, end time, and order are required'
      });
    }
    
    // Check for overlapping time slots
    const overlapCheck = await TimeSlot.checkOverlap(startTime, endTime);
    
    if (overlapCheck.overlap) {
      return res.status(400).json({
        success: false,
        message: `Time slot overlaps with existing slot: ${overlapCheck.conflictingSlot.timeRange}`,
        conflict: overlapCheck.conflictingSlot
      });
    }
    
    // Check if order already exists
    const existingOrder = await TimeSlot.findOne({ order, isActive: true });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: `Order ${order} is already assigned to time slot: ${existingOrder.timeRange}`
      });
    }
    
    const timeSlot = await TimeSlot.create({
      startTime,
      endTime,
      order,
      label,
      isBreak: isBreak || false
    });
    
    res.status(201).json({
      success: true,
      message: 'Time slot created successfully',
      data: timeSlot
    });
    
  } catch (error) {
    console.error('Create time slot error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create time slot'
    });
  }
};

/**
 * @desc    Get all time slots
 * @route   GET /api/timetable/timeslots
 * @access  Admin, Teacher, Student
 */
exports.getAllTimeSlots = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const timeSlots = await TimeSlot.find(query).sort({ order: 1 });
    
    res.status(200).json({
      success: true,
      count: timeSlots.length,
      data: timeSlots
    });
    
  } catch (error) {
    console.error('Get time slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time slots'
    });
  }
};

/**
 * @desc    Get active time slots only
 * @route   GET /api/timetable/timeslots/active
 * @access  Admin, Teacher, Student
 */
exports.getActiveTimeSlots = async (req, res) => {
  try {
    const timeSlots = await TimeSlot.getActiveSlots();
    
    res.status(200).json({
      success: true,
      count: timeSlots.length,
      data: timeSlots
    });
    
  } catch (error) {
    console.error('Get active time slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active time slots'
    });
  }
};

/**
 * @desc    Get single time slot
 * @route   GET /api/timetable/timeslots/:id
 * @access  Admin
 */
exports.getTimeSlot = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findById(req.params.id);
    
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: timeSlot
    });
    
  } catch (error) {
    console.error('Get time slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time slot'
    });
  }
};

/**
 * @desc    Update time slot
 * @route   PUT /api/timetable/timeslots/:id
 * @access  Admin
 */
exports.updateTimeSlot = async (req, res) => {
  try {
    const { startTime, endTime, order, label, isBreak, isActive } = req.body;
    
    const timeSlot = await TimeSlot.findById(req.params.id);
    
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }
    
    // If updating time, check for overlaps
    if ((startTime && startTime !== timeSlot.startTime) || 
        (endTime && endTime !== timeSlot.endTime)) {
      const newStartTime = startTime || timeSlot.startTime;
      const newEndTime = endTime || timeSlot.endTime;
      
      const overlapCheck = await TimeSlot.checkOverlap(newStartTime, newEndTime, req.params.id);
      
      if (overlapCheck.overlap) {
        return res.status(400).json({
          success: false,
          message: `Time slot overlaps with existing slot: ${overlapCheck.conflictingSlot.timeRange}`,
          conflict: overlapCheck.conflictingSlot
        });
      }
    }
    
    // If updating order, check if new order is available
    if (order && order !== timeSlot.order) {
      const existingOrder = await TimeSlot.findOne({ 
        order, 
        isActive: true,
        _id: { $ne: req.params.id }
      });
      
      if (existingOrder) {
        return res.status(400).json({
          success: false,
          message: `Order ${order} is already assigned to another time slot`
        });
      }
    }
    
    // Update fields
    if (startTime) timeSlot.startTime = startTime;
    if (endTime) timeSlot.endTime = endTime;
    if (order) timeSlot.order = order;
    if (label !== undefined) timeSlot.label = label;
    if (isBreak !== undefined) timeSlot.isBreak = isBreak;
    if (isActive !== undefined) timeSlot.isActive = isActive;
    
    await timeSlot.save();
    
    res.status(200).json({
      success: true,
      message: 'Time slot updated successfully',
      data: timeSlot
    });
    
  } catch (error) {
    console.error('Update time slot error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update time slot'
    });
  }
};

/**
 * @desc    Delete time slot (soft delete)
 * @route   DELETE /api/timetable/timeslots/:id
 * @access  Admin
 */
exports.deleteTimeSlot = async (req, res) => {
  try {
    const deleted = await TimeSlot.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Time slot permanently deleted'
    });

  } catch (error) {
    console.error('Delete time slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete time slot'
    });
  }
};


/**
 * @desc    Permanently delete time slot
 * @route   DELETE /api/timetable/timeslots/:id/permanent
 * @access  Admin
 */
exports.permanentDeleteTimeSlot = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findByIdAndDelete(req.params.id);
    
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Time slot permanently deleted'
    });
    
  } catch (error) {
    console.error('Permanent delete time slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete time slot'
    });
  }
};

/**
 * @desc    Bulk create time slots
 * @route   POST /api/timetable/timeslots/bulk
 * @access  Admin
 */
exports.bulkCreateTimeSlots = async (req, res) => {
  try {
    const { timeSlots } = req.body;
    
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Time slots array is required'
      });
    }
    
    const results = {
      created: [],
      errors: []
    };
    
    for (const slot of timeSlots) {
      try {
        const createdSlot = await TimeSlot.create(slot);
        results.created.push(createdSlot);
      } catch (error) {
        results.errors.push({
          slot,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: `Created ${results.created.length} time slots`,
      data: {
        created: results.created,
        errors: results.errors
      }
    });
    
  } catch (error) {
    console.error('Bulk create time slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk create time slots'
    });
  }
};