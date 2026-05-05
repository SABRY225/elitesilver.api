const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');

const {
  sendOTP,
  verifyOTP,
  getMe,
  registerAccount,
  login,
  searchCustomer,
  createCustomer
} = require('../controllers/user.controller');

router.post('/register', registerAccount);
router.post('/login', login);
router.post('/login-request', sendOTP);
router.post('/verify-code', verifyOTP);
router.get('/me', adminAuth, getMe);
router.get('/customers/search', searchCustomer);
router.post('/customers/register', createCustomer);

module.exports = router;