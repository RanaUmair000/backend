const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
    },

    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    fee: {
      type: Number, // ✅ Number instead of String
      default: 0,
      min: [0, "Fee cannot be negative"],
    },

    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },

    courseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "courses", // ✅ Proper model reference
      },
    ],
  },
  {
    timestamps: true,
  }
);

/*
 ✅ Compound Unique Index
 Prevents duplicate:
 Class 1 - A - 2025
*/
classSchema.index(
  { name: 1, section: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model("classes", classSchema);