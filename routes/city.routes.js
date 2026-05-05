const express = require('express');
const router = express.Router();

const {
  updateShippingCity,
  deleteShippingCity,
  addShippingCity,
  getShippingCities
} = require('../controllers/city.controller');

// Public (لو عايز تحميها ضيف adminAuth)
router.get('/shipping-cities', getShippingCities);
router.post('/shipping-cities', addShippingCity);
router.put('/shipping-cities/:id', updateShippingCity);
router.delete('/shipping-cities/:id', deleteShippingCity);

module.exports = router;