module.exports = (sequelize, DataTypes) => {
  const OrderSilver = sequelize.define('OrderSilver', {
 fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  secondaryPhone: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  paymentMethod: {
    type: DataTypes.STRING
  },
    productPrice: {
    type: DataTypes.FLOAT
  },
    productName: {
    type: DataTypes.STRING
  },
  quantity: {
    type: DataTypes.INTEGER
  },
  total_price: {
    type: DataTypes.FLOAT
  },
    status: {
      type: DataTypes.ENUM('جديد', 'قيد التنفيذ','جاري الشحن', 'مكتمل', 'ملغي'),
      defaultValue: 'جديد'
    }
  });
  OrderSilver.associate = (models) => {
    OrderSilver.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    OrderSilver.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'cityInfo'
    });
  };

    return OrderSilver;
}