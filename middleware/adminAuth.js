// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ where: { id: decoded.id, role: 'admin' } });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (e) {
    res.status(403).json({ success: false, error: 'غير مسموح لك بالوصول. هذه الصلاحية للمديرين فقط.' });
  }
};

module.exports = adminAuth;