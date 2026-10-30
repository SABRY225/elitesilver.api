module.exports = (sequelize, DataTypes) => {
  const EmployeeAdvance = sequelize.define(
    'EmployeeAdvance',
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
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      employeeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      requestDate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'معلق', // 'معلق', 'مقبول', 'مرفوض'
      },
      adminResponseNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approvedByAdminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      approvedByAdminName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      actionDate: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'employee_advances',
    }
  );

  EmployeeAdvance.associate = (models) => {
    EmployeeAdvance.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
    EmployeeAdvance.belongsTo(models.BranchEmployee, {
      foreignKey: 'employeeId',
      as: 'employee',
    });
  };

  return EmployeeAdvance;
};
