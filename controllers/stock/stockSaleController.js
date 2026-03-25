const StockSale = require('../../models/stock/StockSale');
const StockItem = require('../../models/stock/StockItem');
const Student = require('../../models/Student');
const FeeInvoice = require('../../models/fees/FeeInvoice');
const Counter = require('../fees/counter'); // reuse your existing counter

// Reuse your existing invoice number generator
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INV-${year}-${String(counter.seq).padStart(6, '0')}`;
}

// GET /api/stock/sales
exports.getSales = async (req, res) => {
  try {
    const { studentId, itemId, startDate, endDate, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (itemId) filter.item = itemId;

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // Search by student name
    if (search || studentId) {
      if (studentId) {
        filter.student = studentId;
      } else {
        const students = await Student.find({
          $or: [
            { firstName: new RegExp(search, 'i') },
            { lastName: new RegExp(search, 'i') },
            { rollNumber: new RegExp(search, 'i') },
          ],
        }).select('_id');
        filter.student = { $in: students.map(s => s._id) };
      }
    }

    const sales = await StockSale.find(filter)
      .populate('student', 'firstName lastName rollNumber profilePic')
      .populate('item', 'name category')
      .sort({ saleDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockSale.countDocuments(filter);

    // Summary totals
    const totalsAgg = await StockSale.aggregate([
      { $match: filter },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalItems: { $sum: '$quantity' } } },
    ]);

    res.json({
      success: true,
      data: sales,
      total,
      summary: totalsAgg[0] || { totalRevenue: 0, totalItems: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stock/sales  — sell item to student
exports.createSale = async (req, res) => {
  try {
    const { student: studentId, item: itemId, quantity, sellingPrice, saleDate, notes } = req.body;

    // 1. Validate item exists and has enough stock
    const item = await StockItem.findById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.quantityInStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${item.quantityInStock}`,
      });
    }

    // 2. Validate student
    const student = await Student.findById(studentId).populate('class', 'name _id');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const totalAmount = quantity * sellingPrice;

    // 3. Create invoice via existing FeeInvoice model
    const invoiceNumber = await generateInvoiceNumber();
    const invoice = await FeeInvoice.create({
      student: student._id,
      class: student.class?._id,
      invoiceType: 'stock_sale',
      title: `Shop Sale - ${item.name}`,
      feeItems: [
        {
          title: item.name,
          amount: sellingPrice,
          description: `Qty: ${quantity} × PKR ${sellingPrice}`,
        },
      ],
      totalAmount,
      dueDate: saleDate || new Date(),
      invoiceNumber,
    });

    // 4. Create sale record
    const sale = await StockSale.create({
      student: studentId,
      item: itemId,
      quantity,
      sellingPrice,
      totalAmount,
      saleDate: saleDate || new Date(),
      invoice: invoice._id,
      notes,
    });

    // 5. Reduce stock
    await StockItem.findByIdAndUpdate(itemId, {
      $inc: { quantityInStock: -quantity },
    });

    await sale.populate([
      { path: 'student', select: 'firstName lastName rollNumber' },
      { path: 'item', select: 'name category' },
      { path: 'invoice', select: 'invoiceNumber totalAmount status' },
    ]);

    res.status(201).json({
      success: true,
      data: sale,
      invoice,
      message: `Sale recorded. Invoice ${invoiceNumber} generated.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/stock/sales/:id
exports.deleteSale = async (req, res) => {
  try {
    const sale = await StockSale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    // Restore stock
    await StockItem.findByIdAndUpdate(sale.item, {
      $inc: { quantityInStock: sale.quantity },
    });

    // Delete linked invoice if exists
    if (sale.invoice) {
      await FeeInvoice.findByIdAndDelete(sale.invoice);
    }

    await sale.deleteOne();
    res.json({ success: true, message: 'Sale deleted and stock restored.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};