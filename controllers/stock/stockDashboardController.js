const StockItem = require('../../models/stock/StockItem');
const StockSale = require('../../models/stock/StockSale');
const StockPurchase = require('../../models/stock/StockPurchase');

// GET /api/stock/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // --- Core counts ---
    const totalItems = await StockItem.countDocuments();

    // Total stock value (purchase price × qty)
    const stockValueAgg = await StockItem.aggregate([
      { $group: { _id: null, totalValue: { $sum: { $multiply: ['$quantityInStock', '$purchasePrice'] } } } },
    ]);
    const totalStockValue = stockValueAgg[0]?.totalValue || 0;

    // Low stock items
    const allItems = await StockItem.find({}, 'name quantityInStock minimumStockAlert category');
    const lowStockItems = allItems.filter(i => i.quantityInStock <= i.minimumStockAlert);

    // --- Sales stats ---
    const totalSalesAgg = await StockSale.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const totalSalesRevenue = totalSalesAgg[0]?.totalRevenue || 0;
    const totalSalesCount = totalSalesAgg[0]?.count || 0;

    // Total profit = revenue - cost
    const profitAgg = await StockSale.aggregate([
      {
        $lookup: {
          from: 'stockitems',
          localField: 'item',
          foreignField: '_id',
          as: 'itemData',
        },
      },
      { $unwind: '$itemData' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalCost: { $sum: { $multiply: ['$quantity', '$itemData.purchasePrice'] } },
        },
      },
      { $project: { profit: { $subtract: ['$totalRevenue', '$totalCost'] } } },
    ]);
    const totalProfit = profitAgg[0]?.profit || 0;

    // Monthly sales
    const monthlySalesAgg = await StockSale.aggregate([
      { $match: { saleDate: { $gte: startOfMonth } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const monthlySales = monthlySalesAgg[0]?.revenue || 0;

    // Most sold items (top 5)
    const mostSoldItems = await StockSale.aggregate([
      { $group: { _id: '$item', totalQty: { $sum: '$quantity' }, totalRevenue: { $sum: '$totalAmount' } } },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'stockitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      { $project: { 'item.name': 1, 'item.category': 1, totalQty: 1, totalRevenue: 1 } },
    ]);

    // Recent sales (last 10)
    const recentSales = await StockSale.find()
      .populate('student', 'firstName lastName rollNumber')
      .populate('item', 'name category')
      .sort({ saleDate: -1 })
      .limit(10);

    // Sales by category
    const salesByCategory = await StockSale.aggregate([
      {
        $lookup: {
          from: 'stockitems',
          localField: 'item',
          foreignField: '_id',
          as: 'itemData',
        },
      },
      { $unwind: '$itemData' },
      { $group: { _id: '$itemData.category', totalRevenue: { $sum: '$totalAmount' }, count: { $sum: '$quantity' } } },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalItems,
          totalStockValue,
          totalSalesRevenue,
          totalSalesCount,
          totalProfit,
          monthlySales,
          lowStockCount: lowStockItems.length,
        },
        lowStockItems,
        mostSoldItems,
        recentSales,
        salesByCategory,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};