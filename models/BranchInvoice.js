module.exports = (sequelize, DataTypes) => {
  const BranchInvoice = sequelize.define(
    'BranchInvoice',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
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
        allowNull: false,
      },
      paymentType: {
        type: DataTypes.STRING,
        defaultValue: 'نقدي', // 'نقدي' أو 'ذمم'
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: true, // السيد
      },
      customerPhone: {
        type: DataTypes.STRING,
        allowNull: true, // هاتف
      },
      items: {
        type: DataTypes.JSON,
        defaultValue: [],
        // [
        //   {
        //     id: 1,
        //     type: 'خاتم فضة رجالي', // نوع
        //     count: 1, // عدد
        //     karat: '925', // عيار
        //     makerFeeGram: '0', // مأجر الغرام
        //     gramPrice: '0', // سعر الغرام
        //     totalFee: '0', // الأجرة
        //     priceDinar: '25', // دينار
        //     priceFils: '000' // فلس
        //   }
        // ]
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // المجموع
      },
      discount: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // خصم
      },
      total: {
        type: DataTypes.DECIMAL(10, 3),
        defaultValue: 0, // الإجمالي
      },
      recipientName: {
        type: DataTypes.STRING,
        allowNull: true, // اسم المستلم
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'branch_invoices',
    }
  );

  BranchInvoice.associate = (models) => {
    BranchInvoice.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
    });
    BranchInvoice.belongsTo(models.BranchEmployee, {
      foreignKey: 'employeeId',
      as: 'employee',
    });
  };

  return BranchInvoice;
};
