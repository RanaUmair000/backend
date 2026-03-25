const express = require('express');
const router = express.Router();

const stockItemController = require('../controllers/stock/stockItemController');
const supplierController = require('../controllers/stock/supplierController');
const stockPurchaseController = require('../controllers/stock/stockPurchaseController');
const stockSaleController = require('../controllers/stock/stockSaleController');
const stockDashboardController = require('../controllers/stock/stockDashboardController');

// ========== Dashboard ==========
router.get('/dashboard', stockDashboardController.getDashboardStats);

// ========== Stock Items ==========
router.get('/items', stockItemController.getStockItems);
router.get('/items/:id', stockItemController.getStockItemById);
router.post('/items', stockItemController.createStockItem);
router.put('/items/:id', stockItemController.updateStockItem);
router.delete('/items/:id', stockItemController.deleteStockItem);

// ========== Suppliers ==========
router.get('/suppliers', supplierController.getSuppliers);
router.get('/suppliers/:id', supplierController.getSupplierById);
router.post('/suppliers', supplierController.createSupplier);
router.put('/suppliers/:id', supplierController.updateSupplier);
router.delete('/suppliers/:id', supplierController.deleteSupplier);

// ========== Stock Purchases (Inventory In) ==========
router.get('/purchases', stockPurchaseController.getPurchases);
router.post('/purchases', stockPurchaseController.createPurchase);
router.delete('/purchases/:id', stockPurchaseController.deletePurchase);

// ========== Sales (Sell to Student) ==========
router.get('/sales', stockSaleController.getSales);
router.post('/sales', stockSaleController.createSale);
router.delete('/sales/:id', stockSaleController.deleteSale);

module.exports = router;