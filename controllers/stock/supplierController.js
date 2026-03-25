const Supplier = require('../../models/stock/Supplier');
const StockItem = require('../../models/stock/StockItem');

// GET /api/stock/suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/stock/suppliers/:id
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    // Get linked items
    const items = await StockItem.find({ supplier: req.params.id }).select('name category quantityInStock sellingPrice');
    res.json({ success: true, data: { supplier, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stock/suppliers
exports.createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({ success: true, data: supplier, message: 'Supplier added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/stock/suppliers/:id
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: supplier, message: 'Supplier updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/stock/suppliers/:id
exports.deleteSupplier = async (req, res) => {
  try {
    const linkedItems = await StockItem.countDocuments({ supplier: req.params.id });
    if (linkedItems > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier linked to ${linkedItems} item(s). Unlink items first.`,
      });
    }
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};