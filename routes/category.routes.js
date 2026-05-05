const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const adminAuth = require('../middleware/adminAuth');

const {
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategoryById
} = require('../controllers/customOrder.controller');

// multer
const upload = require('../config/upload');

// Public
router.get('/', getAllCategories);
router.get('/:id', getProductsByCategoryById);

// Admin
router.post('/', adminAuth, upload.single('image'), addCategory);
router.put('/:id', adminAuth, upload.single('image'), updateCategory);
router.delete('/:id', adminAuth, deleteCategory);

module.exports = router;