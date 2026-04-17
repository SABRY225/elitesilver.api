const express = require('express');
const cors = require('cors'); // 1. استيراد الحزمة
const app = express();
const db = require('./models');
require('dotenv').config();

// 2. تفعيل الـ CORS (يجب أن يكون قبل تعريف المسارات)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));
// ربط المسارات
app.use('/api', require('./routes/api'));

const PORT = process.env.PORT || 5000;

db.sequelize.sync({ alter: 0}) 
  .then(() => {
    console.log('✅ MySQL Database Connected & Synced');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });