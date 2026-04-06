// controllers/studentController.js
const Student = require('../models/Student');
const path = require("path");
const fs = require("fs");
const FeeInvoice = require('../models/fees/FeeInvoice');
const Counter = require("./fees/counter");

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { key: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `INV-${year}-${String(counter.seq).padStart(6, "0")}`;
}

// Fetch all students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate("class"); // 👈 populate class record

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


exports.searchStudents = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const trimmed = query.trim();

    // Build search conditions
    const searchConditions = [
      { firstName: { $regex: trimmed, $options: 'i' } },
      { lastName: { $regex: trimmed, $options: 'i' } },
      { rollNumber: { $regex: trimmed, $options: 'i' } },
    ];

    // If the query contains a space, also try matching "firstName lastName"
    if (trimmed.includes(' ')) {
      const [first, ...rest] = trimmed.split(' ');
      searchConditions.push({
        firstName: { $regex: first, $options: 'i' },
        lastName: { $regex: rest.join(' '), $options: 'i' },
      });
    }

    console.log(searchConditions);

    const students = await Student.find({ $or: searchConditions })
      .populate('class', 'name section fee')
      .limit(10)
      .lean();

    return res.status(200).json({
      message: 'Students fetched successfully',
      data: students,
    });
  } catch (error) {
    console.error('searchStudents error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getStudentByClass = async (req, res) => {
  try {
    const classId = req.params.classId;
    console.log(classId, 'id');
    const students = await Student.find({ class: classId });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

exports.createStudent = async (req, res) => {
  try {
    let student;

    // 🔹 If updating existing student
    if (req.params.id) {
      student = await Student.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
    } else {
      student = new Student();
    }


    const isUpdate = !!req.params.id;
    const excludeSelf = isUpdate ? { _id: { $ne: req.params.id } } : {};

    if (req.body.rollNumber) {
      const rollExists = await Student.findOne({
        rollNumber: req.body.rollNumber,
        ...excludeSelf,
      });
      if (rollExists) {
        return res.status(409).json({ message: `Roll number "${req.body.rollNumber}" is already assigned to another student.` });
      }
    }

    if (req.body.admissionId) {
      const admissionExists = await Student.findOne({
        admissionId: req.body.admissionId,
        ...excludeSelf,
      });
      if (admissionExists) {
        return res.status(409).json({ message: `Admission ID "${req.body.admissionId}" is already assigned to another student.` });
      }
    }

    // 🔹 Update normal fields (same as before)
    student.firstName = req.body.firstName;
    student.lastName = req.body.lastName;
    student.email = req.body.email;
    student.phone = req.body.phone;
    student.dateOfBirth = req.body.dateOfBirth;
    student.gender = req.body.gender;
    student.rollNumber = req.body.rollNumber;
    student.password = req.body.password;
    student.enrollmentDate = req.body.enrollmentDate;
    student.class = req.body.class;
    student.fee = req.body.fee;
    student.feePlan = req.body.feePlan;
    student.religion = req.body.religion;
    student.academicYear = req.body.academicYear;
    student.address = {
      street: req.body.street,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
    };

    student.guardian = {
      name: req.body.guardianName,
      phone: req.body.guardianPhone,
      address: req.body.address,
    };


    // 🔥 IMAGE HANDLING (IMPORTANT PART)

    const deleteOldFile = (oldPath) => {
      if (!oldPath) return;
      const normalized = oldPath.replace(/\\/g, "/");
      const fullPath = path.join(__dirname, "..", normalized);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    };

    // ✅ Profile Pic
    if (req.files?.profilePic?.[0]) {
      // delete old image if exists
      if (student.profilePic) {
        deleteOldFile(student.profilePic);
      }

      student.profilePic = req.files.profilePic[0].path.replace(/\\/g, "/");
    }

    // ✅ CNIC Pic
    if (req.files?.cnicPic?.[0]) {
      if (student.cnicPic) {
        deleteOldFile(student.cnicPic);
      }

      student.cnicPic = req.files.cnicPic[0].path.replace(/\\/g, "/");
    }

    await student.save();

    // 🔥 Generate invoice if checkbox is checked and this is a NEW student
    if (!req.params.id && req.body.generateInvoice) {
      try {
        const invoiceNumber = await generateInvoiceNumber();

        const feeItems = [];

        // Registration Fee
        if (req.body.registrationFee && Number(req.body.registrationFee) > 0) {
          feeItems.push({
            title: "Registration Fee",
            description: "One time registration fee",
            amount: Number(req.body.registrationFee)
          });
        }

        // Tuition Fee
        if (student.fee && Number(student.fee) > 0) {
          feeItems.push({
            title: "Tuition Fee",
            description: "Monthly tuition fee",
            amount: Number(student.fee)
          });
        }

        if (feeItems.length > 0) {
          const totalAmount = feeItems.reduce((sum, item) => sum + item.amount, 0);

          const invoice = await FeeInvoice.create({
            student: student._id,
            class: student.class,
            invoiceType: "manual",
            title: "Registration & Tuition Fee Invoice",
            feeItems,
            totalAmount,
            dueDate: new Date(),
            invoiceNumber
          });

          console.log("Invoice created for student:", invoice.invoiceNumber);
        }

      } catch (err) {
        console.error("Invoice generation error:", err);
      }
    }

    res.status(req.params.id ? 200 : 201).json(student);
  } catch (err) {
    console.error("STUDENT SAVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // 🔹 Update normal fields
    Object.assign(student, {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      rollNumber: req.body.rollNumber,
      password: req.body.password,
      enrollmentDate: req.body.enrollmentDate,
      class: req.body.class,
      fee: req.body.fee,
      feePlan: req.body.feePlan,
      religion: req.body.religion,
      academicYear: req.body.academicYear,
      status: req.body.status,
      address: {
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        zipCode: req.body.zipCode,
        country: req.body.country,
      },
      guardian: {
        name: req.body.guardianName,
        phone: req.body.guardianPhone,
        address: req.body.address,
      },
    });

    const deleteFile = (filePath) => {
      if (!filePath) return;
      const fullPath = path.join(__dirname, "..", filePath.replace(/\\/g, "/"));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    };

    // 🔥 PROFILE PIC UPDATE
    if (req.files?.profilePic?.[0]) {
      deleteFile(student.profilePic);
      student.profilePic = req.files.profilePic[0].path.replace(/\\/g, "/");
    }

    // 🔥 CNIC PIC UPDATE
    if (req.files?.cnicPic?.[0]) {
      deleteFile(student.cnicPic);
      student.cnicPic = req.files.cnicPic[0].path.replace(/\\/g, "/");
    }

    await student.save();

    res.json(student);
  } catch (err) {
    console.error("UPDATE STUDENT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getAnnualStudents = async (req, res) => {
  try {

    const students = await Student.find({
      feePlan: "Annual",
      status: "Active"
    })
      .populate("class", "name section fee")
      .sort({ rollNumber: 1 });

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch single student by ID
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error(error);
    // handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
// fj
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    console.log(student);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // 🧹 helper to delete files safely
    const deleteFile = (filePath) => {
      if (!filePath) return;

      const normalizedPath = filePath.replace(/\\/g, "/");
      const fullPath = path.join(__dirname, "..", normalizedPath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    };

    // delete images
    deleteFile(student.profilePic);
    deleteFile(student.cnicPic);

    // delete student record
    await student.deleteOne();

    res.status(200).json({ message: "Student and files deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('class', 'name section fee courseIds');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/student/me/fees
 * All fee invoices for the logged-in student
 */
exports.getMyFees = async (req, res) => {
  try {
    const { status, invoiceType, page = 1, limit = 50 } = req.query;

    const filter = { student: "6999f660048dead0adcda6c9" };
    if (status) filter.status = status;
    if (invoiceType) filter.invoiceType = invoiceType;

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      FeeInvoice.find(filter)
        .populate('class', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FeeInvoice.countDocuments(filter),
    ]);

    const summary = {
      totalInvoices: total,
      paidInvoices: await FeeInvoice.countDocuments({ student: "6999f660048dead0adcda6c9", status: 'paid' }),
      unpaidInvoices: await FeeInvoice.countDocuments({ student: "6999f660048dead0adcda6c9", status: 'unpaid' }),
      overdueInvoices: await FeeInvoice.countDocuments({
        student: "6999f660048dead0adcda6c9",
        status: { $in: ['unpaid', 'partial'] },
        dueDate: { $lt: new Date() },
      }),
    };

    const agg = await FeeInvoice.aggregate([
      { $match: { student: require('mongoose').Types.ObjectId("6999f660048dead0adcda6c9") } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
        },
      },
    ]);

    if (agg[0]) {
      summary.totalAmount = agg[0].totalAmount;
      summary.paidAmount = agg[0].paidAmount;
      summary.pendingAmount = agg[0].totalAmount - agg[0].paidAmount;
    }

    res.json({
      success: true,
      data: invoices,
      summary,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/student/me/fees/:invoiceId
 * Single invoice detail with payment history
 */
exports.getMyInvoiceById = async (req, res) => {
  try {
    const invoice = await FeeInvoice.findOne({
      _id: req.params.invoiceId,
      student: req.user._id,
    })
      .populate('class', 'name')
      .populate('student', 'firstName lastName rollNumber');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const payments = await FeePayment.find({ invoice: invoice._id })
      .populate('receivedBy', 'firstName lastName')
      .sort({ paymentDate: -1 });

    res.json({ success: true, data: { invoice, payments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/student/me/attendance
 * Attendance records with optional date range
 */
exports.getMyAttendance = async (req, res) => {
  try {
    const { startDate, endDate, month, year } = req.query;

    const student = await Student.findById(req.user._id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const query = { studentId: req.user._id };

    if (month && year) {
      query.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0),
      };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const records = await Attendance.find(query).sort({ date: -1 });

    const stats = {
      totalDays: records.length,
      present: records.filter(r => r.status === 'Present').length,
      absent: records.filter(r => r.status === 'Absent').length,
      leave: records.filter(r => r.status === 'Leave').length,
      late: records.filter(r => r.status === 'Late').length,
    };
    stats.attendancePercentage = stats.totalDays > 0
      ? ((stats.present / stats.totalDays) * 100).toFixed(1)
      : '0.0';

    // Monthly summary if requested
    let monthlySummary = null;
    if (month && year) {
      monthlySummary = await MonthlyAttendanceSummary.findOne({
        studentId: req.user._id,
        month: parseInt(month),
        year: parseInt(year),
      });
    }

    res.json({ success: true, data: { records, stats, monthlySummary } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/student/me/dashboard
 * Aggregated dashboard data in one call
 */
exports.getMyDashboard = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('class', 'name section fee');

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Fee summary
    const feeAgg = await FeeInvoice.aggregate([
      { $match: { student: student._id } },
      {
        $group: {
          _id: null,
          totalAmount:  { $sum: '$totalAmount' },
          paidAmount:   { $sum: '$paidAmount' },
          totalCount:   { $sum: 1 },
        },
      },
    ]);
    const feeSummary = feeAgg[0] || { totalAmount: 0, paidAmount: 0, totalCount: 0 };
    feeSummary.pendingAmount = feeSummary.totalAmount - feeSummary.paidAmount;
    feeSummary.overdueCount = await FeeInvoice.countDocuments({
      student: student._id,
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $lt: new Date() },
    });

    // This month's attendance
    const now = new Date();
    const monthlySummary = await MonthlyAttendanceSummary.findOne({
      studentId: student._id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    res.json({
      success: true,
      data: {
        student,
        feeSummary,
        attendance: monthlySummary || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};