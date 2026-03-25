const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['Books', 'Uniforms', 'Stationery', 'Sports', 'Lab Equipment', 'Other'],
    required: true,
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null,
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  quantityInStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  minimumStockAlert: {
    type: Number,
    default: 5,
    min: 0,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

// Virtual: is low stock?
stockItemSchema.virtual('isLowStock').get(function () {
  return this.quantityInStock <= this.minimumStockAlert;
});

// Virtual: total stock value
stockItemSchema.virtual('stockValue').get(function () {
  return this.quantityInStock * this.purchasePrice;
});

stockItemSchema.set('toJSON', { virtuals: true });
stockItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StockItem', stockItemSchema);