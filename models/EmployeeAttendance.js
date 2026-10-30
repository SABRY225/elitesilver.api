module.exports = (sequelize, DataTypes) => {
  const EmployeeAttendance = sequelize.define(
    'EmployeeAttendance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      branchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      date: {
        type: DataTypes.STRING, // YYYY-MM-DD
        allowNull: false,
      },
      dayName: {
        type: DataTypes.STRING, // السبت، الأحد...
        allowNull: true,
      },
      checkInTime: {
        type: DataTypes.STRING, // وقت الدخول e.g. 09:30:15
        allowNull: true,
      },
      checkOutTime: {
        type: DataTypes.STRING, // وقت الخروج e.g. 18:00:20
        allowNull: true,
      },
      totalHours: {
        type: DataTypes.DECIMAL(5, 2), // عدد الساعات e.g. 8.50
        defaultValue: 0,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'حاضر', // حاضر، غياب، متأخر، مغادر مبكراً
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'employee_attendances',
    }
  );

  EmployeeAttendance.associate = (models) => {
    EmployeeAttendance.belongsTo(models.BranchEmployee, {
      foreignKey: 'employeeId',
      as: 'employee',
    });
    EmployeeAttendance.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
  };

  return EmployeeAttendance;
};
