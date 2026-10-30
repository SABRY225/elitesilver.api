const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const BranchEmployee = sequelize.define(
    'BranchEmployee',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      salary: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0,
        allowNull: true,
      },
      nationalId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branch_employees',
      hooks: {
        beforeCreate: async (employee) => {
          if (employee.password) {
            employee.password = await bcrypt.hash(employee.password, 10);
          }
        },
        beforeUpdate: async (employee) => {
          if (employee.changed('password')) {
            employee.password = await bcrypt.hash(employee.password, 10);
          }
        },
      },
    }
  );

  BranchEmployee.prototype.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  };

  BranchEmployee.associate = (models) => {
    BranchEmployee.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
    BranchEmployee.hasMany(models.BranchInvoice, {
      foreignKey: 'employeeId',
      as: 'invoices',
    });
    BranchEmployee.hasMany(models.BranchDailyRegister, {
      foreignKey: 'employeeId',
      as: 'dailyRegisters',
    });
    BranchEmployee.hasMany(models.EmployeeAttendance, {
      foreignKey: 'employeeId',
      as: 'attendances',
    });
  };

  return BranchEmployee;
};
