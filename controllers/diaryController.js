const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Diary = require("../models/Diary");
const Timetable = require("../models/Timetable");
const Student = require("../models/Student");

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const deleteFile = (filePath) => {
  if (!filePath) return;
  const full = path.join(__dirname, "..", filePath.replace(/\\/g, "/"));
  if (fs.existsSync(full)) fs.unlinkSync(full);
};

const buildAttachments = (files) => {
  if (!files || !files.length) return [];
  return files.map((f) => ({
    filename: f.filename,
    originalName: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    path: f.path.replace(/\\/g, "/"),
    type: f.mimetype === "application/pdf" ? "pdf" : "image",
  }));
};

// ─────────────────────────────────────────────
// CREATE DIARY / MATERIAL
// ─────────────────────────────────────────────

exports.createDiary = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const {
      scope,
      classId,
      studentId,
      type,
      title,
      description,
      homework,
      subject,
      date,
      status,
      academicYear,
    } = req.body;

    // Validation
    if (!scope || !["class", "student"].includes(scope)) {
      return res.status(400).json({ success: false, message: "scope must be 'class' or 'student'" });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (scope === "class" && !classId) {
      return res.status(400).json({ success: false, message: "classId is required for class scope" });
    }
    if (scope === "student" && !studentId) {
      return res.status(400).json({ success: false, message: "studentId is required for student scope" });
    }

    // Verify teacher is assigned to the class
    // if (classId) {
    //   const assigned = await Timetable.findOne({ teacherId, classId, isActive: true });
    //   if (!assigned) {
    //     return res.status(403).json({ success: false, message: "Not assigned to this class" });
    //   }
    // }

    const attachments = buildAttachments(req.files);

    const diary = await Diary.create({
      teacherId,
      scope,
      classId: classId || null,
      studentId: studentId || null,
      type: type || "diary",
      title,
      description,
      homework,
      subject,
      date: date ? new Date(date) : new Date(),
      attachments,
      status: status || "Published",
      academicYear: academicYear || "",
    });

    const populated = await diary.populate([
      { path: "classId", select: "name section" },
      { path: "studentId", select: "firstName lastName rollNumber" },
    ]);

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("CREATE DIARY ERROR:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors).map((e) => e.message).join(", "),
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET ALL (for teacher — paginated + filtered)
// ─────────────────────────────────────────────

exports.getDiaries = async (req, res) => {
  try {
    const { page = 1, limit = 12, type, scope, classId, status, dateFrom, dateTo, myOnly } = req.query;

    const query = {};

    // 👇 if teacher, only show their own entries
    if (myOnly === "true") {
      query.teacherId = new mongoose.Types.ObjectId(req.user._id);
    }

    if (type) query.type = type;
    if (scope) query.scope = scope;
    if (classId) query.classId = new mongoose.Types.ObjectId(classId);
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    const total = await Diary.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const data = await Diary.find(query)
      .populate("classId", "name section")
      .populate("studentId", "firstName lastName rollNumber")
      .populate("teacherId", "firstName lastName")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data, pagination: { total, pages, page: Number(page) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────

exports.getDiaryById = async (req, res) => {
  try {
    const diary = await Diary.findById(req.params.id)
      .populate("classId", "name section")
      .populate("studentId", "firstName lastName rollNumber profilePic")
      .populate("teacherId", "firstName lastName");

    if (!diary) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    res.json({ success: true, data: diary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET FOR STUDENT (student portal)
// ─────────────────────────────────────────────

exports.getDiariesForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type, page = 1, limit = 15, dateFrom, dateTo } = req.query;

    // Get student's class
    const student = await Student.findById(studentId).select("class");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const orQuery = [
      { scope: "class", classId: student.class },
      { scope: "student", studentId: new mongoose.Types.ObjectId(studentId) },
    ];

    const query = { $or: orQuery, status: "Published" };
    if (type) query.type = type;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    const total = await Diary.countDocuments(query);
    const entries = await Diary.find(query)
      .populate("teacherId", "firstName lastName")
      .populate("classId", "name section")
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: entries,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

exports.updateDiary = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const diary = await Diary.findOne({ _id: req.params.id, teacherId });

    if (!diary) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const allowed = ["title", "description", "homework", "subject", "date", "status", "academicYear"];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) diary[f] = req.body[f];
    });

    // Append new attachments if uploaded
    if (req.files && req.files.length > 0) {
      diary.attachments.push(...buildAttachments(req.files));
    }

    await diary.save();

    const populated = await diary.populate([
      { path: "classId", select: "name section" },
      { path: "studentId", select: "firstName lastName rollNumber" },
    ]);

    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE ATTACHMENT
// ─────────────────────────────────────────────

exports.deleteAttachment = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const { id, attachmentId } = req.params;

    const diary = await Diary.findOne({ _id: id, teacherId });
    if (!diary) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const att = diary.attachments.id(attachmentId);
    if (!att) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    deleteFile(att.path);
    att.deleteOne();
    await diary.save();

    res.json({ success: true, message: "Attachment deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

exports.deleteDiary = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user._id);
    const diary = await Diary.findOne({ _id: req.params.id, teacherId });

    if (!diary) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    // Delete all attached files
    diary.attachments.forEach((a) => deleteFile(a.path));
    await diary.deleteOne();

    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────

exports.getDiaryById = async (req, res) => {
  try {
    const diary = await Diary.findById(req.params.id)
      .populate("classId", "name section")
      .populate("studentId", "firstName lastName rollNumber profilePic")
      .populate("teacherId", "firstName lastName");

    if (!diary) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    res.json({ success: true, data: diary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET FOR STUDENT (student portal)
// ─────────────────────────────────────────────

exports.getDiariesForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type, page = 1, limit = 15, dateFrom, dateTo } = req.query;

    const student = await Student.findById(studentId).select("class");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const orQuery = [
      { scope: "class",   classId: student.class },
      { scope: "student", studentId: new mongoose.Types.ObjectId(studentId) },
    ];

    const query = { $or: orQuery, status: "Published" };
    if (type) query.type = type;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo)   query.date.$lte = new Date(dateTo);
    }

    const total = await Diary.countDocuments(query);
    const entries = await Diary.find(query)
      .populate("teacherId", "firstName lastName")
      .populate("classId",   "name section")
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page:  Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// ─────────────────────────────────────────────
// STATS (for dashboard widget)
// ─────────────────────────────────────────────

exports.getDiaryStats = async (req, res) => {
  try {
    const { myOnly } = req.query;
    const matchBase = {};

    // 👇 scope stats to teacher if not admin
    if (myOnly === "true") {
      matchBase.teacherId = new mongoose.Types.ObjectId(req.user._id);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [totalDiary, totalMaterial, todayCount] = await Promise.all([
      Diary.countDocuments({ ...matchBase, type: "diary" }),
      Diary.countDocuments({ ...matchBase, type: "material" }),
      Diary.countDocuments({ ...matchBase, date: { $gte: todayStart, $lte: todayEnd } }),
    ]);

    res.json({ success: true, data: { totalDiary, totalMaterial, todayCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};