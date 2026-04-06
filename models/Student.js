const mongoose = require("mongoose");

// Courses
const courseSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
  },
  courseName: { type: String },
  grade: {
    type: String,
    enum: ["A", "B", "C", "D", "F", "Pass", "Fail"],
    default: "Pass",
  },
  semester: { type: String },
});

// Address (NOT hard-required anymore)
const addressSchema = new mongoose.Schema({
  street: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  zipCode: { type: String, default: "" },
  country: { type: String, default: "" },
});

// Guardian (NOT hard-required anymore)
const guardianSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
});

// Student
const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: false },

  dateOfBirth: { type: String, required: false },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: true,
  },

  rollNumber: { type: String, required: true },
  password: { type: String, required: true },
  class: { type: String, ref: 'classes', required: true },
  fee: { type: String, required: false },
  feePlan: {type: String},
  section: { type: String, required: false },

  address: {
    type: addressSchema,
    default: () => ({}),
  },

  guardian: {
    type: guardianSchema,
    default: () => ({}),
  },

  courses: [courseSchema],

  enrollmentDate: {
    type: String,
    default: () => new Date().toISOString().split("T")[0],
  },

  feeEnabled: {
    type: Boolean,
    default: true
  },

  feeDiscount: {
    type: Number,
    default: 0, // percentage
    min: 0,
    max: 100
  },

  feeRemarks: {
    type: String,
    default: ""
  },


  religion: {
    type: "String",
    default: "None",
  },

  status: {
    type: String,
    enum: ["Active", "Inactive", "Graduated", "Suspended"],
    default: "Active",
  },

  academicYear: {
    type: String,
    default: "",
  },

  profilePic: { type: String, default: null },
  cnicPic: { type: String, default: null },

  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

module.exports = mongoose.model("students", studentSchema);
