const StockPurchase = require('../../models/stock/StockPurchase');
const StockItem = require('../../models/stock/StockItem');

// GET /api/stock/purchases
exports.getPurchases = async (req, res) => {
  try {
    const { itemId, supplierId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (itemId) filter.item = itemId;
    if (supplierId) filter.supplier = supplierId;
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate);
    }

    const purchases = await StockPurchase.find(filter)
      .populate('item', 'name category')
      .populate('supplier', 'name phone')
      .sort({ purchaseDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockPurchase.countDocuments(filter);
    res.json({ success: true, data: purchases, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stock/purchases
exports.createPurchase = async (req, res) => {
  try {
    const { item: itemId, quantityPurchased, purchasePrice } = req.body;

    // Calculate total cost
    req.body.totalCost = quantityPurchased * purchasePrice;

    const purchase = await StockPurchase.create(req.body);

    // Increase stock quantity
    await StockItem.findByIdAndUpdate(itemId, {
      $inc: { quantityInStock: quantityPurchased },
    });

    await purchase.populate([
      { path: 'item', select: 'name category' },
      { path: 'supplier', select: 'name' },
    ]);

    res.status(201).json({
      success: true,
      data: purchase,
      message: `Stock updated. Added ${quantityPurchased} unit(s).`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/stock/purchases/:id  (reverse the stock increase)
exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await StockPurchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });

    // Check stock won't go negative
    const item = await StockItem.findById(purchase.item);
    if (item && item.quantityInStock < purchase.quantityPurchased) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete: stock level would go negative.',
      });
    }

    await StockItem.findByIdAndUpdate(purchase.item, {
      $inc: { quantityInStock: -purchase.quantityPurchased },
    });

    await purchase.deleteOne();
    res.json({ success: true, message: 'Purchase deleted and stock reversed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};