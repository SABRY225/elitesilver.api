const express = require('express');
const router = express.Router();

const { getHomeData, OrderAndPointsByUser, getInvestmentData } = require('../controllers/home.controller');

router.get('/', getHomeData);
router.get('/investment', getInvestmentData);

router.get('/orders-and-points/:userId', OrderAndPointsByUser);
module.exports = router;