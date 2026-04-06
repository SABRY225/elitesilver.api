// models/index.js
require('dotenv').config();

console.log("process.env.DB_PASSWORD :",process.env.DB_PASSWORD)
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql'
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// استيراد النماذج
db.User = require('./User')(sequelize, DataTypes);
db.Category = require('./Category')(sequelize, DataTypes);
db.Product = require('./Product')(sequelize, DataTypes);
db.Order = require('./Order')(sequelize, DataTypes);
db.Rating = require('./Rating')(sequelize, DataTypes);

// تفعيل العلاقات
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;