const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/categories', require('./category.routes'));
router.use('/favorite', require('./favorite.routes'));
router.use('/orders', require('./order.routes'));
router.use('/cart', require('./cart.routes'));
router.use('/reviews', require('./rating.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/city', require('./city.routes'));
router.use('/commissions', require('./commission.routes'));
router.use('/custom', require('./customOrder.routes'));
router.use('/home', require('./home.routes'));
router.use('/branches', require('./branch.routes'));
router.use('/special-orders', require('./specialOrder.routes'));

module.exports = router;