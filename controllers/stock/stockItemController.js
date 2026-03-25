const StockItem = require('../../models/stock/StockItem');
const StockSale = require('../../models/stock/StockSale');

// GET /api/stock/items
exports.getStockItems = async (req, res) => {
  try {
    const { search, category, lowStock, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }
    if (category) filter.category = category;

    const items = await StockItem.find(filter)
      .populate('supplier', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockItem.countDocuments(filter);

    // Filter low stock after fetch (uses virtual)
    const result = lowStock === 'true'
      ? items.filter(i => i.isLowStock)
      : items;

    res.json({ success: true, data: result, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/stock/items/:id
exports.getStockItemById = async (req, res) => {
  try {
    const item = await StockItem.findById(req.params.id).populate('supplier', 'name phone email');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stock/items
exports.createStockItem = async (req, res) => {
  try {
    const item = await StockItem.create(req.body);
    await item.populate('supplier', 'name');
    res.status(201).json({ success: true, data: item, message: 'Item created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/stock/items/:id
exports.updateStockItem = async (req, res) => {
  try {
    const item = await StockItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('supplier', 'name');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item, message: 'Item updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/stock/items/:id
exports.deleteStockItem = async (req, res) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    // Check if item has sales
    const salesCount = await StockSale.countDocuments({ item: req.params.id });
    if (salesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete item with ${salesCount} recorded sale(s).`,
      });
    }

    await item.deleteOne();
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};