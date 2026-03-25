const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

const feeInvoiceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classes',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invoiceType: {
    type: String,
    enum: ['annual', 'stock_sale', 'monthly', 'event', 'manual'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  month: {
    type: Date,
    index: true
  },
  feeItems: [feeItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid'],
    default: 'unpaid',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for preventing duplicate monthly invoices
feeInvoiceSchema.index({ student: 1, month: 1, invoiceType: 1 }, { 
  unique: true,
  partialFilterExpression: { invoiceType: 'monthly' }
});

// Auto-generate invoice number
feeInvoiceSchema.pre('save', async function() {
  if (this.isNew && !this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }
});

// Auto-update status based on payment
feeInvoiceSchema.methods.updateStatus = function() {
  if (this.paidAmount === 0) {
    this.status = 'unpaid';
  } else if (this.paidAmount >= this.totalAmount) {
    this.status = 'paid';
  } else {
    this.status = 'partially_paid';
  }
};

// Virtual for remaining amount
feeInvoiceSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Ensure virtuals are included in JSON
feeInvoiceSchema.set('toJSON', { virtuals: true });
feeInvoiceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);