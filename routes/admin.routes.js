const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');

const {
  getDashboardStats,
  getAdmins,
  getUsers,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  getAdmin,
  getAllProducts
} = require('../controllers/admin.controller');
const { getAllOrders, getOrdersSilver } = require('../controllers/order.controller');

// Dashboard
router.get('/stats', adminAuth, getDashboardStats);

// Admins
router.get('/admins', adminAuth, getAdmins);
router.post('/admins', adminAuth, addAdmin);
router.get('/admins/:id', adminAuth, getAdmin);
router.put('/admins/:id', adminAuth, updateAdmin);
router.delete('/admins/:id', adminAuth, deleteAdmin);
router.get('/get-products',adminAuth,getAllProducts)
// Users
router.get('/users', adminAuth, getUsers);

router.get('/all-orders', adminAuth, getAllOrders); 
router.get('/silver/all', adminAuth, getOrdersSilver);

module.exports = router;