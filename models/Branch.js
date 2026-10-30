module.exports = (sequelize, DataTypes) => {
  const Branch = sequelize.define(
    'Branch',
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
      code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone3: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      managerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branches',
    }
  );

  Branch.associate = (models) => {
    Branch.hasMany(models.BranchEmployee, {
      foreignKey: 'branchId',
      as: 'employees',
      onDelete: 'CASCADE',
    });
    Branch.hasMany(models.BranchInvoice, {
      foreignKey: 'branchId',
      as: 'invoices',
      onDelete: 'CASCADE',
    });
    Branch.hasMany(models.BranchDailyRegister, {
      foreignKey: 'branchId',
      as: 'dailyRegisters',
      onDelete: 'CASCADE',
    });
    Branch.hasMany(models.BranchInventoryAudit, {
      foreignKey: 'branchId',
      as: 'inventoryAudits',
      onDelete: 'CASCADE',
    });
    Branch.hasMany(models.EmployeeAttendance, {
      foreignKey: 'branchId',
      as: 'attendances',
      onDelete: 'CASCADE',
    });
  };

  return Branch;
};
