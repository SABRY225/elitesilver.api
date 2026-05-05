module.exports = (sequelize, DataTypes) => {
const CustomOrder = sequelize.define('CustomOrder', {
id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerName: { type: DataTypes.STRING, allowNull: false },
  customerPhone: { type: DataTypes.STRING, allowNull: false },
  customerAddress: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false }, 
  imagePath: { type: DataTypes.STRING, allowNull: false }, 
  price: { type: DataTypes.STRING, allowNull: true }, 
  status: { type: DataTypes.ENUM('new', 'reviewing', 'approved', 'completed','cancelled','shipping'), defaultValue: 'new' }
})

return CustomOrder

};