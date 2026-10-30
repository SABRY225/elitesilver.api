module.exports = (sequelize, DataTypes) => {
  const BranchInventoryAudit = sequelize.define(
    'BranchInventoryAudit',
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
      auditTitle: {
        type: DataTypes.STRING,
        allowNull: false, // عنوان الجرد (مثلاً: جرد شهر أكتوبر 2026)
      },
      auditDate: {
        type: DataTypes.STRING,
        allowNull: false, // YYYY-MM-DD
      },
      adminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      adminName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      items: {
        type: DataTypes.JSON,
        defaultValue: [],
        // [
        //   {
        //     id: 1,
        //     category: 'خواتم 925',
        //     description: 'تشكيلة خواتم فضة إسترليني عيار 925 رجالي ونسائي',
        //     systemWeight: 1450.5,
        //     actualWeight: 1448.2,
        //     weightDiff: -2.3,
        //     systemCount: 120,
        //     actualCount: 119,
        //     countDiff: -1,
        //     status: 'عجز',
        //     notes: ''
        //   }
        // ]
      },
      totalSystemWeight: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0,
      },
      totalActualWeight: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0,
      },
      totalWeightDiff: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0,
      },
      totalSystemCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      totalActualCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      overallStatus: {
        type: DataTypes.STRING,
        defaultValue: 'مطابق', // 'مطابق', 'عجز', 'فائض'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branch_inventory_audits',
    }
  );

  BranchInventoryAudit.associate = (models) => {
    BranchInventoryAudit.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
  };

  return BranchInventoryAudit;
};
