const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  createCustomOrder,
  getAllOrdersCustom,
  updateOrderCustomStatus,
  updateOrderCustomPrice
} = require('../controllers/customOrder.controller');

// multer
const upload = require('../config/upload');
const { searchCustomer } = require('../controllers/user.controller');

// User
router.post('/order', upload.single('image'), createCustomOrder);

// Admin
router.get('/orders', getAllOrdersCustom);
router.patch('/orders/:id/status', updateOrderCustomStatus);
router.patch('/orders/:id/price', updateOrderCustomPrice);

router.get('/search', searchCustomer);
module.exports = router;