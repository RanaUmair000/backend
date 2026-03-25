const express = require('express');
const router = express.Router();
const feeInvoiceController = require('../controllers/fees/feeInvoiceController');
const feePaymentController = require('../controllers/fees/feePaymentController');

// ========== Fee Invoice Routes ==========

// Generate monthly invoices (bulk)
router.post('/invoices/generate-monthly', feeInvoiceController.generateMonthlyInvoices);
router.post('/invoices/generate-annually', feeInvoiceController.generateAnnualInvoices);


// Create invoice for specific student
router.post('/invoices/student', feeInvoiceController.createStudentInvoice);

router.get('/invoices/dashboard', feeInvoiceController.getFeeDashboardStats);

router.get('/invoices/unpaid-students', feeInvoiceController.getStudentsWithUnpaidFees);

// Generate event-based invoices
router.post('/invoices/generate-event', feeInvoiceController.generateEventInvoices);

// Get all invoices with filtering
router.get('/invoices', feeInvoiceController.getInvoices);

// Get single invoice by ID
router.get('/invoices/:id', feeInvoiceController.getInvoiceById);

// Delete invoice
router.delete('/invoices/:id', feeInvoiceController.deleteInvoice);

// Get student fee status
router.get('/students/fee-status', feeInvoiceController.getStudentFeeStatus);

// ========== Fee Payment Routes ==========

// Submit payment
router.post('/payments', feePaymentController.submitPayment);

// Get all payments
router.get('/payments', feePaymentController.getPayments);

// Get payment by ID
router.get('/payments/:id', feePaymentController.getPaymentById);

// Get payment receipt
router.get('/payments/:id/receipt', feePaymentController.getPaymentReceipt);

// Delete/void payment
router.delete('/payments/:id', feePaymentController.deletePayment);

// Get payment statistics
router.get('/payments/stats/summary', feePaymentController.getPaymentStats);

module.exports = router;