const Class = require("../models/Class.js");

// ➕ Create Class
exports.createClass = async (req, res) => {
    try {
        const newClass = await Class.create(req.body);
        res.status(201).json(newClass);
    } catch (error) {
        console.error("CREATE CLASS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};

// 📄 Get All Classes
exports.getAllClasses = async (req, res) => {
    try {
        const classes = await Class.find()
            .populate("courseIds") // ✅ EXACT match
            .sort({ createdAt: -1 });

        res.json(classes);
    } catch (error) {
        console.error("GET CLASSES ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};

// 📄 Get Class by ID
exports.getClassById = async (req, res) => {
    try {
        const classData = await Class.findById(req.params.id)
            .populate("courseIds", "name"); // only name needed

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found",
            });
        }

        res.status(200).json(classData);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const classs = await Class.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({ success: true, data: classs });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status" });
  }
};

// ✏️ Update Class
exports.updateClass = async (req, res) => {
    try {
        const updated = await Class.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Class not found" });
        }

        res.json(updated);
    } catch (error) {
        console.error("UPDATE CLASS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};

// 🗑️ Delete Class
exports.deleteClass = async (req, res) => {
    try {
        const deleted = await Class.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Class not found" });
        }

        res.json({ message: "Class deleted successfully" });
    } catch (error) {
        console.error("DELETE CLASS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};
