const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const adminAuth = require('../middleware/adminAuth');

const {
  getAll,
  add,
  deleteProduct,
  updateProduct,
  getProduct,
  searchProducts,
  getProductByMobile
} = require('../controllers/product.controller');

// multer setup
const upload = require('../config/upload');

const uploadMultiple = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: 10 }
]);

// Public
router.get('/', getAll);
router.get('/search', searchProducts);
router.get('/:id', getProduct);
router.get('/mobile/:id', getProductByMobile);

// Admin
router.post('/', adminAuth, uploadMultiple, add);
router.put('/:id', adminAuth, uploadMultiple, updateProduct);
router.delete('/:id', adminAuth, deleteProduct);

module.exports = router;