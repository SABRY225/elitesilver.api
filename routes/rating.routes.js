const express = require('express');
const router = express.Router();

const userAuth = require('../middleware/userAuth');

const {
  addRating,
  getProductRatings,
  updateRating,
  deleteRating,
  getUserRatings,
  getReviewsAdmin,
  deleteRatingByAdmin
} = require('../controllers/rating.controller');

// Public
router.get('/product/:productId', getProductRatings);

// User
router.post('/', userAuth, addRating);
router.put('/:ratingId', userAuth, updateRating);
router.delete('/:ratingId', userAuth, deleteRating);
router.get('/my', userAuth, getUserRatings);

// Admin
router.get('/admin', userAuth, getReviewsAdmin);
router.delete('/admin/:id', userAuth, deleteRatingByAdmin);

module.exports = router;