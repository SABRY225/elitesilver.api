// middleware/userAuth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

const userAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "يرجى التسجيل دخول أولاً" 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "المستخدم غير موجود" 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    
    res.status(401).json({ 
      success: false, 
      message: "توكن غير صحيح أو منتهي الصلاحية" 
    });
  }
};

module.exports = userAuth;
