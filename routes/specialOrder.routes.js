const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  getSpecialOrders,
  updateSpecialOrderStatus,
  createSpecialOrder,
  deleteSpecialOrder
} = require('../controllers/admin.controller');

// المسارات العامة والإدارية لطلبات المناسبات والهدايا
router.get('/', adminAuth, getSpecialOrders);
router.post('/', createSpecialOrder);
router.patch('/:id', adminAuth, updateSpecialOrderStatus);
router.delete('/:id', adminAuth, deleteSpecialOrder);

module.exports = router;
