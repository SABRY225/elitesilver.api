// models/Category.js
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // لمنع تكرار نفس الاسم
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });
  return Category;
};