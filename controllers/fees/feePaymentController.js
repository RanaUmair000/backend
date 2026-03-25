const FeePayment = require('../../models/fees/FeePayment');
const FeeInvoice = require('../../models/fees/FeeInvoice');
const Counter = require("./Counter");

async function generateReceiptNumber() {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { key: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${year}-${String(counter.seq).padStart(6, "0")}`;
}
// Submit a payment against an invoice
exports.submitPayment = async (req, res) => {
  try {
    const {
      invoiceId,
      amount,
      paymentMethod,
      paymentDate,
      transactionId,
      chequeNumber,
      bankName,
      notes
    } = req.body;

    // Validate required fields
    if (!invoiceId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID, amount, and payment method are required'
      });
    }

    // Find the invoice
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Validate payment amount
    const remainingAmount = invoice.totalAmount - invoice.paidAmount;
    if (parseFloat(amount) > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed remaining balance of ${remainingAmount}`
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero'
      });
    }

    const receiptNumber = await generateReceiptNumber();
    // Create payment record
    const payment = await FeePayment.create({
      invoice: invoiceId,
      student: invoice.student,
      amount: parseFloat(amount),
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      transactionId,
      chequeNumber,
      bankName,
      notes,
      receiptNumber,
    });

    // Update invoice paid amount and status
    invoice.paidAmount += parseFloat(amount);
    invoice.updateStatus();
    await invoice.save();

    // Populate payment details
    await payment.populate([
      { path: 'student', select: 'firstName lastName rollNumber' },
      { path: 'receivedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment submitted successfully',
      data: {
        payment,
        invoice: {
          _id: invoice._id,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          remainingAmount: invoice.remainingAmount,
          status: invoice.status
        }
      }
    });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit payment',
      error: error.message
    });
  }
};

// Get all payments with filtering
exports.getPayments = async (req, res) => {
  try {
    const {
      studentId,
      invoiceId,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build filter query
    const filter = {};

    if (studentId) {
      filter.student = studentId;
    }

    if (invoiceId) {
      filter.invoice = invoiceId;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        filter.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.paymentDate.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      FeePayment.find(filter)
        .populate('student', 'firstName lastName rollNumber profilePic')
        .populate('invoice', 'invoiceNumber title totalAmount')
        .populate('receivedBy', 'firstName lastName')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FeePayment.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Get payment by ID (for receipt viewing)
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id)
      .populate('student', 'firstName lastName rollNumber email phone address')
      .populate('invoice', 'invoiceNumber title totalAmount feeItems')
      .populate('receivedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
};

// Get payment receipt data
exports.getPaymentReceipt = async (req, res) => {
  try {
    const payment = await FeePayment.findById(req.params.id)
      .populate({
        path: 'student',
        select: 'firstName lastName rollNumber email phone address profilePic',
        populate: { path: 'class', select: 'name' }
      })
      .populate('invoice', 'invoiceNumber title totalAmount paidAmount feeItems dueDate')
      .populate('receivedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Format receipt data
    const receiptData = {
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      student: {
        name: `${payment.student.firstName} ${payment.student.lastName}`,
        rollNumber: payment.student.rollNumber,
        class: payment.student.class?.name,
        email: payment.student.email,
        phone: payment.student.phone
      },
      invoice: {
        number: payment.invoice.invoiceNumber,
        title: payment.invoice.title,
        totalAmount: payment.invoice.totalAmount,
        paidAmount: payment.invoice.paidAmount,
        feeItems: payment.invoice.feeItems
      },
      payment: {
        amount: payment.amount,
        method: payment.paymentMethod,
        transactionId: payment.transactionId,
        chequeNumber: payment.chequeNumber,
        bankName: payment.bankName,
        notes: payment.notes
      },
      receivedBy: payment.receivedBy ? 
        `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}` : 
        'System'
    };

    res.status(200).json({
      success: true,
      data: receiptData
    });
  } catch (error) {
    console.error('Get payment receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment receipt',
      error: error.message
    });
  }
};

// Delete/void a payment (admin only)
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find payment
    const payment = await FeePayment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Find associated invoice
    const invoice = await FeeInvoice.findById(payment.invoice);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Associated invoice not found'
      });
    }

    // Update invoice paid amount and status
    invoice.paidAmount -= payment.amount;
    invoice.updateStatus();
    await invoice.save();

    // Delete payment
    await FeePayment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Payment voided successfully'
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void payment',
      error: error.message
    });
  }
};

// Get payment statistics
exports.getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Get payment aggregations
    const stats = await FeePayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          byMethod: {
            $push: {
              method: '$paymentMethod',
              amount: '$amount'
            }
          }
        }
      }
    ]);

    // Group by payment method
    const methodStats = await FeePayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: stats[0] || { totalPayments: 0, totalAmount: 0 },
        byMethod: methodStats
      }
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
};