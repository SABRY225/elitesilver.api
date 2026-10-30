module.exports = (sequelize, DataTypes) => {
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
      type: DataTypes.DECIMAL(10, 3), 
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
