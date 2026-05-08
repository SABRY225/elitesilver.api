module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define('Favorite', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'favorites',
    timestamps: true 
  });

  Favorite.associate = (models) => {
    Favorite.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return Favorite;
};