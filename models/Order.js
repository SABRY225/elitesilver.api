// models/Order.js
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    customerName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    notes: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('جديد', 'قيد التنفيذ','جاري الشحن', 'مكتمل', 'ملغي'),
      defaultValue: 'جديد'
    }
  });

  Order.associate = (models) => {
    Order.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product'
    });
  };

  return Order;
};