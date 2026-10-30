module.exports = (sequelize, DataTypes) => {
  const BranchDailyRegister = sequelize.define(
    'BranchDailyRegister',
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
        allowNull: true,
      },
      employeeName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.STRING,
        allowNull: false, // YYYY-MM-DD
      },
      dayName: {
        type: DataTypes.STRING,
        allowNull: true, // السبت، الأحد، ...
      },
      entries: {
        type: DataTypes.JSON,
        defaultValue: [],
        // [
        //   {
        //     id: 1,
        //     clientPhone: '079XXXXXXX', // رقم العميل
        //     clientName: 'أحمد محمود', // اسم العميل
        //     weightAndDetails: 'سوار عيار 925 وزن 14 غرام', // الوزن + التفاصيل
        //     expenses: 0, // المصاريف
        //     sales: 45, // مبيعات
        //     paymentMethod: 'نقدي' // نقدي أو فيزا
        //   }
        // ]
      },
      totalGrams: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع الجرامات
      },
      totalSales: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع المبيعات
      },
      totalExpenses: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع المصاريف
      },
      totalVisaSales: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع مبيعات الفيزا
      },
      netTotal: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // صافي المجموع ( المبيعات – المصاريف )
      },
      totalAdvances: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع السلف
      },
      brokenSilverGrams: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع جرامات الكسر (الفضه)
      },
      brokenGoldGrams: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // مجموع جرامات الكسر (الذهب)
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'معتمد', // 'مسودة', 'معتمد'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branch_daily_registers',
    }
  );

  BranchDailyRegister.associate = (models) => {
    BranchDailyRegister.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
    BranchDailyRegister.belongsTo(models.BranchEmployee, {
      foreignKey: 'employeeId',
      as: 'employee',
    });
  };

  return BranchDailyRegister;
};
