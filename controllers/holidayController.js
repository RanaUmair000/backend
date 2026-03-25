const Holiday = require('../models/Holiday');

/**
 * @desc    Create holiday
 * @route   POST /api/timetable/holidays
 * @access  Admin
 */
exports.createHoliday = async (req, res) => {
  try {
    const { name, date, type, description, academicYear } = req.body;
    
    if (!name || !date || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Name, date, and academic year are required'
      });
    }
    
    const holiday = await Holiday.create({
      name,
      date,
      type,
      description,
      academicYear
    });
    
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: holiday
    });
    
  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create holiday'
    });
  }
};

/**
 * @desc    Get all holidays
 * @route   GET /api/timetable/holidays
 * @access  Admin, Teacher, Student
 */
exports.getAllHolidays = async (req, res) => {
  try {
    const { academicYear, type, upcoming } = req.query;
    
    const query = { isActive: true };
    
    if (academicYear) query.academicYear = academicYear;
    if (type) query.type = type;
    
    let holidays;
    
    if (upcoming === 'true') {
      holidays = await Holiday.getUpcomingHolidays(academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1));
    } else {
      holidays = await Holiday.find(query).sort({ date: 1 });
    }
    
    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
    
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch holidays'
    });
  }
};

/**
 * @desc    Check if date is holiday
 * @route   GET /api/timetable/holidays/check/:date
 * @access  Admin, Teacher, Student
 */
exports.checkHoliday = async (req, res) => {
  try {
    const { date } = req.params;
    const { academicYear } = req.query;
    
    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Academic year is required'
      });
    }
    
    const holiday = await Holiday.isHoliday(new Date(date), academicYear);
    
    res.status(200).json({
      success: true,
      isHoliday: !!holiday,
      holiday: holiday || null
    });
    
  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check holiday'
    });
  }
};

/**
 * @desc    Update holiday
 * @route   PUT /api/timetable/holidays/:id
 * @access  Admin
 */
exports.updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    const allowedUpdates = ['name', 'date', 'type', 'description', 'isActive'];
    const updates = Object.keys(req.body);
    
    updates.forEach(update => {
      if (allowedUpdates.includes(update)) {
        holiday[update] = req.body[update];
      }
    });
    
    await holiday.save();
    
    res.status(200).json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
    
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update holiday'
    });
  }
};

/**
 * @desc    Delete holiday
 * @route   DELETE /api/timetable/holidays/:id
 * @access  Admin
 */
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete holiday'
    });
  }
};

/**
 * @desc    Bulk create holidays
 * @route   POST /api/timetable/holidays/bulk
 * @access  Admin
 */
exports.bulkCreateHolidays = async (req, res) => {
  try {
    const { holidays } = req.body;
    
    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Holidays array is required'
      });
    }
    
    const createdHolidays = await Holiday.insertMany(holidays);
    
    res.status(201).json({
      success: true,
      message: `Created ${createdHolidays.length} holidays`,
      data: createdHolidays
    });
    
  } catch (error) {
    console.error('Bulk create holidays error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk create holidays'
    });
  }
};