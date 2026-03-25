const mongoose = require("mongoose");

const teacherSalarySchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teachers",
      required: true,
      index: true,
    },

    month: {
      type: Number, // 1 - 12
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentDate: {
      type: Date,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "online", "cheque"],
    },

    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
      index: true,
    },

    remarks: {
      type: String,
      trim: true,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Prevent duplicate salary for same teacher + month
teacherSalarySchema.index(
  { teacher: 1, month: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("TeacherSalary", teacherSalarySchema);
