const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');

const {
  getDashboardStats,
  getAdmins,
  getUsers,
  addAdmin,
  updateAdmin,
  deleteAdmin
} = require('../controllers/admin.controller');
const { getAllOrders, getOrdersSilver } = require('../controllers/order.controller');

// Dashboard
router.get('/stats', adminAuth, getDashboardStats);

// Admins
router.get('/admins', adminAuth, getAdmins);
router.post('/admins', adminAuth, addAdmin);
router.put('/admins/:id', adminAuth, updateAdmin);
router.delete('/admins/:id', adminAuth, deleteAdmin);

// Users
router.get('/users', adminAuth, getUsers);

router.get('/all-orders', adminAuth, getAllOrders); // تغيير المسار قليلاً لتجنب التضارب
router.get('/silver/all', adminAuth, getOrdersSilver);

module.exports = router;