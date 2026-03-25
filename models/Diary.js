const mongoose = require("mongoose");

// Attachment sub-schema (PDF or image)
const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true }, // application/pdf | image/*
  size: { type: Number, default: 0 },
  path: { type: String, required: true },
  type: { type: String, enum: ["pdf", "image"], required: true },
});

const diarySchema = new mongoose.Schema(
  {
    // Who created this entry
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teachers",
      required: true,
    },

    // ── Scope ────────────────────────────────────────────────────
    // "class"   → all students in a class
    // "student" → one specific student
    scope: {
      type: String,
      enum: ["class", "student"],
      required: true,
      default: "class",
    },

    // required when scope === "class" or scope === "student"
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "classes",
      default: null,
    },

    // required only when scope === "student"
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "students",
      default: null,
    },

    // ── Content ──────────────────────────────────────────────────
    type: {
      type: String,
      enum: ["diary", "material"],
      required: true,
      default: "diary",
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Homework / task text (mainly for diary)
    homework: {
      type: String,
      trim: true,
      default: "",
    },

    // Study material subject label
    subject: {
      type: String,
      trim: true,
      default: "",
    },

    // Date this diary entry is for
    date: {
      type: Date,
      default: Date.now,
    },

    // ── Attachments ──────────────────────────────────────────────
    attachments: [attachmentSchema],

    // ── Status ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Published", "Draft"],
      default: "Published",
    },

    academicYear: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes for fast querying
diarySchema.index({ teacherId: 1, classId: 1, date: -1 });
diarySchema.index({ teacherId: 1, studentId: 1, date: -1 });
diarySchema.index({ classId: 1, type: 1, date: -1 });

module.exports = mongoose.model("diaries", diarySchema);