const TeacherSalary = require("../models/TeacherSalary");
const Teacher = require("../models/Teacher");

exports.getTeacherSalaries = async (req, res) => {
  try {
    const { search, month, year, status } = req.query;
    const filter = {};
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (status) filter.status = status;
    console.log(filter);
    let salaries = await TeacherSalary.find(filter)
      .populate("teacher", "firstName lastName employeeCode profilePic")
      .sort({ createdAt: -1 });

    // 🔍 Search by teacher name
    if (search) {
      salaries = salaries.filter(s =>
        `${s.teacher.firstName} ${s.teacher.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      data: salaries,
    });
  } catch (error) {
    console.error("Get teacher salaries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teacher salaries",
    });
  }
};

exports.payTeacherSalary = async (req, res) => {
  try {
    const { teacherId, month, year, paidAmount, notes } = req.body;
    console.log(req.body);
    if (!teacherId || !month || !year) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const basicSalary = Number(teacher.salary);
    const paid = Number(paidAmount || 0);

    let status = "unpaid";
    if (paid >= basicSalary) status = "paid";
    else if (paid > 0) status = "partially_paid";

    const salary = await TeacherSalary.create({
      teacher: teacherId,
      month,
      year,
      basicSalary,
      paidAmount: paid,
      status,
      paidDate: paid > 0 ? new Date() : null,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Salary record created successfully",
      data: salary,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Salary already recorded for this teacher and month",
      });
    }

    res.status(500).json({ message: error.message });
  }
};