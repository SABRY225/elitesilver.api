// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // لضمان عدم تكرار البريد الإلكتروني
        validate: {
          isEmail: true, // التحقق من صيغة البريد
        },
      },
      verificationCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: { type: DataTypes.STRING, unique: true, allowNull: false },
      address: { type: DataTypes.TEXT },
      points: { type: DataTypes.INTEGER, defaultValue: 0 },
      role: {
        type: DataTypes.ENUM("admin", "customer"),
        defaultValue: "admin", // الافتراضي هو عميل
      },
      permissions: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
    },
    {
      timestamps: true, // لإنشاء createdAt و updatedAt تلقائياً
    },
  );

  User.associate = (models) => {
    User.hasMany(models.Rating, {
      foreignKey: "userId",
      as: "ratings",
    });
    User.hasMany(models.Order, {
      foreignKey: "userId",
      as: "orders",
    });
  };

  return User;
};
