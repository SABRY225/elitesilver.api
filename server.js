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
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Startup error:', err);
  });