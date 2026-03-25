const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema({
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeInvoice',
    required: true,
    index: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'online', 'card'],
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    trim: true
  },
  chequeNumber: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-generate receipt number
feePaymentSchema.pre('save', async function () {
  if (this.isNew && !this.receiptNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.receiptNumber = `RCP-${year}-${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = mongoose.model('FeePayment', feePaymentSchema);