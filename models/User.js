// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // لضمان عدم تكرار البريد الإلكتروني
      validate: {
        isEmail: true // التحقق من صيغة البريد
      }
    },
    verificationCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'customer'),
      defaultValue: 'admin' // الافتراضي هو عميل
    }
  }, {
    timestamps: true, // لإنشاء createdAt و updatedAt تلقائياً
  });

  User.associate = (models) => {
    User.hasMany(models.Rating, {
      foreignKey: 'userId',
      as: 'ratings'
    });
  };

  return User;
};