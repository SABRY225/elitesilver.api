const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');

const {
  createOrder,
  getAllOrders,
  updateStatus,
  getOrdersByUser,
  createOrderSilver,
  getOrdersSilverByUser,
  getOrdersSilver,
  updateStatusOrderSilver,
  getOrdersMobileByUser,
  createOrderCashierSystem,
  getDashboardStats,
  getFilteredOrders,
  getOrderDetails
} = require('../controllers/order.controller');

// --- 1. المسارات الثابتة (Static Routes) تضعها في الأعلى دائماً ---

// لوحة التحكم (إحصائيات الكاشير)
router.get('/dashboard-stats', adminAuth, getDashboardStats);
router.get('/filter', adminAuth, getFilteredOrders);
router.get('/cashier/details/:id', adminAuth, getOrderDetails);
// --- 2. مسارات الكاشير والنظام ---

router.post('/cashier-system', adminAuth, createOrderCashierSystem); // يُفضل إضافة adminAuth أو كاشير أوث

// --- 3. مسارات إنشاء الطلبات الجديدة ---

router.post('/new', createOrder);
router.post('/silver', createOrderSilver);

// --- 4. مسارات التحديث (Patch) ---

router.patch('/:id/status', adminAuth, updateStatus);
router.patch('/silver/:id/status', adminAuth, updateStatusOrderSilver);

// --- 5. المسارات التي تحتوي على بارامترات متغيره (:userId) تضعها في الأسفل ---

router.get('/mobile/:userId', getOrdersMobileByUser);
router.get('/silver/:userId', getOrdersSilverByUser);
router.get('/:userId', getOrdersByUser); // هذا المسار العام يوضع في النهاية تماماً

module.exports = router;