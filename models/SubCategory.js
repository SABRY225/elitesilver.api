// models/SubCategory.js
module.exports = (sequelize, DataTypes) => {
  const SubCategory = sequelize.define('SubCategory', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, 
    },
        name_en: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, 
    },
  });
  return SubCategory;
};