const FeeInvoice = require('../../models/fees/FeeInvoice');
const FeePayment = require('../../models/fees/FeePayment');
const Student = require('../../models/Student');
const Class = require('../../models/Class');

const Counter = require("./counter.js");

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { key: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `INV-${year}-${String(counter.seq).padStart(6, "0")}`;
}

/**
 * POST /api/fees/generate-annual
 *
 * Body:
 * {
 *   students: [
 *     { studentId, annualFee, discountAmount, totalAmount }
 *   ],
 *   year:         number     – e.g. 2026
 *   dueDate:      string     – ISO date string
 *   invoiceType:  string     – 'annual' | 'semi-annual' | 'quarterly' | 'custom'
 *   discount:     number     – discount value (raw, for record keeping)
 *   discountType: string     – 'percentage' | 'fixed'
 *   description:  string     – optional note
 * }
 */

exports.generateAnnualInvoices = async (req, res) => {
  try {
    const {
      students,
      year,
      dueDate,
      invoiceType   = 'annual',
      discount      = 0,
      discountType  = 'percentage',
      description   = '',
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }
    if (!dueDate) {
      return res.status(400).json({ message: 'Due date is required' });
    }

    const invalidEntry = students.find(
      (s) => !s.studentId || s.annualFee === undefined || s.totalAmount === undefined
    );
    if (invalidEntry) {
      return res.status(400).json({ message: 'Each student entry must include studentId, annualFee, and totalAmount' });
    }

    // ── Reference date: Jan 1 of the given year ───────────────────────────
    const invoiceYear = new Date(parseInt(year), 0, 1);

    const typeLabel = {
      'annual':      'Annual',
      'semi-annual': 'Semi-Annual',
      'quarterly':   'Quarterly',
      'custom':      'Custom',
    }[invoiceType] || 'Annual';

    let created = 0;
    let skipped = 0;

    // ── Process each student ──────────────────────────────────────────────
    for (const entry of students) {
      const { studentId, annualFee, discountAmount, totalAmount } = entry;

      // Skip students with no fee
      if (!annualFee || annualFee <= 0) {
        skipped++;
        continue;
      }

      const student = await Student.findById(studentId).populate('class', 'name section fee');

      if (!student) {
        skipped++;
        continue;
      }

      const invoiceNumber = await generateInvoiceNumber();

      const invoiceTitle = `${student.class?.name || 'School'} - ${typeLabel} Fee ${year}`;

      // Build fee items: one line for the annual fee, one for discount if any
      const feeItems = [
        {
          title:  `${typeLabel} Tuition Fee`,
          amount: annualFee,
          description: `Monthly fee PKR ${student.class?.fee?.toLocaleString() || 0} × 12 months`,
        },
      ];

      try {
        await FeeInvoice.create({
          student:      student._id,
          class:        student.class?._id,
          invoiceType,
          title:        invoiceTitle,
          year:         invoiceYear,
          feeItems,
          subtotal:     annualFee,
          discount:     discountAmount || 0,
          discountType,
          totalAmount,
          dueDate,
          description,
          invoiceNumber,
        });

        created++;
      } catch (err) {
        // Duplicate – invoice already exists for this student/year/type
        if (err.code === 11000) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    return res.status(201).json({
      message:           'Annual invoice generation completed',
      studentsProcessed: students.length,
      invoicesCreated:   created,
      invoicesSkipped:   skipped,
    });

  } catch (error) {
    console.error('generateAnnualInvoices error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Generate monthly invoices for a class or all classes
exports.generateMonthlyInvoices = async (req, res) => {
  try {
    const {
      classId,     // specific class OR "all"
      month,       // 1-12
      year,        // 2026
      dueDate,
      feeItems,
      students
    } = req.body;
    const title = feeItems?.[0]?.title;
    const description = feeItems?.[0]?.description;

    const invoiceMonth = new Date(year, month - 1, 1);



    console.log(students);
    if (!students.length) {
      return res.status(404).json({ message: 'No students found' });
    }

    

    let created = 0;
    let skipped = 0;

    for (const studentId of students) {

      const student = await Student.findById(studentId).populate('class');

      const invoiceNumber = await generateInvoiceNumber();

      // Ensure class & fee exist
      if (!student || !student.class || !student.class.fee) {
        skipped++;
        continue;
      }

      if (student.feePlan === 'Annual') {
        skipped++;
        continue;
      }

      const feeItems = [{
        title: 'Monthly Fee',
        amount: student.class.fee
      }];

      try {
        await FeeInvoice.create({
          student: student._id,
          class: student.class._id,
          invoiceType: 'monthly',
          title: title || `${student.class.name} - Monthly Fee`,
          month: invoiceMonth,
          feeItems,
          totalAmount: student.class.fee,
          dueDate,
          description,
          invoiceNumber,
        });

        created++;

      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    res.status(201).json({
      message: 'Monthly invoice generation completed',
      studentsProcessed: students.length,
      invoicesCreated: created,
      invoicesSkipped: skipped
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};



// Create invoice for specific student
exports.createStudentInvoice = async (req, res) => {
  try {
    const { studentId, title, feeItems, dueDate, invoiceType, month, notes } = req.body;

    // Validate required fields
    if (!studentId || !title || !feeItems || feeItems.length === 0 || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, title, fee items, and due date are required'
      });
    }
    const invoiceMonth = new Date(month);
    console.log(studentId, title, feeItems, dueDate, invoiceType, invoiceMonth, notes);
    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Calculate total amount
    const totalAmount = feeItems.reduce((sum, item) => sum + item.amount, 0);

    // Check for duplicate monthly invoice if applicable
    if (invoiceType === 'monthly' && month) {
      const existingInvoice = await FeeInvoice.findOne({
        student: studentId,
        month: new Date(month),
        invoiceType: 'monthly'
      });

      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: 'Student already has an invoice for this month'
        });
      }
    }

    // Create invoice
    const invoiceNumber = await generateInvoiceNumber();
    const invoice = await FeeInvoice.create({
      student: studentId,
      class: student.class.toString(),
      invoiceType: invoiceType || 'manual',
      title,
      month: month ? new Date(month) : undefined,
      feeItems,
      totalAmount,
      dueDate: new Date(dueDate),
      notes,
      invoiceNumber
    });

    // Populate student and class details
    await invoice.populate([
      { path: 'student' },
      { path: 'class' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Create student invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
};

// Generate event-based invoices
exports.generateEventInvoices = async (req, res) => {
  try {
    const { eventName, amount, dueDate, classIds, studentIds, description } = req.body;
    console.log(req.body);
    // Validate required fields
    if (!eventName || !amount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Event name, amount, and due date are required'
      });
    }

    if ((!classIds || classIds.length === 0) && (!studentIds || studentIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Either class IDs or student IDs must be provided'
      });
    }

    // Get students based on selection
    let students;
    if (studentIds && studentIds.length > 0) {
      students = await Student.find({ _id: { $in: studentIds }, status: 'Active' });
    } else if (classIds && classIds.length > 0) {
      students = await Student.find({ class: { $in: classIds }, status: 'Active' });
    }

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active students found for selection'
      });
    }

    // Create fee item
    const feeItems = [{
      title: eventName,
      amount: parseFloat(amount),
      description: description || ''
    }];

    // Generate invoices for selected students
    const invoices = await Promise.all(
      students.map(async student => ({
        student: student._id,
        class: student.class,
        invoiceType: 'event',
        title: `Event Fee - ${eventName}`,
        feeItems,
        totalAmount: Number(amount),
        dueDate: new Date(dueDate),
        invoiceNumber: await generateInvoiceNumber()
      }))
    );

    await FeeInvoice.insertMany(invoices);

    res.status(201).json({
      success: true,
      message: `Successfully generated ${invoices.length} event invoices`,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Generate event invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate event invoices',
      error: error.message
    });
  }
};

// Get all invoices with advanced filtering
exports.getInvoices = async (req, res) => {
  try {
    const {
      studentId,
      rollNumber,
      className,
      month,
      year,
      status,
      invoiceType,
      search,
      page = 1,
      limit = 50
    } = req.query;

    // Build filter query
    const filter = {};

    if (studentId) {
      filter.student = studentId;
    }

    if (status) {
      filter.status = status;
    }

    if (invoiceType) {
      filter.invoiceType = invoiceType;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filter.month = { $gte: startDate, $lte: endDate };
    }

    // Handle search by roll number or name
    if (search || rollNumber || className) {
      const studentFilter = {};

      if (rollNumber) {
        studentFilter.rollNumber = new RegExp(rollNumber, 'i');
      }

      if (search) {
        studentFilter.$or = [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { rollNumber: new RegExp(search, 'i') }
        ];
      }

      console.log(studentFilter);

      const students = await Student.find(studentFilter).select('_id');
      filter.student = { $in: students.map(s => s._id) };
    }

    if (className) {
      const classes = await Class.find({ name: new RegExp(className, 'i') }).select('_id');
      filter.class = { $in: classes.map(c => c._id) };
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      FeeInvoice.find(filter)
        .populate('student', 'firstName lastName rollNumber profilePic')
        .populate('class', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FeeInvoice.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};

exports.getFeeDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Total invoices
    const totalInvoices = await FeeInvoice.countDocuments();

    // Pending amount (unpaid / partial)
    const pendingAgg = await FeeInvoice.aggregate([
      {
        $project: {
          remainingAmount: {
            $subtract: ['$totalAmount', '$paidAmount']
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: '$remainingAmount' }
        }
      }
    ]);

    const pendingAmount = pendingAgg[0]?.totalPending || 0;

    // Collected today
    const collectedTodayAgg = await FeePayment.aggregate([
      {
        $match: {
          paymentDate: { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const collectedToday = collectedTodayAgg[0]?.total || 0;

    // Overdue invoices
    const overdueCount = await FeeInvoice.countDocuments({
      dueDate: { $lt: new Date() },
      status: { $in: ['unpaid', 'partial'] }
    });

    res.json({
      success: true,
      data: {
        totalInvoices,
        pendingAmount,
        collectedToday,
        overdueCount
      }
    });

  } catch (error) {
    console.error('Fee dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard stats'
    });
  }
};

exports.getStudentsWithUnpaidFees = async (req, res) => {
  try {
    const { classId, status, type } = req.query;

    const filter = {
      $expr: {
        $gt: [
          { $subtract: ['$totalAmount', '$paidAmount'] },
          0
        ]
      }
    };

    // Optional filters
    if (status) {
      filter.status = status; // unpaid | partial
    }

    if (classId) {
      filter.class = classId;
    }

    if (type === "monthly") {
      filter.invoiceType = type; // expects 'monthly' or 'others'
    }

    const invoices = await FeeInvoice.find(filter)
      .populate('student', 'firstName lastName rollNumber profilePic class section')
      .populate('class', 'name')
      .sort({ dueDate: 1 });

    const students = invoices.map(inv => ({
      invoiceId: inv._id,
      invoiceType: inv.invoiceType,
      student: inv.student,
      class: inv.class,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.totalAmount - inv.paidAmount,
      dueDate: inv.dueDate,
      status: inv.status,
      invoiceNumber: inv.invoiceNumber
    }));

    res.json({
      success: true,
      count: students.length,
      data: students
    });

  } catch (error) {
    console.error('Unpaid students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid students'
    });
  }
};

// Get single invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await FeeInvoice.findById(req.params.id)
      .populate('student', 'firstName lastName rollNumber profilePic email phone')
      .populate('class', 'name')
      .populate('createdBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Get payment history for this invoice
    const payments = await FeePayment.find({ invoice: invoice._id })
      .populate('receivedBy', 'firstName lastName')
      .sort({ paymentDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        invoice,
        payments
      }
    });
  } catch (error) {
    console.error('Get invoice by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
};

// Delete invoice with validation
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if invoice exists
    const invoice = await FeeInvoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if any payments exist for this invoice
    const paymentCount = await FeePayment.countDocuments({ invoice: id });
    if (paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoice with existing payments. Please void the payments first.',
        paymentCount
      });
    }

    // Delete the invoice
    await FeeInvoice.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: error.message
    });
  }
};

// Get student fee status
exports.getStudentFeeStatus = async (req, res) => {
  try {
    const { studentId, rollNumber } = req.query;

    // Find student
    let student;
    if (studentId) {
      student = await Student.findById(studentId).populate('class', 'name');
    } else if (rollNumber) {
      student = await Student.findOne({ rollNumber }).populate('class', 'name');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Student ID or roll number is required'
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all invoices for the student
    const invoices = await FeeInvoice.find({ student: student._id })
      .sort({ dueDate: -1 });

    // Calculate summary
    const summary = {
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter(inv => inv.status === 'paid').length,
      unpaidInvoices: invoices.filter(inv => inv.status === 'unpaid').length,
      partiallyPaidInvoices: invoices.filter(inv => inv.status === 'partially_paid').length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidAmount: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      pendingAmount: invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
      overdueInvoices: invoices.filter(inv =>
        inv.status !== 'paid' && new Date(inv.dueDate) < new Date()
      ).length
    };

    res.status(200).json({
      success: true,
      data: {
        student,
        summary,
        invoices
      }
    });
  } catch (error) {
    console.error('Get student fee status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee status',
      error: error.message
    });
  }
};