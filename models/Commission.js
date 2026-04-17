module.exports = (sequelize, DataTypes) => {
const Commission = sequelize.define('Commission', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true 
  },
  value: {
    type: DataTypes.FLOAT, 
    allowNull: false,
    defaultValue: 0
  }
})

return Commission

};