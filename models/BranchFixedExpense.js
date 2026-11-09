module.exports = (sequelize, DataTypes) => {
  const BranchFixedExpense = sequelize.define(
    'BranchFixedExpense',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      branchId: {
        type: DataTypes.INTEGER,
        allowNull: true, // إذا كانت القيمة فارغة، فهذا يعني مصروفاً ثابتاً عاماً للشركة أو مشتركاً لكافة الفروع
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false, // مثال: إيجار المحل، فاتورة الكهرباء، اشتراك الإنترنت
      },
      amount: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'إيجارات', // إيجارات، فواتير ومرافق، رواتب وإدارية، تسويق، صيانة وخدمات، أخرى
      },
      month: {
        type: DataTypes.STRING,
        allowNull: true, // مثال: 2026-11 أو فارغ/null إذا كان متكرراً شهرياً بشكل دائم
      },
      recurringType: {
        type: DataTypes.STRING,
        defaultValue: 'شهري', // شهري (يتكرر كل شهر تلقائياً) أو مرة واحدة
      },
      paymentStatus: {
        type: DataTypes.STRING,
        defaultValue: 'مدفوع', // مدفوع، مستحق، معلق
      },
      dueDate: {
        type: DataTypes.STRING,
        allowNull: true, // موعد الاستحقاق (مثلاً: يوم 1 من الشهر، أو تاريخ محدد)
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branch_fixed_expenses',
    }
  );

  BranchFixedExpense.associate = (models) => {
    BranchFixedExpense.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
      onDelete: 'CASCADE',
    });
  };

  return BranchFixedExpense;
};

