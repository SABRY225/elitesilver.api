const express = require('express');
const { getCart, syncCart } = require('../controllers/cart.controller');
const router = express.Router();

router.get('/:userId', getCart);
router.post('/sync', syncCart);

module.exports = router;