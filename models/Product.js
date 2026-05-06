// models/Product.js
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    branch: {
      type: DataTypes.ENUM('اربد', 'خلدا','ابو نصير'),
      defaultValue: 'اربد',
      allowNull:true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    pricePerGram: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    galleryImages: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    weight: {
      type: DataTypes.DECIMAL(8, 3),
      allowNull: true
    },
    silverType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stoneType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stoneColor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    size: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });

  Product.associate = (models) => {
    // Product.belongsTo(models.SubCategory, {
    //   foreignKey: 'subCategoryId',
    //   as: 'subCategory'
    // });
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category'
    });
    Product.hasMany(models.Rating, {
      foreignKey: 'productId',
      as: 'ratings'
    });
  };

  return Product;
};