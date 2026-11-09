module.exports = (sequelize, DataTypes) => {
  const decimalType = (DataTypes && typeof DataTypes.DECIMAL === 'function')
    ? DataTypes.DECIMAL(10, 3)
    : (DataTypes?.DECIMAL || DataTypes?.FLOAT || 'DECIMAL(10,3)');

  const SpecialOrder = sequelize.define('SpecialOrder', {
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    customerName: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    phone: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    occasion: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    budget: { 
      type: decimalType, 
      allowNull: true,
      defaultValue: 0 
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    status: { 
      type: DataTypes.STRING, 
      defaultValue: 'جديد' 
    }
  }, {
    tableName: 'special_orders',
    timestamps: true
  });

  return SpecialOrder;
};
