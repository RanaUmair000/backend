const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
    {
        employeeCode: {
            type: String,
            required: false,
            unique: true,
            trim: true,
            sparse: true, // ✅ THIS IS THE KEY

        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String, 
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            trim: true,
        },

        gender: {
            type: String,
            enum: ["Male", "Female", "Other"],
        },

        dateOfBirth: {
            type: Date,
        },

        qualification: {
            type: String,
            trim: true,
        },

        specialization: {
            type: String,
            trim: true,
        },

        employmentType: {
            type: String,
            enum: ["Full-time", "Part-time", "Contract"],
            default: "Full-time",
        },

        hireDate: {
            type: Date,
            required: false,
        },

        status: {
            type: String,
            enum: ["Active", "Inactive", "Alumni"],
            default: "Active",
        },

        salary: {
            type: String,
            default: "0",
        },

        religion: {
            type: String,
            default: "Islam",
        },

        emergencyContactName: {
            type: String,
            default: "None"
        },
        emergencyContactPhone: {
            type: String,
            default: "None"
        },

        profilePic: { type: String, default: null },
        
        cnicPic: { type: String, default: null },

        address: {
            type: String,
        },

        // Relationships
        subjects: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subject",
            },
        ],

        classes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Class",
            },
        ],

        userAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("teachers", teacherSchema);
