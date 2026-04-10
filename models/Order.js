// models/Order.js
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    fullName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    alternatePhone: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT, allowNull: false },
    paymentMethod: { type: DataTypes.ENUM('cod', 'online'), allowNull: false },
    cartItems: { type: DataTypes.JSON, allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    shipping: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    notes: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('جديد', 'قيد التنفيذ','جاري الشحن', 'مكتمل', 'ملغي'),
      defaultValue: 'جديد'
    }
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    Order.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'cityInfo'
    });
  };

  return Order;
};