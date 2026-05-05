const express = require('express');
const router = express.Router();

const {
  getAllCommissions,
  updateCommissions
} = require('../controllers/commission.controller');

// GET
router.get('/silver', getAllCommissions);

// POST
router.post('/silver', updateCommissions);

module.exports = router;