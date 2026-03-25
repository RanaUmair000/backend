const mongoose = require('mongoose');

const stockSaleSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockItem',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  saleDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  // Link to the auto-generated fee invoice
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeInvoice',
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('StockSale', stockSaleSchema);