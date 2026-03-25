const Course = require("../models/Course.js");

exports.createCourse = async (req, res) => {
    try {
        const {
            name,
            code,
            type,
            status,
            description,
            weeklyHours,
            classId,
        } = req.body;

        if (!name || !code || !type) {
            return res.status(400).json({
                message: "Name, code and type are required",
            });
        }

        const existing = await Course.findOne({ code });
        if (existing) {
            return res.status(409).json({
                message: "Course code already exists",
            });
        }

        const course = await Course.create({
            name,
            code,
            type,
            status,
            description,
            weeklyHours,
            classId: classId || null,
        });

        res.status(201).json({
            success: true,
            data: course,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to create course",
        });
    }
};

exports.getAllCourses = async (req, res) => {
    try {

        const courses = await Course.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: courses.length,
            data: courses,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to get course",
        });
    }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status" });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};

    if (search) {
      query.name = {
        $regex: search,
        $options: "i", // case-insensitive
      };
    }

    const courses = await Course.find(query)
      .select("name status") // keep response light
      .limit(10)             // IMPORTANT for large datasets
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const data = { ...req.body };

    // normalize classId
    if (!data.classId) {
      data.classId = null;
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("UPDATE COURSE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("DELETE COURSE ERROR:", error);
    res.status(500).json({ message: "Failed to delete course" });
  }
};