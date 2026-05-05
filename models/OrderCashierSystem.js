module.exports = (sequelize, DataTypes) => {
  const OrderCashierSystem = sequelize.define('OrderCashierSystem', {
    orderType: {
      type: DataTypes.ENUM('buy', 'sell', 'repair'),
      allowNull: false // تم تصحيح الخطأ الإملائي هنا
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'card'),
      defaultValue: 'cash'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'completed'
    }
  });

  // تعريف العلاقات داخل الدالة لضمان توفر sequelize instance
  OrderCashierSystem.associate = (models) => {
    // 1. علاقة مع المستخدم (العميل)
    // نستخدم models.User بدلاً من استيرادها يدوياً فوق
    OrderCashierSystem.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    // 2. علاقة مع عناصر الفاتورة
    OrderCashierSystem.hasMany(models.OrderItemCashier, {
      foreignKey: 'orderCashierSystemId',
      as: 'items'
    });
  };

  return OrderCashierSystem;
};