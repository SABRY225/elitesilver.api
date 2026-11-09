require('dotenv').config();

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

const express = require('express');
const cors = require('cors');

const app = express();
const db = require('./models');
require('./services/stockNotifier');
require('./services/dailyRegisterNotifier');
// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', require('./routes'));

app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// Start
db.sequelize.authenticate()
  .then(() => {
    console.log('✅ Database Connected');
    return db.sequelize.sync({ alter: 0 });
  })
  .then(async () => {
    try {
      const [cols] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'targetSales'");
      if (!cols || cols.length === 0) {
        await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN targetSales DECIMAL(10, 3) DEFAULT 0");
        console.log('✅ Added targetSales column to branch_employees');
      }
      const [colsGrams] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'targetGrams'");
      if (!colsGrams || colsGrams.length === 0) {
        await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN targetGrams DECIMAL(10, 3) DEFAULT 0");
        console.log('✅ Added targetGrams column to branch_employees');
      }
      const [colsAllowed] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'allowedBranchIds'");
      if (!colsAllowed || colsAllowed.length === 0) {
        await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN allowedBranchIds TEXT NULL");
        console.log('✅ Added allowedBranchIds column to branch_employees');
      }
    } catch (e) {
      // إكمال التشغيل
    }
    app.listen(PORT, () => {
      console.log(`🚀 EliteSilver Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Startup error:', err);
  });
