const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const sendEmailNotificationToAdmin = require('../utils/sendEmailToAdmin');
const sendEmailNotification = require('../utils/sendEmail');

const {
  Branch,
  BranchEmployee,
  BranchInvoice,
  BranchDailyRegister,
  BranchInventoryAudit,
  EmployeeAdvance,
  EmployeeAttendance,
  BranchFixedExpense
} = db;

// التأكد التلقائي من وجود الجداول والأعمدة الجديدة
(async () => {
  try {
    if (EmployeeAttendance) {
      await EmployeeAttendance.sync();
    }
  } catch (e) {
    console.warn("EmployeeAttendance sync check:", e.message);
  }

  try {
    if (BranchFixedExpense) {
      await BranchFixedExpense.sync();
    }
  } catch (e) {
    console.warn("BranchFixedExpense sync check:", e.message);
  }

  try {
    const [emailCols] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'email'");
    if (emailCols.length === 0) {
      await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN email VARCHAR(255) NULL");
    }
  } catch (e) {}

  try {
    const [salaryCols] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'salary'");
    if (salaryCols.length === 0) {
      await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN salary DECIMAL(10, 3) DEFAULT 0 NULL");
    }
  } catch (e) {}

  try {
    const [allowedCols] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'allowedBranchIds'");
    if (allowedCols.length === 0) {
      await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN allowedBranchIds TEXT NULL");
    }
  } catch (e) {}
})();

// دالة مساعدة لجلب كافة الفروع المصرح للموظف بالدوام والعمل فيها
const getEmployeeAllowedBranches = async (employee) => {
  const allActiveBranches = await Branch.findAll({
    where: { isActive: true },
    order: [['id', 'ASC']]
  });

  if (employee.allowedBranchIds === 'all') {
    return allActiveBranches;
  }

  let allowedIds = [];
  if (employee.allowedBranchIds) {
    try {
      const parsed = JSON.parse(employee.allowedBranchIds);
      if (Array.isArray(parsed)) {
        if (parsed.includes('*') || parsed.includes('all')) return allActiveBranches;
        allowedIds = parsed.map(x => Number(x));
      }
    } catch (e) {
      allowedIds = String(employee.allowedBranchIds).split(',').map(x => Number(x.trim())).filter(Boolean);
    }
  }

  if (employee.branchId && !allowedIds.includes(Number(employee.branchId))) {
    allowedIds.push(Number(employee.branchId));
  }

  if (allowedIds.length === 0 && employee.branchId) {
    allowedIds = [Number(employee.branchId)];
  }

  return allActiveBranches.filter(b => allowedIds.includes(b.id));
};

// ==========================================
// 1. الفروع (Branches)
// ==========================================

exports.getAllBranches = async (req, res) => {
  try {
    const branches = await Branch.findAll({
      include: [
        {
          model: BranchEmployee,
          as: 'employees',
          attributes: ['id', 'name', 'username', 'phone', 'email', 'salary', 'isActive']
        }
      ],
      order: [['id', 'ASC']]
    });
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ success: false, message: "فشل في جلب الفروع", error: error.message });
  }
};

// جلب الفروع النشطة لبوابة تسجيل الدخول (بدون تفاصيل سرية)
exports.getPublicBranches = async (req, res) => {
  try {
    const branches = await Branch.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code', 'city', 'address', 'phone'],
      order: [['id', 'ASC']]
    });
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error("Error fetching public branches:", error);
    res.status(500).json({ success: false, message: "فشل في جلب الفروع", error: error.message });
  }
};

exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findByPk(id, {
      include: [
        {
          model: BranchEmployee,
          as: 'employees',
          attributes: ['id', 'name', 'username', 'phone', 'email', 'salary', 'isActive']
        }
      ]
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع غير موجود" });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب الفرع", error: error.message });
  }
};

// إحصائيات ومبيعات الفرع مع إمكانية تحديد الفترة (الشهر الحالي أو فترة محددة)
exports.getBranchStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period, month, fromDate, toDate } = req.query;

    const branch = await Branch.findByPk(id, {
      include: [
        {
          model: BranchEmployee,
          as: 'employees',
          attributes: ['id', 'name', 'username', 'phone', 'salary', 'targetSales', 'targetGrams', 'isActive']
        }
      ]
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع غير موجود" });
    }

    // تحديد شرط التاريخ (Where clause for date)
    let dateWhere = {};
    let resolvedPeriodLabel = '';
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    if (fromDate && toDate) {
      dateWhere = { [Op.between]: [fromDate, toDate] };
      resolvedPeriodLabel = `الفترة من ${fromDate} إلى ${toDate}`;
    } else if (month) {
      dateWhere = { [Op.like]: `${month}%` };
      resolvedPeriodLabel = `شهر ${month}`;
    } else if (period === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      dateWhere = { [Op.like]: `${lastMonth}%` };
      resolvedPeriodLabel = `الشهر الماضي (${lastMonth})`;
    } else if (period === 'all_time') {
      dateWhere = {};
      resolvedPeriodLabel = 'كافة الفترات (جميع المبيعات)';
    } else {
      // الافتراضي: الشهر الحالي
      dateWhere = { [Op.like]: `${currentMonth}%` };
      resolvedPeriodLabel = `الشهر الحالي (${currentMonth})`;
    }

    // 1. جلب فواتير الفرع في هذه الفترة
    const invoiceWhere = { branchId: id };
    if (Object.keys(dateWhere).length > 0) {
      invoiceWhere.date = dateWhere;
    }

    const invoices = await BranchInvoice.findAll({
      where: invoiceWhere,
      include: [
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    // 2. جلب السجلات اليومية للفرع في هذه الفترة
    const registerWhere = { branchId: id };
    if (Object.keys(dateWhere).length > 0) {
      registerWhere.date = dateWhere;
    }

    const dailyRegisters = await BranchDailyRegister.findAll({
      where: registerWhere,
      include: [
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username'] }
      ],
      order: [['date', 'DESC']]
    });

    // 3. احتساب الإحصائيات المالية
    let totalInvoiceSales = 0;
    let cashSales = 0;
    let visaSales = 0;
    let totalDiscount = 0;
    let totalGramsSold = 0;

    const employeeSalesMap = {};
    (branch.employees || []).forEach(emp => {
      employeeSalesMap[emp.id] = {
        employee: emp,
        sales: 0,
        grams: 0,
        invoicesCount: 0
      };
    });

    const timelineMap = {};

    invoices.forEach(inv => {
      const total = parseFloat(inv.total) || 0;
      const discount = parseFloat(inv.discount) || 0;
      totalInvoiceSales += total;
      totalDiscount += discount;

      const isVisa = inv.paymentType !== 'نقدي';
      if (isVisa) {
        visaSales += total;
      } else {
        cashSales += total;
      }

      let invItems = [];
      if (Array.isArray(inv.items)) {
        invItems = inv.items;
      } else if (typeof inv.items === 'string') {
        try { invItems = JSON.parse(inv.items); } catch (e) { invItems = []; }
      }

      let invoiceGrams = 0;
      invItems.forEach(it => {
        const c = parseFloat(it.count) > 0 ? parseFloat(it.count) : 1;
        const w = parseFloat(it.makerFeeGram) || 0;
        invoiceGrams += (c * w);
      });
      totalGramsSold += invoiceGrams;

      if (inv.employeeId) {
        if (!employeeSalesMap[inv.employeeId]) {
          employeeSalesMap[inv.employeeId] = {
            employee: inv.employee || { id: inv.employeeId, name: inv.employeeName || 'موظف' },
            sales: 0,
            grams: 0,
            invoicesCount: 0
          };
        }
        employeeSalesMap[inv.employeeId].sales += total;
        employeeSalesMap[inv.employeeId].grams += invoiceGrams;
        employeeSalesMap[inv.employeeId].invoicesCount += 1;
      }

      const d = inv.date;
      if (!timelineMap[d]) {
        timelineMap[d] = {
          date: d,
          sales: 0,
          cashSales: 0,
          visaSales: 0,
          grams: 0,
          expenses: 0,
          invoicesCount: 0
        };
      }
      timelineMap[d].sales += total;
      if (isVisa) timelineMap[d].visaSales += total;
      else timelineMap[d].cashSales += total;
      timelineMap[d].grams += invoiceGrams;
      timelineMap[d].invoicesCount += 1;
    });

    // 4. احتساب مصاريف وسجلات اليومية
    let totalExpenses = 0;
    let registersTotalSales = 0;
    let registersGrams = 0;
    let brokenSilverGrams = 0;
    let brokenGoldGrams = 0;

    dailyRegisters.forEach(reg => {
      const exp = parseFloat(reg.totalExpenses) || 0;
      const rSales = parseFloat(reg.totalSales) || 0;
      const rGrams = parseFloat(reg.totalGrams) || 0;
      const bSilver = parseFloat(reg.brokenSilverGrams) || 0;
      const bGold = parseFloat(reg.brokenGoldGrams) || 0;

      totalExpenses += exp;
      registersTotalSales += rSales;
      registersGrams += rGrams;
      brokenSilverGrams += bSilver;
      brokenGoldGrams += bGold;

      const d = reg.date;
      if (!timelineMap[d]) {
        timelineMap[d] = {
          date: d,
          sales: rSales,
          cashSales: 0,
          visaSales: parseFloat(reg.totalVisaSales) || 0,
          grams: rGrams,
          expenses: exp,
          invoicesCount: 0
        };
      } else {
        timelineMap[d].expenses += exp;
      }
    });

    const finalSales = totalInvoiceSales > 0 ? totalInvoiceSales : registersTotalSales;
    const finalGrams = totalGramsSold > 0 ? totalGramsSold : registersGrams;
    const netTotal = finalSales - totalExpenses;
    const avgInvoice = invoices.length > 0 ? (totalInvoiceSales / invoices.length) : 0;

    const employeePerformances = Object.values(employeeSalesMap).map(item => {
      const share = finalSales > 0 ? ((item.sales / finalSales) * 100).toFixed(1) : 0;
      return {
        ...item,
        sales: item.sales.toFixed(3),
        grams: item.grams.toFixed(3),
        salesSharePercentage: Number(share)
      };
    }).sort((a, b) => parseFloat(b.sales) - parseFloat(a.sales));

    const timeline = Object.values(timelineMap)
      .map(t => ({
        ...t,
        sales: t.sales.toFixed(3),
        cashSales: t.cashSales.toFixed(3),
        visaSales: t.visaSales.toFixed(3),
        grams: t.grams.toFixed(3),
        expenses: t.expenses.toFixed(3),
        net: (t.sales - t.expenses).toFixed(3)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        city: branch.city,
        address: branch.address,
        phone: branch.phone,
        managerName: branch.managerName,
        employeesCount: (branch.employees || []).length
      },
      period: {
        label: resolvedPeriodLabel,
        month: month || (period === 'last_month' ? 'last_month' : currentMonth),
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      statistics: {
        totalSales: finalSales.toFixed(3),
        invoiceSales: totalInvoiceSales.toFixed(3),
        registerSales: registersTotalSales.toFixed(3),
        cashSales: cashSales.toFixed(3),
        visaSales: visaSales.toFixed(3),
        totalExpenses: totalExpenses.toFixed(3),
        netTotal: netTotal.toFixed(3),
        totalDiscount: totalDiscount.toFixed(3),
        totalGramsSold: finalGrams.toFixed(3),
        brokenSilverGrams: brokenSilverGrams.toFixed(3),
        brokenGoldGrams: brokenGoldGrams.toFixed(3),
        invoicesCount: invoices.length,
        dailyRegistersCount: dailyRegisters.length,
        averageInvoiceValue: avgInvoice.toFixed(3)
      },
      employees: employeePerformances,
      timeline,
      recentInvoices: invoices.slice(0, 15),
      recentRegisters: dailyRegisters.slice(0, 10)
    });
  } catch (error) {
    console.error("Error fetching branch statistics:", error);
    res.status(500).json({ success: false, message: "فشل في جلب إحصائيات الفرع", error: error.message });
  }
};

// ==========================================
// تقرير مشتريات وفواتير الفرع الشامل للتصدير والعرض
// ==========================================
exports.getBranchPurchasesReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { period, month, fromDate, toDate, employeeId, search, paymentType } = req.query;

    const branch = await Branch.findByPk(id, {
      include: [
        {
          model: BranchEmployee,
          as: 'employees',
          attributes: ['id', 'name', 'username', 'phone', 'isActive']
        }
      ]
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع غير موجود" });
    }

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    let dateWhere = {};
    let resolvedPeriodLabel = '';

    if (fromDate && toDate) {
      dateWhere = { [Op.between]: [fromDate, toDate] };
      resolvedPeriodLabel = `الفترة من ${fromDate} إلى ${toDate}`;
    } else if (month) {
      dateWhere = { [Op.like]: `${month}%` };
      resolvedPeriodLabel = `شهر ${month}`;
    } else if (period === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      dateWhere = { [Op.like]: `${lastMonth}%` };
      resolvedPeriodLabel = `الشهر الماضي (${lastMonth})`;
    } else if (period === 'all_time') {
      dateWhere = {};
      resolvedPeriodLabel = 'كافة الفترات (جميع المشتريات)';
    } else {
      dateWhere = { [Op.like]: `${currentMonth}%` };
      resolvedPeriodLabel = `الشهر الحالي (${currentMonth})`;
    }

    // 1. شروط الفواتير
    const invoiceWhere = { branchId: id };
    if (Object.keys(dateWhere).length > 0) invoiceWhere.date = dateWhere;
    if (paymentType) invoiceWhere.paymentType = paymentType;
    if (employeeId) {
      const targetEmp = (branch.employees || []).find(e => String(e.id) === String(employeeId));
      if (targetEmp) {
        invoiceWhere[Op.or] = [
          { employeeId: targetEmp.id },
          { employeeName: targetEmp.name },
          { recipientName: targetEmp.name }
        ];
      } else {
        invoiceWhere.employeeId = employeeId;
      }
    }
    if (search && search.trim()) {
      const term = search.trim();
      const searchCondition = [
        { invoiceNumber: { [Op.like]: `%${term}%` } },
        { customerName: { [Op.like]: `%${term}%` } },
        { customerPhone: { [Op.like]: `%${term}%` } }
      ];
      if (invoiceWhere[Op.or]) {
        invoiceWhere[Op.and] = [
          { [Op.or]: invoiceWhere[Op.or] },
          { [Op.or]: searchCondition }
        ];
        delete invoiceWhere[Op.or];
      } else {
        invoiceWhere[Op.or] = searchCondition;
      }
    }

    const invoices = await BranchInvoice.findAll({
      where: invoiceWhere,
      include: [
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    // 2. شروط السجلات اليومية (المصاريف، الكسر، ومشتريات الفرع)
    const registerWhere = { branchId: id };
    if (Object.keys(dateWhere).length > 0) registerWhere.date = dateWhere;

    const dailyRegisters = await BranchDailyRegister.findAll({
      where: registerWhere,
      include: [
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username'] }
      ],
      order: [['date', 'DESC']]
    });

    // 3. تحليل ومعالجة فواتير المشتريات
    let totalSales = 0;
    let cashSales = 0;
    let visaSales = 0;
    let totalDiscount = 0;
    let totalGrams = 0;
    let totalItemsCount = 0;

    const formattedInvoices = invoices.map(inv => {
      const raw = inv.toJSON ? inv.toJSON() : inv;
      let items = [];
      if (Array.isArray(raw.items)) items = raw.items;
      else if (typeof raw.items === 'string') {
        try { items = JSON.parse(raw.items); } catch (e) { items = []; }
      }

      let invWeight = 0;
      let invItemsCount = 0;
      const itemsFormatted = items.map(it => {
        const c = parseFloat(it.count) > 0 ? parseFloat(it.count) : 1;
        const rawW = it.makerFeeGram !== undefined ? it.makerFeeGram : (it.weight || 0);
        const w = parseFloat(String(rawW).replace(',', '.').trim()) || 0;
        const totalW = c * w;
        invWeight += totalW;
        invItemsCount += c;

        return {
          type: it.type || 'قطعة فضة',
          karat: it.karat || '925',
          count: c,
          gramWeight: w.toFixed(3),
          totalWeight: totalW.toFixed(3),
          gramPrice: it.gramPrice || '0',
          totalFee: it.totalFee || '0',
          priceDinar: it.priceDinar || '0',
          priceFils: it.priceFils || '0'
        };
      });

      const s = parseFloat(raw.total) || 0;
      const d = parseFloat(raw.discount) || 0;
      totalSales += s;
      totalDiscount += d;
      totalGrams += invWeight;
      totalItemsCount += invItemsCount;

      const isVisa = raw.paymentType !== 'نقدي';
      if (isVisa) visaSales += s;
      else cashSales += s;

      return {
        id: raw.id,
        invoiceNumber: raw.invoiceNumber,
        date: raw.date,
        createdAt: raw.createdAt,
        customerName: raw.customerName || 'عميل نقدي',
        customerPhone: raw.customerPhone || '—',
        paymentType: raw.paymentType || 'نقدي',
        employeeId: raw.employeeId,
        employeeName: raw.employee?.name || raw.employeeName || raw.recipientName || '—',
        recipientName: raw.recipientName || '',
        subtotal: parseFloat(raw.subtotal || s + d).toFixed(3),
        discount: d.toFixed(3),
        total: s.toFixed(3),
        totalGrams: invWeight.toFixed(3),
        itemsCount: invItemsCount,
        items: itemsFormatted
      };
    });

    // 4. استخراج حركات مشتريات ومصاريف الفرع والكسر من الدفاتر اليومية
    let totalExpenses = 0;
    let totalBrokenSilver = 0;
    let totalBrokenGold = 0;
    const dailyExpensesAndPurchases = [];

    dailyRegisters.forEach(reg => {
      const regObj = reg.toJSON ? reg.toJSON() : reg;
      let entries = [];
      if (Array.isArray(regObj.entries)) entries = regObj.entries;
      else if (typeof regObj.entries === 'string') {
        try { entries = JSON.parse(regObj.entries); } catch (e) { entries = []; }
      }

      const bSilver = parseFloat(regObj.brokenSilverGrams) || 0;
      const bGold = parseFloat(regObj.brokenGoldGrams) || 0;
      totalBrokenSilver += bSilver;
      totalBrokenGold += bGold;

      entries.forEach((ent, idx) => {
        const exp = parseFloat(ent.expenses) || 0;
        const w = parseFloat(ent.weight) || 0;
        const details = ent.expenseDetails || ent.details || ent.weightAndDetails || '';

        if (exp > 0 || (details && details.trim() && !details.includes('فاتورة #'))) {
          totalExpenses += exp;
          dailyExpensesAndPurchases.push({
            id: `reg-${regObj.id}-${idx}`,
            date: regObj.date,
            dayName: regObj.dayName || '—',
            employeeName: ent.employeeName || regObj.employeeName || regObj.employee?.name || '—',
            type: exp > 0 ? 'مصاريف ومشتريات فرع' : 'حركة يومية / كسر',
            details: details || 'مصروفات ومشتريات متنوعة',
            amount: exp.toFixed(3),
            weightGrams: w > 0 ? w.toFixed(3) : '0.000',
            clientName: ent.clientName || '—',
            clientPhone: ent.clientPhone || '—'
          });
        }
      });
    });

    res.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        city: branch.city,
        address: branch.address,
        phone: branch.phone,
        managerName: branch.managerName,
        employees: branch.employees || []
      },
      period: {
        label: resolvedPeriodLabel,
        period: period || 'current_month',
        month: month || currentMonth,
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      summary: {
        totalSales: totalSales.toFixed(3),
        totalGrams: totalGrams.toFixed(3),
        totalItemsCount,
        invoicesCount: formattedInvoices.length,
        cashSales: cashSales.toFixed(3),
        visaSales: visaSales.toFixed(3),
        totalDiscount: totalDiscount.toFixed(3),
        totalExpenses: totalExpenses.toFixed(3),
        totalBrokenSilver: totalBrokenSilver.toFixed(3),
        totalBrokenGold: totalBrokenGold.toFixed(3),
        netTotal: (totalSales - totalExpenses).toFixed(3)
      },
      invoices: formattedInvoices,
      dailyExpensesAndPurchases
    });
  } catch (error) {
    console.error("Error in getBranchPurchasesReport:", error);
    res.status(500).json({ success: false, message: "فشل في جلب بيانات المشتريات للفرع", error: error.message });
  }
};

// ==========================================
// الإحصائيات المجمعة لعدة فروع مع المصروفات الثابتة
// ==========================================
exports.getAggregateStatistics = async (req, res) => {
  try {
    const { branchIds, period, month, fromDate, toDate } = req.query;

    // 1. تحديد الفروع المطلوبة
    let targetBranchIds = [];
    if (branchIds) {
      if (Array.isArray(branchIds)) {
        targetBranchIds = branchIds.map(id => Number(id)).filter(Boolean);
      } else if (typeof branchIds === 'string') {
        targetBranchIds = branchIds.split(',').map(id => Number(id.trim())).filter(Boolean);
      }
    }

    const branchWhere = {};
    if (targetBranchIds.length > 0) {
      branchWhere.id = { [Op.in]: targetBranchIds };
    } else {
      branchWhere.isActive = true;
    }

    const branches = await Branch.findAll({
      where: branchWhere,
      include: [
        {
          model: BranchEmployee,
          as: 'employees',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'name', 'username', 'phone', 'salary', 'targetSales', 'targetGrams', 'isActive']
        }
      ],
      order: [['name', 'ASC']]
    });

    if (branches.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalSales: '0.000',
          totalCash: '0.000',
          totalVisa: '0.000',
          totalGrams: '0.000',
          totalInvoicesCount: 0,
          totalOperationalExpenses: '0.000',
          totalFixedExpenses: '0.000',
          totalSalaries: '0.000',
          totalExpensesAll: '0.000',
          netTrueProfit: '0.000',
          profitMarginPercentage: 0,
          branchesCount: 0,
          employeesCount: 0
        },
        branchesComparison: [],
        fixedExpensesBreakdown: [],
        timeline: []
      });
    }

    const activeBranchIds = branches.map(b => b.id);

    // 2. تحديد الفترة الزمنية
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    let dateWhere = {};
    let resolvedPeriodLabel = '';
    let targetMonthStr = month || currentMonth;

    if (fromDate && toDate) {
      dateWhere = { [Op.between]: [fromDate, toDate] };
      resolvedPeriodLabel = `الفترة من ${fromDate} إلى ${toDate}`;
      targetMonthStr = fromDate.slice(0, 7);
    } else if (month) {
      dateWhere = { [Op.like]: `${month}%` };
      resolvedPeriodLabel = `شهر ${month}`;
      targetMonthStr = month;
    } else if (period === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      dateWhere = { [Op.like]: `${lastMonth}%` };
      resolvedPeriodLabel = `الشهر الماضي (${lastMonth})`;
      targetMonthStr = lastMonth;
    } else if (period === 'all_time') {
      dateWhere = {};
      resolvedPeriodLabel = 'كافة الفترات (جميع المبيعات)';
    } else {
      dateWhere = { [Op.like]: `${currentMonth}%` };
      resolvedPeriodLabel = `الشهر الحالي (${currentMonth})`;
      targetMonthStr = currentMonth;
    }

    // 3. جلب فواتير الفروع المحددة
    const invoiceWhere = { branchId: activeBranchIds };
    if (Object.keys(dateWhere).length > 0) invoiceWhere.date = dateWhere;

    const invoices = await BranchInvoice.findAll({
      where: invoiceWhere,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    // 4. جلب السجلات اليومية للفروع المحددة
    const registerWhere = { branchId: activeBranchIds };
    if (Object.keys(dateWhere).length > 0) registerWhere.date = dateWhere;

    const dailyRegisters = await BranchDailyRegister.findAll({
      where: registerWhere,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }
      ],
      order: [['date', 'DESC']]
    });

    // 5. جلب المصروفات الثابتة الشهرية
    const fixedExpenseWhere = {
      isActive: true,
      [Op.or]: [
        { branchId: activeBranchIds },
        { branchId: null }
      ]
    };

    if (period !== 'all_time') {
      fixedExpenseWhere[Op.and] = [
        {
          [Op.or]: [
            { month: targetMonthStr },
            { month: null },
            { month: '' },
            { recurringType: 'شهري' }
          ]
        }
      ];
    }

    const fixedExpenses = await BranchFixedExpense.findAll({
      where: fixedExpenseWhere,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }
      ],
      order: [['amount', 'DESC'], ['id', 'ASC']]
    });

    // 6. الحسابات المالية المجمعة وتوزيعها على الفروع
    const branchStatsMap = {};
    branches.forEach(b => {
      const empSalaries = (b.employees || []).reduce((acc, emp) => acc + (parseFloat(emp.salary) || 0), 0);
      branchStatsMap[b.id] = {
        branch: {
          id: b.id,
          name: b.name,
          code: b.code || `BR-${b.id}`,
          city: b.city,
          address: b.address,
          managerName: b.managerName,
          employeesCount: (b.employees || []).length
        },
        sales: 0,
        cashSales: 0,
        visaSales: 0,
        grams: 0,
        invoicesCount: 0,
        dailyExpenses: 0,
        fixedExpenses: 0,
        salaries: empSalaries,
        brokenSilverGrams: 0,
        brokenGoldGrams: 0,
        fixedExpensesItems: []
      };
    });

    let totalInvoiceSales = 0;
    let totalCashSales = 0;
    let totalVisaSales = 0;
    let totalGramsSold = 0;
    let totalDiscount = 0;
    const timelineMap = {};

    invoices.forEach(inv => {
      const bId = inv.branchId;
      const total = parseFloat(inv.total) || 0;
      const discount = parseFloat(inv.discount) || 0;
      totalInvoiceSales += total;
      totalDiscount += discount;

      const isVisa = inv.paymentType !== 'نقدي';
      if (isVisa) totalVisaSales += total;
      else totalCashSales += total;

      let invItems = [];
      if (Array.isArray(inv.items)) invItems = inv.items;
      else if (typeof inv.items === 'string') {
        try { invItems = JSON.parse(inv.items); } catch (e) { invItems = []; }
      }

      let invGrams = 0;
      invItems.forEach(it => {
        const c = parseFloat(it.count) > 0 ? parseFloat(it.count) : 1;
        const w = parseFloat(it.makerFeeGram) || 0;
        invGrams += (c * w);
      });
      totalGramsSold += invGrams;

      if (branchStatsMap[bId]) {
        branchStatsMap[bId].sales += total;
        if (isVisa) branchStatsMap[bId].visaSales += total;
        else branchStatsMap[bId].cashSales += total;
        branchStatsMap[bId].grams += invGrams;
        branchStatsMap[bId].invoicesCount += 1;
      }

      const d = inv.date;
      if (!timelineMap[d]) {
        timelineMap[d] = {
          date: d,
          sales: 0,
          cashSales: 0,
          visaSales: 0,
          grams: 0,
          dailyExpenses: 0,
          invoicesCount: 0
        };
      }
      timelineMap[d].sales += total;
      if (isVisa) timelineMap[d].visaSales += total;
      else timelineMap[d].cashSales += total;
      timelineMap[d].grams += invGrams;
      timelineMap[d].invoicesCount += 1;
    });

    // 7. احتساب السجلات اليومية والمصاريف التشغيلية
    let totalDailyExpenses = 0;
    let totalBrokenSilver = 0;
    let totalBrokenGold = 0;

    dailyRegisters.forEach(reg => {
      const bId = reg.branchId;
      const exp = parseFloat(reg.totalExpenses) || 0;
      const bSilver = parseFloat(reg.brokenSilverGrams) || 0;
      const bGold = parseFloat(reg.brokenGoldGrams) || 0;

      totalDailyExpenses += exp;
      totalBrokenSilver += bSilver;
      totalBrokenGold += bGold;

      if (branchStatsMap[bId]) {
        branchStatsMap[bId].dailyExpenses += exp;
        branchStatsMap[bId].brokenSilverGrams += bSilver;
        branchStatsMap[bId].brokenGoldGrams += bGold;
      }

      const d = reg.date;
      if (timelineMap[d]) {
        timelineMap[d].dailyExpenses += exp;
      } else {
        timelineMap[d] = {
          date: d,
          sales: 0,
          cashSales: 0,
          visaSales: 0,
          grams: 0,
          dailyExpenses: exp,
          invoicesCount: 0
        };
      }
    });

    // 8. احتساب المصروفات الثابتة
    let totalFixedExpenses = 0;
    const generalFixedExpenses = [];
    const fixedExpensesByCategory = {};

    fixedExpenses.forEach(fe => {
      const amt = parseFloat(fe.amount) || 0;
      totalFixedExpenses += amt;

      const cat = fe.category || 'أخرى';
      fixedExpensesByCategory[cat] = (fixedExpensesByCategory[cat] || 0) + amt;

      if (fe.branchId && branchStatsMap[fe.branchId]) {
        branchStatsMap[fe.branchId].fixedExpenses += amt;
        branchStatsMap[fe.branchId].fixedExpensesItems.push(fe);
      } else if (!fe.branchId) {
        generalFixedExpenses.push(fe);
      }
    });

    // توزيع المصروفات الثابتة العامة بالتساوي على الفروع المختارة
    if (generalFixedExpenses.length > 0 && branches.length > 0) {
      const generalTotal = generalFixedExpenses.reduce((acc, fe) => acc + (parseFloat(fe.amount) || 0), 0);
      const perBranchGeneral = generalTotal / branches.length;
      branches.forEach(b => {
        if (branchStatsMap[b.id]) {
          branchStatsMap[b.id].fixedExpenses += perBranchGeneral;
          branchStatsMap[b.id].fixedExpensesItems.push(...generalFixedExpenses);
        }
      });
    }

    // 9. تجميع إجمالي الرواتب وكافة المصاريف وصافي الأرباح
    const totalSalaries = branches.reduce((acc, b) => {
      return acc + (branchStatsMap[b.id]?.salaries || 0);
    }, 0);

    const totalAllExpenses = totalDailyExpenses + totalFixedExpenses + totalSalaries;
    const netProfit = totalInvoiceSales - totalAllExpenses;
    const profitMargin = totalInvoiceSales > 0 ? ((netProfit / totalInvoiceSales) * 100).toFixed(1) : '0.0';

    // 10. إعداد جدول مقارنة الفروع
    const branchesComparison = branches.map(b => {
      const st = branchStatsMap[b.id];
      const bSales = st.sales;
      const bDailyExp = st.dailyExpenses;
      const bFixedExp = st.fixedExpenses;
      const bSalaries = st.salaries;
      const bTotalExp = bDailyExp + bFixedExp + bSalaries;
      const bNet = bSales - bTotalExp;
      const bSalesShare = totalInvoiceSales > 0 ? ((bSales / totalInvoiceSales) * 100).toFixed(1) : '0.0';
      const bMargin = bSales > 0 ? ((bNet / bSales) * 100).toFixed(1) : '0.0';

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code || `BR-${b.id}`,
        city: b.city,
        sales: bSales.toFixed(3),
        salesShare: Number(bSalesShare),
        grams: st.grams.toFixed(3),
        invoicesCount: st.invoicesCount,
        cashSales: st.cashSales.toFixed(3),
        visaSales: st.visaSales.toFixed(3),
        dailyExpenses: bDailyExp.toFixed(3),
        fixedExpenses: bFixedExp.toFixed(3),
        salaries: bSalaries.toFixed(3),
        totalExpenses: bTotalExp.toFixed(3),
        netProfit: bNet.toFixed(3),
        profitMargin: Number(bMargin),
        employeesCount: st.branch.employeesCount,
        brokenSilverGrams: st.brokenSilverGrams.toFixed(3),
        brokenGoldGrams: st.brokenGoldGrams.toFixed(3)
      };
    }).sort((a, b) => parseFloat(b.sales) - parseFloat(a.sales));

    const timeline = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      period: {
        label: resolvedPeriodLabel,
        period: period || 'current_month',
        month: targetMonthStr,
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      selectedBranchesCount: branches.length,
      selectedBranches: branches.map(b => ({ id: b.id, name: b.name, code: b.code, city: b.city })),
      summary: {
        totalSales: totalInvoiceSales.toFixed(3),
        totalGramsSold: totalGramsSold.toFixed(3),
        invoicesCount: invoices.length,
        cashSales: totalCashSales.toFixed(3),
        visaSales: totalVisaSales.toFixed(3),
        totalDiscount: totalDiscount.toFixed(3),
        dailyExpenses: totalDailyExpenses.toFixed(3),
        fixedExpenses: totalFixedExpenses.toFixed(3),
        totalSalaries: totalSalaries.toFixed(3),
        totalAllExpenses: totalAllExpenses.toFixed(3),
        netProfit: netProfit.toFixed(3),
        profitMargin: Number(profitMargin),
        brokenSilverGrams: totalBrokenSilver.toFixed(3),
        brokenGoldGrams: totalBrokenGold.toFixed(3),
        averageInvoiceValue: invoices.length > 0 ? (totalInvoiceSales / invoices.length).toFixed(3) : '0.000'
      },
      branchesComparison,
      fixedExpensesByCategory,
      fixedExpensesList: fixedExpenses,
      timeline
    });
  } catch (error) {
    console.error("Error in getAggregateStatistics:", error);
    res.status(500).json({ success: false, message: "فشل في جلب الإحصائيات المجمعة للفروع", error: error.message });
  }
};

// ==========================================
// إدارة المصروفات الثابتة الشهرية للفروع
// ==========================================
exports.getBranchFixedExpenses = async (req, res) => {
  try {
    const { branchId, category, month } = req.query;
    const where = {};
    if (branchId) where.branchId = branchId;
    if (category) where.category = category;
    if (month) {
      where[Op.or] = [
        { month },
        { month: null },
        { month: '' },
        { recurringType: 'شهري' }
      ];
    }

    const expenses = await BranchFixedExpense.findAll({
      where,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }
      ],
      order: [['id', 'DESC']]
    });

    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error("Error fetching branch fixed expenses:", error);
    res.status(500).json({ success: false, message: "فشل في جلب المصروفات الثابتة", error: error.message });
  }
};

exports.createBranchFixedExpense = async (req, res) => {
  try {
    const {
      branchId,
      title,
      amount,
      category,
      month,
      recurringType,
      paymentStatus,
      dueDate,
      notes
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: "بند المصروف الثابت مطلوب (مثال: إيجار الفرع)" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ success: false, message: "يرجى إدخال مبلغ صحيح للمصروف" });
    }

    const expense = await BranchFixedExpense.create({
      branchId: branchId ? Number(branchId) : null,
      title: title.trim(),
      amount: numAmount,
      category: category || 'إيجارات',
      month: month || null,
      recurringType: recurringType || 'شهري',
      paymentStatus: paymentStatus || 'مدفوع',
      dueDate: dueDate || null,
      notes: notes || null,
      isActive: true
    });

    const created = await BranchFixedExpense.findByPk(expense.id, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }]
    });

    res.status(201).json({
      success: true,
      message: `تمت إضافة المصروف الثابت (${title}) بنجاح بمبلغ ${numAmount.toFixed(3)} د.أ`,
      data: created
    });
  } catch (error) {
    console.error("Error creating branch fixed expense:", error);
    res.status(500).json({ success: false, message: "فشل في إضافة المصروف الثابت", error: error.message });
  }
};

exports.updateBranchFixedExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await BranchFixedExpense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: "المصروف الثابت غير موجود" });
    }

    const {
      branchId,
      title,
      amount,
      category,
      month,
      recurringType,
      paymentStatus,
      dueDate,
      notes,
      isActive
    } = req.body;

    await expense.update({
      branchId: branchId !== undefined ? (branchId ? Number(branchId) : null) : expense.branchId,
      title: title ? title.trim() : expense.title,
      amount: amount !== undefined ? parseFloat(amount) : expense.amount,
      category: category !== undefined ? category : expense.category,
      month: month !== undefined ? month : expense.month,
      recurringType: recurringType !== undefined ? recurringType : expense.recurringType,
      paymentStatus: paymentStatus !== undefined ? paymentStatus : expense.paymentStatus,
      dueDate: dueDate !== undefined ? dueDate : expense.dueDate,
      notes: notes !== undefined ? notes : expense.notes,
      isActive: isActive !== undefined ? isActive : expense.isActive
    });

    const updated = await BranchFixedExpense.findByPk(id, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }]
    });

    res.json({
      success: true,
      message: "تم تحديث المصروف الثابت بنجاح",
      data: updated
    });
  } catch (error) {
    console.error("Error updating branch fixed expense:", error);
    res.status(500).json({ success: false, message: "فشل في تعديل المصروف الثابت", error: error.message });
  }
};

exports.deleteBranchFixedExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await BranchFixedExpense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: "المصروف الثابت غير موجود" });
    }

    await expense.destroy();
    res.json({ success: true, message: "تم حذف المصروف الثابت بنجاح" });
  } catch (error) {
    console.error("Error deleting branch fixed expense:", error);
    res.status(500).json({ success: false, message: "فشل في حذف المصروف الثابت", error: error.message });
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name, code, city, address, phone, phone2, phone3, managerName, isActive, notes } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: "اسم الفرع مطلوب" });
    }

    const branch = await Branch.create({
      name: name.trim(),
      code: code ? code.trim() : null,
      city: city || 'عمان',
      address,
      phone,
      phone2,
      phone3,
      managerName,
      isActive: isActive !== undefined ? isActive : true,
      notes
    });

    res.status(201).json({ success: true, message: "تم إنشاء الفرع بنجاح", data: branch });
  } catch (error) {
    console.error("Error creating branch:", error);
    res.status(500).json({ success: false, message: "فشل في إنشاء الفرع", error: error.message });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findByPk(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع غير موجود" });
    }

    const { name, code, city, address, phone, phone2, phone3, managerName, isActive, notes } = req.body;
    await branch.update({
      name: name !== undefined ? name.trim() : branch.name,
      code: code !== undefined ? code.trim() : branch.code,
      city: city !== undefined ? city : branch.city,
      address: address !== undefined ? address : branch.address,
      phone: phone !== undefined ? phone : branch.phone,
      phone2: phone2 !== undefined ? phone2 : branch.phone2,
      phone3: phone3 !== undefined ? phone3 : branch.phone3,
      managerName: managerName !== undefined ? managerName : branch.managerName,
      isActive: isActive !== undefined ? isActive : branch.isActive,
      notes: notes !== undefined ? notes : branch.notes
    });

    res.json({ success: true, message: "تم تحديث بيانات الفرع بنجاح", data: branch });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تحديث الفرع", error: error.message });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findByPk(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع غير موجود" });
    }

    // حذف موظفي الفرع
    await BranchEmployee.destroy({ where: { branchId: id } });
    await branch.destroy();

    res.json({ success: true, message: "تم حذف الفرع وموظفيه بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في حذف الفرع", error: error.message });
  }
};

// ==========================================
// 2. موظفو الفروع (Employees)
// ==========================================

exports.getAllEmployees = async (req, res) => {
  try {
    const { branchId } = req.query;
    const where = {};
    if (branchId) where.branchId = branchId;

    const allBranches = await Branch.findAll({
      attributes: ['id', 'name', 'city', 'code', 'isActive'],
      order: [['id', 'ASC']]
    });

    const employees = await BranchEmployee.findAll({
      where,
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'city', 'code'] }],
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });

    const enrichedEmployees = employees.map(emp => {
      const data = emp.toJSON();
      if (data.allowedBranchIds === 'all') {
        data.allowedBranches = allBranches;
        data.isAllBranches = true;
      } else {
        let ids = [];
        if (data.allowedBranchIds) {
          try {
            const parsed = JSON.parse(data.allowedBranchIds);
            if (Array.isArray(parsed)) {
              if (parsed.includes('*') || parsed.includes('all')) {
                data.allowedBranches = allBranches;
                data.isAllBranches = true;
                return data;
              }
              ids = parsed.map(x => Number(x));
            }
          } catch (e) {
            ids = String(data.allowedBranchIds).split(',').map(x => Number(x.trim())).filter(Boolean);
          }
        }
        if (data.branchId && !ids.includes(Number(data.branchId))) {
          ids.push(Number(data.branchId));
        }
        data.allowedBranches = allBranches.filter(b => ids.includes(b.id));
        data.isAllBranches = false;
      }
      return data;
    });

    res.json({ success: true, data: enrichedEmployees });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب الموظفين", error: error.message });
  }
};

exports.createBranchEmployee = async (req, res) => {
  try {
    const { branchId, allowedBranchIds, name, username, password, phone, email, salary, nationalId, targetSales, targetGrams } = req.body;
    if (!branchId || !name || !username || !password) {
      return res.status(400).json({ success: false, message: "يرجى تعبئة جميع الحقول الإلزامية: الفرع، الاسم، اسم المستخدم، كلمة المرور" });
    }

    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع المحدد غير موجود" });
    }

    const existing = await BranchEmployee.findOne({ where: { username: username.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ success: false, message: "اسم المستخدم مستخدم بالفعل، اختر اسماً آخر" });
    }

    let finalAllowedBranchIds = null;
    if (allowedBranchIds === 'all') {
      finalAllowedBranchIds = 'all';
    } else if (Array.isArray(allowedBranchIds)) {
      finalAllowedBranchIds = JSON.stringify(allowedBranchIds.map(Number));
    } else if (typeof allowedBranchIds === 'string') {
      finalAllowedBranchIds = allowedBranchIds;
    }

    // التأكد من وجود العمود في قاعدة البيانات
    try {
      const [colsAllowed] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'allowedBranchIds'");
      if (!colsAllowed || colsAllowed.length === 0) {
        await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN allowedBranchIds TEXT NULL");
      }
    } catch (e) {}

    const employee = await BranchEmployee.create({
      branchId,
      allowedBranchIds: finalAllowedBranchIds,
      name,
      username: username.toLowerCase().trim(),
      password,
      phone,
      email: email ? email.trim() : null,
      salary: salary !== undefined && salary !== '' ? parseFloat(salary) : 0,
      targetSales: targetSales !== undefined && targetSales !== '' ? parseFloat(targetSales) : 0,
      targetGrams: targetGrams !== undefined && targetGrams !== '' ? parseFloat(targetGrams) : 0,
      nationalId,
      isActive: true
    });

    if (finalAllowedBranchIds) {
      try {
        await db.sequelize.query("UPDATE branch_employees SET allowedBranchIds = :val WHERE id = :id", {
          replacements: { val: finalAllowedBranchIds, id: employee.id }
        });
      } catch (e) {}
    }

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;

    res.status(201).json({ success: true, message: "تمت إضافة الموظف بنجاح", data: safeEmployee });
  } catch (error) {
    console.error("Error creating branch employee:", error);
    res.status(500).json({ success: false, message: "فشل في إضافة الموظف", error: error.message });
  }
};

exports.updateBranchEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await BranchEmployee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    // التأكد من وجود العمود في قاعدة البيانات
    try {
      const [colsAllowed] = await db.sequelize.query("SHOW COLUMNS FROM branch_employees LIKE 'allowedBranchIds'");
      if (!colsAllowed || colsAllowed.length === 0) {
        await db.sequelize.query("ALTER TABLE branch_employees ADD COLUMN allowedBranchIds TEXT NULL");
      }
    } catch (e) {}

    const { branchId, allowedBranchIds, name, username, password, phone, email, salary, nationalId, isActive, targetSales, targetGrams } = req.body;

    if (username && username.toLowerCase().trim() !== employee.username) {
      const existing = await BranchEmployee.findOne({ where: { username: username.toLowerCase().trim() } });
      if (existing) {
        return res.status(400).json({ success: false, message: "اسم المستخدم مستخدم مسبقاً" });
      }
      employee.username = username.toLowerCase().trim();
    }

    if (branchId) employee.branchId = Number(branchId);
    let resolvedAllowed = employee.allowedBranchIds;
    if (allowedBranchIds !== undefined) {
      if (allowedBranchIds === 'all') {
        resolvedAllowed = 'all';
      } else if (Array.isArray(allowedBranchIds)) {
        resolvedAllowed = JSON.stringify(allowedBranchIds.map(Number));
      } else {
        resolvedAllowed = allowedBranchIds ? String(allowedBranchIds) : null;
      }
      employee.allowedBranchIds = resolvedAllowed;
    }

    if (name) employee.name = name;
    if (phone !== undefined) employee.phone = phone;
    if (email !== undefined) employee.email = email ? email.trim() : null;
    if (salary !== undefined) employee.salary = salary !== '' ? parseFloat(salary) : 0;
    if (targetSales !== undefined) employee.targetSales = targetSales !== '' ? parseFloat(targetSales) : 0;
    if (targetGrams !== undefined) employee.targetGrams = targetGrams !== '' ? parseFloat(targetGrams) : 0;
    if (nationalId !== undefined) employee.nationalId = nationalId;
    if (isActive !== undefined) employee.isActive = isActive;
    if (password && password.trim() !== '') {
      employee.password = password; // Hook will hash it
    }

    await employee.save();

    // تحديث مباشر كضمان للتنفيذ في جدول قاعدة البيانات
    if (allowedBranchIds !== undefined) {
      try {
        await db.sequelize.query("UPDATE branch_employees SET allowedBranchIds = :val WHERE id = :id", {
          replacements: { val: resolvedAllowed, id: employee.id }
        });
      } catch (e) {
        console.error("Direct update error:", e.message);
      }
    }

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;

    res.json({ success: true, message: "تم تحديث بيانات الموظف بنجاح", data: safeEmployee });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تحديث بيانات الموظف", error: error.message });
  }
};

// تحديث سريع لتارجت المبيعات وتارجت الجرامات لموظف
exports.updateEmployeeTargets = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetSales, targetGrams } = req.body;

    const employee = await BranchEmployee.findByPk(id, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    if (targetSales !== undefined) {
      employee.targetSales = targetSales !== '' ? parseFloat(targetSales) : 0;
    }
    if (targetGrams !== undefined) {
      employee.targetGrams = targetGrams !== '' ? parseFloat(targetGrams) : 0;
    }

    await employee.save();

    res.json({
      success: true,
      message: `تم تحديث تارجت الموظف (${employee.name}) بنجاح`,
      data: {
        id: employee.id,
        name: employee.name,
        targetSales: employee.targetSales,
        targetGrams: employee.targetGrams
      }
    });
  } catch (error) {
    console.error("Error updating employee targets:", error);
    res.status(500).json({ success: false, message: "فشل في تحديث تارجت الموظف", error: error.message });
  }
};


// ==========================================
// دالة مركزية لاحتساب إنجاز تارجت الموظف (المبيعات + الجرامات)
// تؤثر عليها الفواتير الصادرة باسم الموظف وكذلك حركات المبيعات في السجل اليومي
// ==========================================
async function calculateEmployeeTargetProgress(employeeId, targetMonth = null) {
  try {
    const emp = await BranchEmployee.findByPk(employeeId, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city'] }],
      attributes: { exclude: ['password'] }
    });
    if (!emp) return null;

    const monthStr = targetMonth || new Date().toISOString().slice(0, 7);

    // 1. جلب فواتير الموظف الرسمية في هذا الشهر (مع التحقق بالـ ID أو الاسم)
    const invoices = await BranchInvoice.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { employeeId: emp.id },
              { employeeName: emp.name },
              { recipientName: emp.name }
            ]
          },
          { date: { [Op.like]: `${monthStr}%` } }
        ]
      },
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    let achievedSales = 0;
    let achievedGrams = 0;

    const formattedInvoices = invoices.map(inv => {
      // ربط المعرف بالموظف تلقائياً إذا كان مفقوداً في الفواتير السابقة
      if (!inv.employeeId && emp.id) {
        inv.update({ employeeId: emp.id, employeeName: emp.name }).catch(() => {});
      }

      const invTotal = parseFloat(inv.total) || 0;
      achievedSales += invTotal;

      let invItems = [];
      if (Array.isArray(inv.items)) {
        invItems = inv.items;
      } else if (typeof inv.items === 'string') {
        try { invItems = JSON.parse(inv.items); } catch (e) { invItems = []; }
      }

      let invWeight = 0;
      invItems.forEach(item => {
        const count = parseFloat(item.count) > 0 ? parseFloat(item.count) : 1;
        const rawWeight = item.makerFeeGram !== undefined ? item.makerFeeGram : (item.weight || item.gram || 0);
        const weight = parseFloat(String(rawWeight).replace(',', '.').trim()) || 0;
        invWeight += (count * weight);
      });

      achievedGrams += invWeight;

      const rawInv = inv.toJSON ? inv.toJSON() : inv;
      return {
        ...rawInv,
        weightGrams: invWeight > 0 ? invWeight.toFixed(3) : '0.000'
      };
    });

    // 2. فحص السجلات اليومية لنفس الفرع في هذا الشهر لاحتساب أي عمليات وحركات إضافية سجلها الموظف
    const registers = await BranchDailyRegister.findAll({
      where: {
        branchId: emp.branchId,
        date: { [Op.like]: `${monthStr}%` }
      }
    });

    let additionalRegisterSales = 0;
    let additionalRegisterGrams = 0;
    let additionalMovementsCount = 0;

    registers.forEach(reg => {
      let entries = [];
      if (Array.isArray(reg.entries)) {
        entries = reg.entries;
      } else if (typeof reg.entries === 'string') {
        try { entries = JSON.parse(reg.entries); } catch (e) { entries = []; }
      }

      entries.forEach(entry => {
        const isThisEmployee = (entry.employeeId && String(entry.employeeId) === String(emp.id)) ||
                               (entry.employeeName && entry.employeeName === emp.name);

        if (isThisEmployee) {
          // التحقق من عدم احتساب الفاتورة مرتين إذا كانت مسجلة بالفعل في جدول الفواتير
          const isAlreadyInInvoices = formattedInvoices.some(inv =>
            (entry.invoiceId && String(entry.invoiceId) === String(inv.id)) ||
            (entry.invoiceNumber && String(entry.invoiceNumber) === String(inv.invoiceNumber)) ||
            (entry.weightAndDetails && entry.weightAndDetails.includes(`فاتورة #${inv.invoiceNumber}`))
          );

          if (!isAlreadyInInvoices) {
            const s = parseFloat(entry.sales) || 0;
            const g = parseFloat(String(entry.weight || 0).replace(',', '.').trim()) || 0;
            if (s > 0 || g > 0) {
              additionalRegisterSales += s;
              additionalRegisterGrams += g;
              additionalMovementsCount++;
            }
          }
        }
      });
    });

    achievedSales += additionalRegisterSales;
    achievedGrams += additionalRegisterGrams;

    const targetSales = parseFloat(emp.targetSales) || 0;
    const targetGrams = parseFloat(emp.targetGrams) || 0;

    const salesPercentage = targetSales > 0 ? Number(((achievedSales / targetSales) * 100).toFixed(1)) : 0;
    const gramsPercentage = targetGrams > 0 ? Number(((achievedGrams / targetGrams) * 100).toFixed(1)) : 0;

    const salesRemaining = Math.max(0, targetSales - achievedSales).toFixed(3);
    const gramsRemaining = Math.max(0, targetGrams - achievedGrams).toFixed(3);

    let overallStatus = 'in_progress';
    if (targetSales > 0 && targetGrams > 0) {
      if (achievedSales >= targetSales && achievedGrams >= targetGrams) {
        overallStatus = 'completed';
      } else if (achievedSales >= targetSales || achievedGrams >= targetGrams) {
        overallStatus = 'partial';
      } else if (salesPercentage >= 70 && gramsPercentage >= 70) {
        overallStatus = 'on_track';
      }
    } else if (targetSales > 0 && achievedSales >= targetSales) {
      overallStatus = 'completed';
    } else if (targetGrams > 0 && achievedGrams >= targetGrams) {
      overallStatus = 'completed';
    }

    return {
      month: monthStr,
      period: monthStr,
      employee: emp,
      targetSales: targetSales.toFixed(3),
      achievedSales: achievedSales.toFixed(3),
      monthSales: Number(achievedSales.toFixed(3)),
      salesPercentage,
      salesRemaining,

      targetGrams: targetGrams.toFixed(3),
      achievedGrams: achievedGrams.toFixed(3),
      monthGrams: Number(achievedGrams.toFixed(3)),
      gramsPercentage,
      gramsRemaining,

      invoicesCount: formattedInvoices.length,
      additionalMovementsCount,
      totalOperationsCount: formattedInvoices.length + additionalMovementsCount,
      overallStatus,
      recentInvoices: formattedInvoices.slice(0, 15)
    };
  } catch (err) {
    console.error("Error calculating employee target progress:", err);
    return null;
  }
}


// متابعة أداء وتارجت موظفي الفروع (بالفلوس وبالجرامات)
exports.getEmployeeTargetsPerformance = async (req, res) => {
  try {
    const { branchId, month, fromDate, toDate } = req.query;

    // تحديد الشهر المطلوب أو الحالي افتراضياً (YYYY-MM)
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let dateWhere = {};
    if (fromDate && toDate) {
      dateWhere = { [Op.between]: [fromDate, toDate] };
    } else if (targetMonth) {
      dateWhere = { [Op.like]: `${targetMonth}%` };
    }

    const empWhere = {};
    if (branchId) empWhere.branchId = branchId;

    const employees = await BranchEmployee.findAll({
      where: empWhere,
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] }],
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });

    const performanceData = await Promise.all(employees.map(async (emp) => {
      // 1. جلب فواتير الموظف في الفترة المحددة
      const invoices = await BranchInvoice.findAll({
        where: {
          employeeId: emp.id,
          date: dateWhere
        },
        order: [['date', 'DESC']]
      });

      let achievedSales = 0;
      let achievedGrams = 0;

      invoices.forEach(inv => {
        achievedSales += parseFloat(inv.total) || 0;

        let invItems = [];
        if (Array.isArray(inv.items)) {
          invItems = inv.items;
        } else if (typeof inv.items === 'string') {
          try { invItems = JSON.parse(inv.items); } catch (e) { invItems = []; }
        }

        invItems.forEach(item => {
          const count = parseFloat(item.count) > 0 ? parseFloat(item.count) : 1;
          const weight = parseFloat(item.makerFeeGram) || 0;
          achievedGrams += (count * weight);
        });
      });

      // 2. فحص السجلات اليومية للموظف في حال وجود مبيعات أو جرامات مسجلة
      const registers = await BranchDailyRegister.findAll({
        where: {
          employeeId: emp.id,
          date: dateWhere
        }
      });

      let registerGrams = 0;
      registers.forEach(reg => {
        registerGrams += parseFloat(reg.totalGrams) || 0;
      });

      if (registerGrams > achievedGrams) {
        achievedGrams = registerGrams;
      }

      const targetSales = parseFloat(emp.targetSales) || 0;
      const targetGrams = parseFloat(emp.targetGrams) || 0;

      const salesPercentage = targetSales > 0 ? (achievedSales / targetSales) * 100 : 0;
      const gramsPercentage = targetGrams > 0 ? (achievedGrams / targetGrams) * 100 : 0;

      const salesRemaining = Math.max(0, targetSales - achievedSales);
      const gramsRemaining = Math.max(0, targetGrams - achievedGrams);

      let overallStatus = 'in_progress';
      if (targetSales > 0 && targetGrams > 0) {
        if (achievedSales >= targetSales && achievedGrams >= targetGrams) {
          overallStatus = 'completed'; // محقق بالكامل
        } else if (achievedSales >= targetSales || achievedGrams >= targetGrams) {
          overallStatus = 'partial'; // محقق جزئياً
        } else if (salesPercentage >= 70 && gramsPercentage >= 70) {
          overallStatus = 'on_track'; // أداء متقدم
        }
      } else if (targetSales > 0 && achievedSales >= targetSales) {
        overallStatus = 'completed';
      } else if (targetGrams > 0 && achievedGrams >= targetGrams) {
        overallStatus = 'completed';
      }

      return {
        employee: emp,
        period: targetMonth,
        targetSales: targetSales.toFixed(3),
        achievedSales: achievedSales.toFixed(3),
        salesPercentage: Number(salesPercentage.toFixed(1)),
        salesRemaining: salesRemaining.toFixed(3),

        targetGrams: targetGrams.toFixed(3),
        achievedGrams: achievedGrams.toFixed(3),
        gramsPercentage: Number(gramsPercentage.toFixed(1)),
        gramsRemaining: gramsRemaining.toFixed(3),

        invoicesCount: invoices.length,
        registersCount: registers.length,
        overallStatus,
        recentInvoices: invoices.slice(0, 5)
      };
    }));

    // ملخص عام للأداء
    let totalTargetSales = 0;
    let totalAchievedSales = 0;
    let totalTargetGrams = 0;
    let totalAchievedGrams = 0;

    performanceData.forEach(p => {
      totalTargetSales += parseFloat(p.targetSales) || 0;
      totalAchievedSales += parseFloat(p.achievedSales) || 0;
      totalTargetGrams += parseFloat(p.targetGrams) || 0;
      totalAchievedGrams += parseFloat(p.achievedGrams) || 0;
    });

    const totalSalesPercentage = totalTargetSales > 0 ? ((totalAchievedSales / totalTargetSales) * 100).toFixed(1) : 0;
    const totalGramsPercentage = totalTargetGrams > 0 ? ((totalAchievedGrams / totalTargetGrams) * 100).toFixed(1) : 0;

    const sortedBySales = [...performanceData].sort((a, b) => parseFloat(b.achievedSales) - parseFloat(a.achievedSales));
    const sortedByGrams = [...performanceData].sort((a, b) => parseFloat(b.achievedGrams) - parseFloat(a.achievedGrams));

    res.json({
      success: true,
      period: targetMonth,
      summary: {
        totalTargetSales: totalTargetSales.toFixed(3),
        totalAchievedSales: totalAchievedSales.toFixed(3),
        totalSalesPercentage: Number(totalSalesPercentage),
        totalTargetGrams: totalTargetGrams.toFixed(3),
        totalAchievedGrams: totalAchievedGrams.toFixed(3),
        totalGramsPercentage: Number(totalGramsPercentage),
        totalEmployees: employees.length,
        topSalesPerformer: sortedBySales[0] || null,
        topGramsPerformer: sortedByGrams[0] || null,
      },
      data: performanceData
    });
  } catch (error) {
    console.error("Error calculating employee targets performance:", error);
    res.status(500).json({ success: false, message: "فشل في احتساب أداء وتارجت الموظفين", error: error.message });
  }
};

exports.deleteBranchEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await BranchEmployee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }
    await employee.destroy();
    res.json({ success: true, message: "تم حذف الموظف بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في حذف الموظف", error: error.message });
  }
};

// ==========================================
// 3. مصادقة موظف الفرع (Employee Auth)
// ==========================================

exports.employeeLogin = async (req, res) => {
  try {
    const { username, password, branchId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    }

    const employee = await BranchEmployee.findOne({
      where: { username: username.toLowerCase().trim() },
      include: [{ model: Branch, as: 'branch' }]
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    if (!employee.isActive) {
      return res.status(403).json({ success: false, message: "حساب الموظف معطل، يرجى مراجعة الإدارة" });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    // جلب كافة الفروع المسموح للموظف بالدوام والعمل فيها
    const allowedBranches = await getEmployeeAllowedBranches(employee);
    if (!allowedBranches || allowedBranches.length === 0) {
      return res.status(403).json({ success: false, message: "لا توجد فروع نشطة مصرح لك بالعمل بها حالياً، يرجى مراجعة الإدارة" });
    }

    // تحديد الفرع الذي سيداوم فيه الموظف اليوم
    let selectedBranch = null;
    if (branchId) {
      selectedBranch = allowedBranches.find(b => b.id === Number(branchId));
      if (!selectedBranch) {
        return res.status(403).json({
          success: false,
          message: "غير مصرح لك بالدوام في هذا الفرع، يرجى اختيار فرع من فروعك المعتمدة"
        });
      }
    } else {
      // إذا لم يحدد الفرع:
      if (allowedBranches.length === 1) {
        selectedBranch = allowedBranches[0];
      } else {
        // إذا كان الموظف متاحاً له العمل بأكثر من فرع، نطلب منه اختيار الفرع في شاشة الدخول
        const safeEmp = employee.toJSON();
        delete safeEmp.password;
        return res.json({
          success: true,
          requireBranchSelection: true,
          message: "يرجى تحديد الفرع الذي ستداوم به اليوم",
          employee: safeEmp,
          allowedBranches: allowedBranches.map(b => ({
            id: b.id,
            name: b.name,
            code: b.code,
            city: b.city,
            address: b.address
          }))
        });
      }
    }

    const token = jwt.sign(
      {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        branchId: selectedBranch.id,
        homeBranchId: employee.branchId,
        role: 'branch_employee'
      },
      process.env.JWT_SECRET || 'secretKey',
      { expiresIn: '30d' }
    );

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;
    safeEmployee.allowedBranches = allowedBranches;

    // تسجيل الحضور التلقائي للموظف عند تسجيل الدخول في الفرع المختار
    let attendanceToday = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
      const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = arabicDays[now.getDay()];

      let attendance = await EmployeeAttendance.findOne({
        where: { employeeId: employee.id, date: today }
      });

      if (!attendance) {
        attendance = await EmployeeAttendance.create({
          employeeId: employee.id,
          branchId: selectedBranch.id,
          date: today,
          dayName,
          checkInTime: timeStr,
          status: 'حاضر'
        });
      } else {
        const updateData = { branchId: selectedBranch.id };
        if (!attendance.checkInTime) {
          updateData.checkInTime = timeStr;
          updateData.status = 'حاضر';
        }
        await attendance.update(updateData);
      }
      attendanceToday = attendance;
    } catch (attErr) {
      console.error("Error auto-recording attendance on login:", attErr.message);
    }

    res.json({
      success: true,
      message: `مرحباً بك ${employee.name} في ${selectedBranch.name}`,
      token,
      employee: safeEmployee,
      branch: selectedBranch,
      allowedBranches,
      attendance: attendanceToday
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({ success: false, message: "فشل في تسجيل الدخول", error: error.message });
  }
};

// تبديل فرع الدوام للموظف الحالي أثناء الجلسة
exports.switchBranch = async (req, res) => {
  try {
    const { branchId } = req.body;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "يرجى تحديد الفرع المراد التبديل إليه" });
    }

    const employee = await BranchEmployee.findByPk(req.employee.id);
    if (!employee || !employee.isActive) {
      return res.status(403).json({ success: false, message: "حساب الموظف غير نشط" });
    }

    const allowedBranches = await getEmployeeAllowedBranches(employee);
    const targetBranch = allowedBranches.find(b => b.id === Number(branchId));

    if (!targetBranch) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بالدوام في هذا الفرع" });
    }

    const token = jwt.sign(
      {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        branchId: targetBranch.id,
        homeBranchId: employee.branchId,
        role: 'branch_employee'
      },
      process.env.JWT_SECRET || 'secretKey',
      { expiresIn: '30d' }
    );

    // تحديث فرع الحضور لليوم إذا وجد
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendance = await EmployeeAttendance.findOne({
        where: { employeeId: employee.id, date: today }
      });
      if (attendance) {
        await attendance.update({ branchId: targetBranch.id });
      }
    } catch (e) {}

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;
    safeEmployee.allowedBranches = allowedBranches;

    res.json({
      success: true,
      message: `تم التبديل بنجاح إلى ${targetBranch.name}`,
      token,
      branch: targetBranch,
      employee: safeEmployee
    });
  } catch (error) {
    console.error("Error in switchBranch:", error);
    res.status(500).json({ success: false, message: "فشل في تبديل الفرع", error: error.message });
  }
};

exports.getEmployeeMe = async (req, res) => {
  try {
    const employee = await BranchEmployee.findByPk(req.employee.id, {
      include: [{ model: Branch, as: 'branch' }],
      attributes: { exclude: ['password'] }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    // احتساب إنجاز تارجت الشهر الحالي للموظف بدقة شاملاً الفواتير وحركات الدفتر اليومي
    const currentMonth = new Date().toISOString().slice(0, 7);
    const targetProgress = await calculateEmployeeTargetProgress(employee.id, currentMonth);

    // الفرع النشط حالياً لجلسة الموظف
    const activeBranch = req.branch || employee.branch;
    const activeBranchId = activeBranch ? activeBranch.id : employee.branchId;

    // الفروع المصرح للموظف العمل بها
    const allowedBranches = await getEmployeeAllowedBranches(employee);

    // موظفو الفرع النشط لتمكين الاختيار بينهم في السجل اليومي (شاملاً من صُرّح له بالعمل هنا)
    const allActiveEmployees = await BranchEmployee.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'username', 'phone', 'branchId', 'allowedBranchIds'],
      order: [['name', 'ASC']]
    });

    const branchEmployees = allActiveEmployees.filter(emp => {
      if (emp.branchId === activeBranchId) return true;
      if (!emp.allowedBranchIds) return false;
      if (emp.allowedBranchIds === 'all') return true;
      try {
        const ids = JSON.parse(emp.allowedBranchIds);
        if (Array.isArray(ids) && (ids.includes(activeBranchId) || ids.includes(String(activeBranchId)) || ids.includes('*'))) {
          return true;
        }
      } catch (e) {
        if (String(emp.allowedBranchIds).includes(String(activeBranchId))) return true;
      }
      return false;
    }).map(emp => ({
      id: emp.id,
      name: emp.name,
      username: emp.username,
      phone: emp.phone
    }));

    res.json({
      success: true,
      employee,
      branch: activeBranch,
      allowedBranches,
      targetProgress,
      branchEmployees
    });
  } catch (error) {
    console.error("Error in getEmployeeMe:", error);
    res.status(500).json({ success: false, message: "فشل في جلب بيانات الموظف", error: error.message });
  }
};

// جلب موظفي الفرع النشطين لتمكين الاختيار بينهم في السجل اليومي
exports.getBranchEmployeesForEmployee = async (req, res) => {
  try {
    const branchId = req.employee.branchId;
    const allActiveEmployees = await BranchEmployee.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'username', 'phone', 'branchId', 'allowedBranchIds'],
      order: [['name', 'ASC']]
    });

    const branchEmployees = allActiveEmployees.filter(emp => {
      if (emp.branchId === branchId) return true;
      if (!emp.allowedBranchIds) return false;
      if (emp.allowedBranchIds === 'all') return true;
      try {
        const ids = JSON.parse(emp.allowedBranchIds);
        if (Array.isArray(ids) && (ids.includes(branchId) || ids.includes(String(branchId)) || ids.includes('*'))) {
          return true;
        }
      } catch (e) {
        if (String(emp.allowedBranchIds).includes(String(branchId))) return true;
      }
      return false;
    }).map(emp => ({
      id: emp.id,
      name: emp.name,
      username: emp.username,
      phone: emp.phone
    }));

    res.json({ success: true, data: branchEmployees, branchEmployees });
  } catch (error) {
    console.error("Error in getBranchEmployeesForEmployee:", error);
    res.status(500).json({ success: false, message: "فشل في جلب موظفي الفرع", error: error.message });
  }
};

// ==========================================
// 4. الفواتير الرسمية (Invoices)
// ==========================================

exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const branchId = req.employee.branchId;
    const lastInvoice = await BranchInvoice.findOne({
      where: { branchId },
      order: [['id', 'DESC']]
    });

    let nextNumber = '0001';
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parsed = parseInt(lastInvoice.invoiceNumber, 10);
      if (!isNaN(parsed)) {
        nextNumber = String(parsed + 1).padStart(4, '0');
      }
    }

    res.json({ success: true, nextNumber, invoiceNumber: nextNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في توليد رقم الفاتورة", error: error.message });
  }
};

// استخراج معرفات وأرقام الفواتير المستبعدة من السجل اليومي
function getExcludedInvoiceIds(notes) {
  if (!notes) return [];
  const match = notes.match(/\[EXCLUDED_INVOICES:([^\]]*)\]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

// إضافة فاتورة إلى قائمة الفواتير المستبعدة من السجل اليومي
function addExcludedInvoiceId(notes, invoiceId, invoiceNumber) {
  let currentNotes = notes || '';
  const match = currentNotes.match(/\[EXCLUDED_INVOICES:([^\]]*)\]/);
  let ids = [];
  if (match) {
    ids = match[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  if (invoiceId) {
    const idStr = String(invoiceId);
    if (!ids.includes(idStr)) ids.push(idStr);
  }
  if (invoiceNumber) {
    const numStr = String(invoiceNumber);
    if (!ids.includes(`num_${numStr}`)) ids.push(`num_${numStr}`);
  }

  const tag = `[EXCLUDED_INVOICES:${ids.join(',')}]`;
  if (match) {
    return currentNotes.replace(/\[EXCLUDED_INVOICES:[^\]]*\]/, tag);
  } else {
    return currentNotes ? `${currentNotes} ${tag}` : tag;
  }
}

// مزامنة فواتير اليوم في السجل اليومي
async function syncInvoicesToDailyRegister(branchId, targetDate, employeeId, employeeName) {
  try {
    const invoices = await BranchInvoice.findAll({
      where: { branchId, date: targetDate },
      order: [['id', 'ASC']]
    });

    let register = await BranchDailyRegister.findOne({
      where: { branchId, date: targetDate }
    });

    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const currentDayName = arabicDays[new Date(targetDate).getDay()];

    let existingEntries = [];
    if (register && register.entries) {
      existingEntries = Array.isArray(register.entries) ? register.entries : JSON.parse(register.entries || '[]');
    }

    const excludedIds = getExcludedInvoiceIds(register ? register.notes : '');

    let updatedEntries = [...existingEntries];
    let hasNew = false;

    for (const inv of invoices) {
      const invNum = inv.invoiceNumber;
      if (excludedIds.includes(String(inv.id)) || excludedIds.includes(`num_${invNum}`)) {
        // تم استبعاد هذه الفاتورة عمداً من السجل اليومي بواسطة الإدارة
        continue;
      }

      const existingIdx = updatedEntries.findIndex(e =>
        (e.invoiceId && String(e.invoiceId) === String(inv.id)) ||
        (e.invoiceNumber && String(e.invoiceNumber) === String(invNum)) ||
        (e.weightAndDetails && e.weightAndDetails.includes(`فاتورة #${invNum}`))
      );

      if (existingIdx !== -1) {
        // إذا كان السطر موجوداً لكن ينقصه اسم الموظف نحدثه ببيانات الموظف مسجل الفاتورة
        if (!updatedEntries[existingIdx].employeeName && (inv.employeeName || employeeName)) {
          updatedEntries[existingIdx].employeeId = inv.employeeId || employeeId || null;
          updatedEntries[existingIdx].employeeName = inv.employeeName || employeeName || '';
          hasNew = true;
        }
      }

      const alreadyExists = existingIdx !== -1;

      if (!alreadyExists) {
        let itemsDesc = '';
        let invoiceGrams = 0;
        if (Array.isArray(inv.items)) {
          itemsDesc = inv.items.map(it => it.type).filter(Boolean).join('، ');
          inv.items.forEach(it => {
            const count = parseFloat(it.count) > 0 ? parseFloat(it.count) : 1;
            const weight = parseFloat(it.makerFeeGram) || 0;
            invoiceGrams += (count * weight);
          });
        }

        const gramsStr = invoiceGrams > 0 ? invoiceGrams.toFixed(3) : '';
        const detailsStr = `فاتورة #${invNum}${itemsDesc ? ' (' + itemsDesc + ')' : ''}`;

        updatedEntries.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          invoiceId: inv.id,
          invoiceNumber: invNum,
          employeeId: inv.employeeId || employeeId || null,
          employeeName: inv.employeeName || employeeName || '',
          clientPhone: inv.customerPhone || '',
          clientName: inv.customerName || 'عميل نقدي',
          weight: gramsStr,
          details: detailsStr,
          weightAndDetails: `${gramsStr ? gramsStr + ' غرام - ' : ''}${detailsStr}`,
          expenses: '0.000',
          expenseDetails: '',
          sales: String(inv.total || '0.000'),
          isVisa: inv.paymentType !== 'نقدي'
        });
        hasNew = true;
      }
    }

    if (!register) {
      let salesSum = 0;
      let visaSum = 0;
      let gramsSum = 0;
      updatedEntries.forEach(item => {
        const s = parseFloat(item.sales) || 0;
        const g = parseFloat(item.weight) || 0;
        salesSum += s;
        gramsSum += g;
        if (item.isVisa) visaSum += s;
      });

      register = await BranchDailyRegister.create({
        branchId,
        employeeId: employeeId || null,
        employeeName: employeeName || '',
        date: targetDate,
        dayName: currentDayName,
        entries: updatedEntries,
        totalGrams: gramsSum.toFixed(3),
        totalSales: salesSum.toFixed(3),
        totalExpenses: 0,
        totalVisaSales: visaSum.toFixed(3),
        netTotal: salesSum.toFixed(3),
        totalAdvances: 0,
        brokenSilverGrams: 0,
        brokenGoldGrams: 0,
        status: 'معتمد',
        notes: 'تم توليد السطور تلقائياً من فواتير اليوم'
      });
    } else if (hasNew) {
      let salesSum = 0;
      let expSum = 0;
      let visaSum = 0;
      let gramsSum = 0;
      updatedEntries.forEach(item => {
        const s = parseFloat(item.sales) || 0;
        const e = parseFloat(item.expenses) || 0;
        const g = parseFloat(item.weight) || 0;
        salesSum += s;
        expSum += e;
        gramsSum += g;
        if (item.isVisa) visaSum += s;
      });

      await register.update({
        entries: updatedEntries,
        totalGrams: gramsSum > 0 ? gramsSum.toFixed(3) : register.totalGrams,
        totalSales: salesSum.toFixed(3),
        totalExpenses: expSum.toFixed(3),
        totalVisaSales: visaSum.toFixed(3),
        netTotal: (salesSum - expSum).toFixed(3)
      });
    }

    return register;
  } catch (err) {
    console.error("Error syncing invoices to daily register:", err);
  }
}

exports.createInvoice = async (req, res) => {
  try {
    const branchId = req.employee.branchId;
    const employeeId = req.employee.id;
    const employeeName = req.employee.name;

    const {
      invoiceNumber,
      date,
      paymentType,
      customerName,
      customerPhone,
      items,
      subtotal,
      discount,
      total,
      recipientName,
      notes
    } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "رقم الفاتورة مطلوب" });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    const invoice = await BranchInvoice.create({
      branchId,
      employeeId,
      employeeName,
      invoiceNumber,
      date: targetDate,
      paymentType: paymentType || 'نقدي',
      customerName,
      customerPhone,
      items: items || [],
      subtotal: parseFloat(subtotal) || 0,
      discount: parseFloat(discount) || 0,
      total: parseFloat(total) || 0,
      recipientName: recipientName || employeeName,
      notes
    });

    // مزامنة الفاتورة في السجل اليومي تلقائياً
    await syncInvoicesToDailyRegister(branchId, targetDate, employeeId, employeeName);

    // إرسال تنبيه فوري بالبريد الإلكتروني للإدارة بالفاتورة الجديدة
    (async () => {
      try {
        const branch = await Branch.findByPk(branchId);
        const branchTitle = branch ? branch.name : `فرع #${branchId}`;
        const totalFormatted = (parseFloat(total) || 0).toFixed(3);
        const subtotalFormatted = (parseFloat(subtotal) || 0).toFixed(3);
        const discountFormatted = (parseFloat(discount) || 0).toFixed(3);

        let itemsRowsHtml = '';
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((item, index) => {
            if (!item.type && !item.priceDinar && !item.gramPrice) return;
            const price = `${item.priceDinar || 0}.${String(item.priceFils || 0).padStart(3, '0')}`;
            itemsRowsHtml += `
              <tr style="border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 12px;">
                <td style="padding: 8px;">${index + 1}</td>
                <td style="padding: 8px; font-weight: bold;">${item.type || '—'}</td>
                <td style="padding: 8px; text-align: center;">${item.karat || '925'}</td>
                <td style="padding: 8px; text-align: center;">${item.count || '—'}</td>
                <td style="padding: 8px; text-align: center;">${item.totalFee || '—'}</td>
                <td style="padding: 8px; font-weight: bold; text-align: left; color: #0f172a;">${price} د.أ</td>
              </tr>
            `;
          });
        }

        const emailSubject = `🧾 فاتورة جديدة #${invoiceNumber} - ${branchTitle} (${totalFormatted} د.أ)`;
        const emailContent = `
          <div style="text-align: right;">
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 18px 22px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 6px 0; font-size: 19px; color: #38bdf8;">🧾 فاتورة مبيعات فرع جديدة</h2>
              <p style="margin: 0; font-size: 13px; color: #cbd5e1;">تم إصدار فاتورة مبيعات جديدة في <strong>${branchTitle}</strong></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b;">رقم الفاتورة:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-family: monospace; font-size: 14px;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">الفرع:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${branchTitle}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">محرر الفاتورة (الموظف):</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${employeeName || 'موظف الفرع'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">تاريخ الفاتورة:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${targetDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">طريقة الدفع:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${paymentType === 'فيزا' ? '#2563eb' : '#059669'};">${paymentType || 'نقدي'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">اسم العميل:</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${customerName || 'عميل نقدي'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; color: #64748b;">هاتف العميل:</td>
                <td style="padding: 10px 14px; font-family: monospace;">${customerPhone || '—'}</td>
              </tr>
            </table>

            ${itemsRowsHtml ? `
              <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #334155;">📦 بيان الأصناف المباعة:</h4>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background-color: #f1f5f9; color: #475569; font-weight: bold; text-align: right;">
                    <th style="padding: 8px;">#</th>
                    <th style="padding: 8px;">البيان</th>
                    <th style="padding: 8px; text-align: center;">العيار</th>
                    <th style="padding: 8px; text-align: center;">الوزن</th>
                    <th style="padding: 8px; text-align: center;">الأجرة</th>
                    <th style="padding: 8px; text-align: left;">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHtml}
                </tbody>
              </table>
            ` : ''}

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 18px; border-radius: 10px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                <span style="color: #64748b;">المجموع الفرعي:</span>
                <span style="font-family: monospace; font-weight: bold;">${subtotalFormatted} د.أ</span>
              </div>
              ${parseFloat(discount) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: #dc2626;">
                  <span>الخصم:</span>
                  <span style="font-family: monospace; font-weight: bold;">-${discountFormatted} د.أ</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #166534; padding-top: 8px; border-top: 1px dashed #86efac;">
                <span>المبلغ الإجمالي النهائي:</span>
                <span style="font-family: monospace;">${totalFormatted} د.أ</span>
              </div>
            </div>

            ${notes ? `<p style="font-size: 12px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 8px;"><strong>ملاحظات:</strong> ${notes}</p>` : ''}
          </div>
        `;

        await sendEmailNotificationToAdmin(emailSubject, emailContent);
      } catch (mailErr) {
        console.error("Error sending new invoice email notification to admin:", mailErr.message);
      }
    })();

    // احتساب أثر الفاتورة الفوري على تارجت الموظف
    const invoiceMonth = targetDate.slice(0, 7);
    const updatedTargetProgress = await calculateEmployeeTargetProgress(employeeId, invoiceMonth);

    res.status(201).json({
      success: true,
      message: `تم حفظ الفاتورة وإضافتها لتارجت المبيعات والجرامات الخاص بك بنجاح (+ ${(parseFloat(total) || 0).toFixed(3)} د.أ)`,
      data: invoice,
      targetProgress: updatedTargetProgress
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ success: false, message: "فشل في حفظ الفاتورة", error: error.message });
  }
};

exports.getBranchInvoices = async (req, res) => {
  try {
    const branchId = req.employee ? req.employee.branchId : req.query.branchId;
    const { date, fromDate, toDate, search, paymentType } = req.query;

    const where = {};
    if (branchId) where.branchId = branchId;
    if (date) where.date = date;
    if (fromDate && toDate) where.date = { [Op.between]: [fromDate, toDate] };
    if (paymentType) where.paymentType = paymentType;
    if (search) {
      where[Op.or] = [
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { customerPhone: { [Op.like]: `%${search}%` } }
      ];
    }

    const invoices = await BranchInvoice.findAll({
      where,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name'] }
      ],
      order: [['id', 'DESC']]
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب الفواتير", error: error.message });
  }
};

// حذف فاتورة بواسطة الأدمن وتحديث السجل اليومي تلقائياً
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await BranchInvoice.findByPk(id, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "الفاتورة غير موجودة" });
    }

    const { branchId, date, invoiceNumber } = invoice;
    const branchName = invoice.branch?.name || `فرع #${branchId}`;

    // حذف الفاتورة من جدول الفواتير
    await invoice.destroy();

    // البحث عن السجل اليومي لنفس الفرع ونفس التاريخ لإزالة الفاتورة منه إن وجدت
    const register = await BranchDailyRegister.findOne({
      where: { branchId, date }
    });

    if (register) {
      let entries = [];
      if (typeof register.entries === 'string') {
        try { entries = JSON.parse(register.entries); } catch (e) { entries = []; }
      } else if (Array.isArray(register.entries)) {
        entries = [...register.entries];
      }

      const initialCount = entries.length;
      entries = entries.filter(e => {
        const matchesId = e.invoiceId && (String(e.invoiceId) === String(id));
        const matchesNumber = e.invoiceNumber && (String(e.invoiceNumber) === String(invoiceNumber));
        const matchesText = e.weightAndDetails && e.weightAndDetails.includes(`فاتورة #${invoiceNumber}`);
        return !(matchesId || matchesNumber || matchesText);
      });

      if (entries.length !== initialCount) {
        let salesSum = 0;
        let expSum = 0;
        let visaSum = 0;
        entries.forEach(item => {
          const s = parseFloat(item.sales) || 0;
          const e = parseFloat(item.expenses) || 0;
          salesSum += s;
          expSum += e;
          if (item.isVisa) visaSum += s;
        });

        // تسجيل الفاتورة في قائمة المستبعدين لمنع إعادة مزامنتها
        const updatedNotes = addExcludedInvoiceId(register.notes, id, invoiceNumber);

        await register.update({
          entries,
          totalSales: salesSum.toFixed(3),
          totalExpenses: expSum.toFixed(3),
          totalVisaSales: visaSum.toFixed(3),
          netTotal: (salesSum - expSum).toFixed(3),
          notes: updatedNotes
        });
      }
    }

    res.json({
      success: true,
      message: `تم حذف الفاتورة #${invoiceNumber} لـ (${branchName}) بنجاح وتحديث السجل اليومي`
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ success: false, message: "فشل في حذف الفاتورة", error: error.message });
  }
};

// ==========================================
// 5. السجل اليومي (Daily Register)
// ==========================================

exports.getTodayDailyRegister = async (req, res) => {
  try {
    const branchId = req.employee.branchId;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // مزامنة أي فواتير مصدرة
    await syncInvoicesToDailyRegister(branchId, date, req.employee?.id, req.employee?.name);

    let register = await BranchDailyRegister.findOne({
      where: { branchId, date },
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name'] }
      ]
    });

    const branchEmployees = await BranchEmployee.findAll({
      where: { branchId, isActive: true },
      attributes: ['id', 'name', 'username', 'phone'],
      order: [['name', 'ASC']]
    });

    if (register) {
      let formatted = register.toJSON();
      if (typeof formatted.entries === 'string') {
        try { formatted.entries = JSON.parse(formatted.entries); } catch (e) { formatted.entries = []; }
      }
      return res.json({ success: true, data: formatted, branchEmployees });
    }

    res.json({ success: true, data: null, branchEmployees, message: "لا يوجد سجل مسجل لهذا اليوم بعد" });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب السجل اليومي", error: error.message });
  }
};

// ==========================================
// دالة إرسال تقرير إغلاق السجل اليومي للإدارة بالبريد
// ==========================================
async function sendDailyRegisterClosureEmail(register, customBranchName, isAuto = false) {
  try {
    let branchName = customBranchName;
    if (!branchName && register.branchId) {
      const b = await Branch.findByPk(register.branchId);
      branchName = b ? b.name : `فرع #${register.branchId}`;
    }

    const targetDate = register.date || new Date().toISOString().split('T')[0];
    const dayName = register.dayName || '';
    const employeeName = register.employeeName || 'موظف الفرع';
    const totalSales = (parseFloat(register.totalSales) || 0).toFixed(3);
    const totalVisaSales = (parseFloat(register.totalVisaSales) || 0).toFixed(3);
    const totalCashSales = Math.max(0, (parseFloat(register.totalSales) || 0) - (parseFloat(register.totalVisaSales) || 0)).toFixed(3);
    const totalExpenses = (parseFloat(register.totalExpenses) || 0).toFixed(3);
    const netTotal = (parseFloat(register.netTotal) || 0).toFixed(3);
    const totalAdvances = (parseFloat(register.totalAdvances) || 0).toFixed(3);
    const brokenSilver = (parseFloat(register.brokenSilverGrams) || 0).toFixed(3);
    const brokenGold = (parseFloat(register.brokenGoldGrams) || 0).toFixed(3);

    let entries = register.entries || [];
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries); } catch (e) { entries = []; }
    }

    // استخراج سطور المصاريف المفصلة
    const expenseEntries = entries.filter(e => parseFloat(e.expenses) > 0);
    let expensesListHtml = '';
    if (expenseEntries.length > 0) {
      expensesListHtml = `
        <h4 style="margin: 15px 0 8px 0; font-size: 13px; color: #b91c1c;">💸 تفاصيل المصاريف المسجلة اليوم:</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; border: 1px solid #fee2e2;">
          <thead>
            <tr style="background-color: #fef2f2; color: #991b1b; text-align: right;">
              <th style="padding: 6px 10px;">البيان / العميل</th>
              <th style="padding: 6px 10px;">تفاصيل المصروف</th>
              <th style="padding: 6px 10px; text-align: left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${expenseEntries.map(exp => `
              <tr style="border-bottom: 1px solid #fee2e2;">
                <td style="padding: 6px 10px;">${exp.clientName || exp.weightAndDetails || '—'}</td>
                <td style="padding: 6px 10px; color: #64748b;">${exp.expenseDetails || 'مصروف عام'}</td>
                <td style="padding: 6px 10px; font-weight: bold; color: #dc2626; text-align: left;">${parseFloat(exp.expenses).toFixed(3)} د.أ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const emailSubject = `📊 إغلاق السجل اليومي - ${branchName} (${targetDate}) | صافي: ${netTotal} د.أ`;
    const emailContent = `
      <div style="text-align: right;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); color: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 6px 0; font-size: 19px; color: #60a5fa;">🏢 تقرير إغلاق وانتهاء السجل اليومي</h2>
          <p style="margin: 0; font-size: 13px; color: #cbd5e1;">
            ${isAuto ? 'تم إغلاق السجل اليومي تلقائياً عند انتهاء موعد الدوام الرسمي' : 'قام موظف الفرع باعتماد وإغلاق السجل اليومي لليوم بنجاح وإرسال التقرير للإدارة'}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background-color: #f8fafc; border-radius: 8px;">
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b;">الفرع:</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${branchName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">الموظف المسؤول:</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">تاريخ السجل:</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-family: monospace;">${targetDate} (${dayName || '—'})</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">وقت الإغلاق:</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #64748b;">إجمالي الحركات باليوم:</td>
            <td style="padding: 10px 14px; font-weight: bold;">${entries.length} حركة / سطر</td>
          </tr>
        </table>

        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a;">💰 الملخص المالي للوردية:</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px;">
            <div style="font-size: 11px; color: #166534;">إجمالي المبيعات</div>
            <div style="font-size: 16px; font-weight: bold; color: #15803d; font-family: monospace;">${totalSales} د.أ</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">(نقدي: ${totalCashSales} | فيزا: ${totalVisaSales})</div>
          </div>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px;">
            <div style="font-size: 11px; color: #991b1b;">إجمالي المصاريف</div>
            <div style="font-size: 16px; font-weight: bold; color: #b91c1c; font-family: monospace;">${totalExpenses} د.أ</div>
          </div>
        </div>

        <div style="background-color: #eff6ff; border: 2px solid #93c5fd; padding: 15px 18px; border-radius: 10px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">صافي الصندوق / الكاش (المبيعات - المصاريف):</span>
            <span style="font-size: 20px; font-weight: 900; color: #1d4ed8; font-family: monospace;">${netTotal} د.أ</span>
          </div>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: #64748b;">سلف الموظفين المصروفة اليوم:</span>
            <span style="font-weight: bold; font-family: monospace;">${totalAdvances} د.أ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: #64748b;">كسر الفضة المستلم:</span>
            <span style="font-weight: bold; font-family: monospace;">${brokenSilver} غرام</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">كسر الذهب المستلم:</span>
            <span style="font-weight: bold; font-family: monospace;">${brokenGold} غرام</span>
          </div>
        </div>

        ${expensesListHtml}

        ${register.notes ? `<p style="font-size: 12px; color: #475569; background: #f1f5f9; padding: 10px; border-radius: 8px;"><strong>ملاحظات الموظف:</strong> ${register.notes.replace('[EMAIL_CLOSED_SENT]', '').trim()}</p>` : ''}
      </div>
    `;

    await sendEmailNotificationToAdmin(emailSubject, emailContent);
    return true;
  } catch (err) {
    console.error("Error sending daily register closure email:", err.message);
    return false;
  }
}

exports.sendDailyRegisterClosureEmail = sendDailyRegisterClosureEmail;

exports.saveDailyRegister = async (req, res) => {
  try {
    const branchId = req.employee ? req.employee.branchId : req.body.branchId;
    const employeeId = req.employee ? req.employee.id : req.body.employeeId;
    const employeeName = req.employee ? req.employee.name : req.body.employeeName;

    const {
      date,
      dayName,
      entries,
      totalGrams,
      totalSales,
      totalExpenses,
      totalVisaSales,
      netTotal,
      totalAdvances,
      brokenSilverGrams,
      brokenGoldGrams,
      status,
      notes,
      isClosed
    } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];
    const shouldClose = isClosed === true || status === 'مغلق';
    const finalStatus = shouldClose ? 'مغلق' : (status || 'معتمد');

    let calcGrams = 0;
    let finalEntries = entries;
    if (Array.isArray(entries)) {
      finalEntries = entries.map(item => {
        const itemG = parseFloat(item.weight) || 0;
        calcGrams += itemG;
        const assignedEmpId = (item.employeeId !== undefined && item.employeeId !== null && item.employeeId !== '')
          ? item.employeeId
          : (employeeId || null);
        const assignedEmpName = item.employeeName || employeeName || '';

        // إذا كان السطر مرتبطاً بفاتورة وتم تعيين موظف، نحدث الفاتورة في جدول الفواتير تلقائياً
        if (item.invoiceId && assignedEmpId) {
          BranchInvoice.update(
            { employeeId: assignedEmpId, employeeName: assignedEmpName, recipientName: assignedEmpName },
            { where: { id: item.invoiceId, branchId } }
          ).catch(err => console.error("Error updating invoice employee from register:", err));
        } else if (item.invoiceNumber && assignedEmpId) {
          BranchInvoice.update(
            { employeeId: assignedEmpId, employeeName: assignedEmpName, recipientName: assignedEmpName },
            { where: { invoiceNumber: item.invoiceNumber, branchId } }
          ).catch(err => console.error("Error updating invoice employee from register:", err));
        }

        return {
          ...item,
          employeeId: assignedEmpId,
          employeeName: assignedEmpName
        };
      });
    }
    const finalCalculatedGrams = (totalGrams !== undefined && totalGrams !== '' && parseFloat(totalGrams) > 0)
      ? totalGrams
      : calcGrams.toFixed(3);

    let register = await BranchDailyRegister.findOne({
      where: { branchId, date: targetDate }
    });

    let currentNotes = notes !== undefined ? notes : (register ? register.notes : '');
    const alreadySentEmail = currentNotes && currentNotes.includes('[EMAIL_CLOSED_SENT]');

    if (shouldClose && !alreadySentEmail) {
      currentNotes = `${currentNotes || ''} [EMAIL_CLOSED_SENT]`.trim();
    }

    if (register) {
      await register.update({
        dayName: dayName || register.dayName,
        entries: finalEntries !== undefined ? finalEntries : register.entries,
        totalGrams: finalCalculatedGrams !== undefined ? finalCalculatedGrams : register.totalGrams,
        totalSales: totalSales !== undefined ? totalSales : register.totalSales,
        totalExpenses: totalExpenses !== undefined ? totalExpenses : register.totalExpenses,
        totalVisaSales: totalVisaSales !== undefined ? totalVisaSales : register.totalVisaSales,
        netTotal: netTotal !== undefined ? netTotal : register.netTotal,
        totalAdvances: totalAdvances !== undefined ? totalAdvances : register.totalAdvances,
        brokenSilverGrams: brokenSilverGrams !== undefined ? brokenSilverGrams : register.brokenSilverGrams,
        brokenGoldGrams: brokenGoldGrams !== undefined ? brokenGoldGrams : register.brokenGoldGrams,
        status: finalStatus,
        notes: currentNotes,
        employeeId: employeeId || register.employeeId,
        employeeName: employeeName || register.employeeName
      });
    } else {
      register = await BranchDailyRegister.create({
        branchId,
        employeeId,
        employeeName,
        date: targetDate,
        dayName,
        entries: finalEntries || [],
        totalGrams: finalCalculatedGrams || 0,
        totalSales: totalSales || 0,
        totalExpenses: totalExpenses || 0,
        totalVisaSales: totalVisaSales || 0,
        netTotal: netTotal || 0,
        totalAdvances: totalAdvances || 0,
        brokenSilverGrams: brokenSilverGrams || 0,
        brokenGoldGrams: brokenGoldGrams || 0,
        status: finalStatus,
        notes: currentNotes
      });
    }

    // إذا تم إغلاق السجل ولم يسبق إرسال إيميل الإغلاق لليوم
    if (shouldClose && !alreadySentEmail) {
      sendDailyRegisterClosureEmail(register, null, false);
    }

    let formattedRegister = register.toJSON ? register.toJSON() : { ...register };
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    }

    res.json({
      success: true,
      message: shouldClose ? "تم إغلاق السجل اليومي بنجاح وإرسال التقرير للإدارة" : "تم حفظ واعتماد السجل اليومي بنجاح",
      data: formattedRegister
    });
  } catch (error) {
    console.error("Error saving daily register:", error);
    res.status(500).json({ success: false, message: "فشل في حفظ السجل اليومي", error: error.message });
  }
};

// مسار صريح لإغلاق السجل اليومي للفرع
exports.closeDailyRegister = async (req, res) => {
  try {
    const branchId = req.employee ? req.employee.branchId : req.body.branchId;
    const employeeId = req.employee ? req.employee.id : req.body.employeeId;
    const employeeName = req.employee ? req.employee.name : req.body.employeeName;

    const {
      date,
      dayName,
      entries,
      totalGrams,
      totalSales,
      totalExpenses,
      totalVisaSales,
      netTotal,
      totalAdvances,
      brokenSilverGrams,
      brokenGoldGrams,
      notes
    } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    let calcGrams = 0;
    let finalEntries = entries;
    if (Array.isArray(entries)) {
      finalEntries = entries.map(item => {
        const itemG = parseFloat(item.weight) || 0;
        calcGrams += itemG;
        const assignedEmpId = (item.employeeId !== undefined && item.employeeId !== null && item.employeeId !== '')
          ? item.employeeId
          : (employeeId || null);
        const assignedEmpName = item.employeeName || employeeName || '';

        if (item.invoiceId && assignedEmpId) {
          BranchInvoice.update(
            { employeeId: assignedEmpId, employeeName: assignedEmpName, recipientName: assignedEmpName },
            { where: { id: item.invoiceId, branchId } }
          ).catch(err => console.error("Error updating invoice employee from close register:", err));
        } else if (item.invoiceNumber && assignedEmpId) {
          BranchInvoice.update(
            { employeeId: assignedEmpId, employeeName: assignedEmpName, recipientName: assignedEmpName },
            { where: { invoiceNumber: item.invoiceNumber, branchId } }
          ).catch(err => console.error("Error updating invoice employee from close register:", err));
        }

        return {
          ...item,
          employeeId: assignedEmpId,
          employeeName: assignedEmpName
        };
      });
    }

    const gramsVal = (totalGrams !== undefined && totalGrams !== '' && parseFloat(totalGrams) > 0)
      ? totalGrams
      : calcGrams.toFixed(3);

    let register = await BranchDailyRegister.findOne({
      where: { branchId, date: targetDate }
    });

    let currentNotes = notes !== undefined ? notes : (register ? register.notes : '');
    if (!currentNotes || !currentNotes.includes('[EMAIL_CLOSED_SENT]')) {
      currentNotes = `${currentNotes || ''} [EMAIL_CLOSED_SENT]`.trim();
    }

    if (register) {
      await register.update({
        dayName: dayName || register.dayName,
        entries: finalEntries !== undefined ? finalEntries : register.entries,
        totalGrams: gramsVal !== undefined ? gramsVal : register.totalGrams,
        totalSales: totalSales !== undefined ? totalSales : register.totalSales,
        totalExpenses: totalExpenses !== undefined ? totalExpenses : register.totalExpenses,
        totalVisaSales: totalVisaSales !== undefined ? totalVisaSales : register.totalVisaSales,
        netTotal: netTotal !== undefined ? netTotal : register.netTotal,
        totalAdvances: totalAdvances !== undefined ? totalAdvances : register.totalAdvances,
        brokenSilverGrams: brokenSilverGrams !== undefined ? brokenSilverGrams : register.brokenSilverGrams,
        brokenGoldGrams: brokenGoldGrams !== undefined ? brokenGoldGrams : register.brokenGoldGrams,
        status: 'مغلق',
        notes: currentNotes,
        employeeId: employeeId || register.employeeId,
        employeeName: employeeName || register.employeeName
      });
    } else {
      register = await BranchDailyRegister.create({
        branchId,
        employeeId,
        employeeName,
        date: targetDate,
        dayName,
        entries: finalEntries || [],
        totalGrams: totalGrams || 0,
        totalSales: totalSales || 0,
        totalExpenses: totalExpenses || 0,
        totalVisaSales: totalVisaSales || 0,
        netTotal: netTotal || 0,
        totalAdvances: totalAdvances || 0,
        brokenSilverGrams: brokenSilverGrams || 0,
        brokenGoldGrams: brokenGoldGrams || 0,
        status: 'مغلق',
        notes: currentNotes
      });
    }

    // إرسال الإيميل الفوري للإدارة
    await sendDailyRegisterClosureEmail(register, null, false);

    let formattedRegister = register.toJSON ? register.toJSON() : { ...register };
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    }

    res.json({
      success: true,
      message: "تم اعتماد وإغلاق السجل اليومي بنجاح وإرسال التقرير النهائي للإدارة",
      data: formattedRegister
    });
  } catch (error) {
    console.error("Error closing daily register:", error);
    res.status(500).json({ success: false, message: "فشل في إغلاق السجل اليومي", error: error.message });
  }
};

exports.getAllDailyRegistersForAdmin = async (req, res) => {
  try {
    const { branchId, date, month, fromDate, toDate } = req.query;
    const where = {};

    if (branchId) where.branchId = branchId;
    if (date) where.date = date;
    if (month) where.date = { [Op.like]: `${month}%` };
    if (fromDate && toDate) where.date = { [Op.between]: [fromDate, toDate] };

    const registers = await BranchDailyRegister.findAll({
      where,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    const parsed = registers.map(r => {
      const j = r.toJSON();
      if (typeof j.entries === 'string') {
        try { j.entries = JSON.parse(j.entries); } catch (e) { j.entries = []; }
      }
      return j;
    });

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب السجلات اليومية", error: error.message });
  }
};

// حذف سجل يومي بالكامل بواسطة الأدمن
exports.deleteDailyRegister = async (req, res) => {
  try {
    const { id } = req.params;
    const register = await BranchDailyRegister.findByPk(id, {
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }]
    });

    if (!register) {
      return res.status(404).json({ success: false, message: "السجل اليومي غير موجود" });
    }

    const branchName = register.branch?.name || `فرع #${register.branchId}`;
    const date = register.date;

    await register.destroy();

    res.json({
      success: true,
      message: `تم حذف السجل اليومي لـ (${branchName}) بتاريخ ${date} بنجاح`
    });
  } catch (error) {
    console.error("Error deleting daily register:", error);
    res.status(500).json({ success: false, message: "فشل في حذف السجل اليومي", error: error.message });
  }
};

// إزالة فاتورة محددة من السجل اليومي مع إعادة حساب المجاميع واستبعادها من المزامنة التلقائية
exports.removeInvoiceFromDailyRegister = async (req, res) => {
  try {
    const { id } = req.params; // registerId
    const { invoiceId, invoiceNumber, entryId } = req.body;

    const register = await BranchDailyRegister.findByPk(id, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username'] }
      ]
    });

    if (!register) {
      return res.status(404).json({ success: false, message: "السجل اليومي غير موجود" });
    }

    let entries = [];
    if (typeof register.entries === 'string') {
      try { entries = JSON.parse(register.entries); } catch (e) { entries = []; }
    } else if (Array.isArray(register.entries)) {
      entries = [...register.entries];
    }

    let foundInvoiceId = invoiceId;
    let foundInvoiceNumber = invoiceNumber;

    const newEntries = entries.filter(e => {
      const matchEntryId = entryId && (String(e.id) === String(entryId));
      const matchInvoiceId = invoiceId && (String(e.invoiceId) === String(invoiceId));
      const matchInvoiceNum = invoiceNumber && (
        String(e.invoiceNumber) === String(invoiceNumber) ||
        (e.weightAndDetails && e.weightAndDetails.includes(`فاتورة #${invoiceNumber}`))
      );

      if (matchEntryId || matchInvoiceId || matchInvoiceNum) {
        if (!foundInvoiceId && e.invoiceId) foundInvoiceId = e.invoiceId;
        if (!foundInvoiceNumber && e.invoiceNumber) foundInvoiceNumber = e.invoiceNumber;
        if (!foundInvoiceNumber && e.weightAndDetails) {
          const match = e.weightAndDetails.match(/فاتورة\s*#(\d+)/);
          if (match) foundInvoiceNumber = match[1];
        }
        return false; // استبعاد السطر
      }
      return true;
    });

    if (newEntries.length === entries.length) {
      return res.status(404).json({ success: false, message: "لم يتم العثور على الفاتورة في هذا السجل اليومي" });
    }

    // إعادة احتساب المجاميع
    let salesSum = 0;
    let expSum = 0;
    let visaSum = 0;
    newEntries.forEach(item => {
      const s = parseFloat(item.sales) || 0;
      const e = parseFloat(item.expenses) || 0;
      salesSum += s;
      expSum += e;
      if (item.isVisa) visaSum += s;
    });

    // استبعاد الفاتورة حتى لا تعاد إضافتها في المزامنة التلقائية
    const updatedNotes = addExcludedInvoiceId(register.notes, foundInvoiceId, foundInvoiceNumber);

    await register.update({
      entries: newEntries,
      totalSales: salesSum.toFixed(3),
      totalExpenses: expSum.toFixed(3),
      totalVisaSales: visaSum.toFixed(3),
      netTotal: (salesSum - expSum).toFixed(3),
      notes: updatedNotes
    });

    let formattedRegister = register.toJSON();
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    } else {
      formattedRegister.entries = newEntries;
    }

    res.json({
      success: true,
      message: `تم إزالة الفاتورة ${foundInvoiceNumber ? `رقم #${foundInvoiceNumber}` : ''} من السجل اليومي وتحديث المجاميع بنجاح`,
      data: formattedRegister
    });
  } catch (error) {
    console.error("Error removing invoice from daily register:", error);
    res.status(500).json({ success: false, message: "فشل في إزالة الفاتورة من السجل اليومي", error: error.message });
  }
};

// جلب تفاصيل سجل يومي محدد للأدمن
exports.getDailyRegisterById = async (req, res) => {
  try {
    const { id } = req.params;
    const register = await BranchDailyRegister.findByPk(id, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city', 'phone'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone'] }
      ]
    });

    if (!register) {
      return res.status(404).json({ success: false, message: "السجل اليومي غير موجود" });
    }

    let formattedRegister = register.toJSON();
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    }

    const branchEmployees = await BranchEmployee.findAll({
      where: { branchId: register.branchId, isActive: true },
      attributes: ['id', 'name', 'username', 'phone'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: formattedRegister,
      branchEmployees
    });
  } catch (error) {
    console.error("Error fetching daily register by id:", error);
    res.status(500).json({ success: false, message: "فشل في جلب تفاصيل السجل اليومي", error: error.message });
  }
};

// إنشاء سجل يومي جديد بواسطة الأدمن لفرع وتاريخ معين
exports.createDailyRegisterForAdmin = async (req, res) => {
  try {
    const {
      branchId,
      date,
      dayName,
      employeeId,
      employeeName,
      entries,
      totalGrams,
      totalSales,
      totalExpenses,
      totalVisaSales,
      netTotal,
      totalAdvances,
      brokenSilverGrams,
      brokenGoldGrams,
      status,
      notes
    } = req.body;

    if (!branchId || !date) {
      return res.status(400).json({ success: false, message: "يرجى تحديد الفرع وتاريخ السجل اليومي" });
    }

    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع المحدد غير موجود" });
    }

    // فحص ما إذا كان هناك سجل موجود بالفعل لهذا الفرع وهذا التاريخ
    const existing = await BranchDailyRegister.findOne({
      where: { branchId, date }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `يوجد بالفعل سجل يومي مسجل لـ (${branch.name}) بتاريخ ${date}. يمكنك تعديله مباشرة بدلاً من إنشاء سجل مكرر.`,
        existingId: existing.id
      });
    }

    // تحديد اسم اليوم تلقائياً إذا لم يتم إرساله
    let resolvedDayName = dayName;
    if (!resolvedDayName) {
      const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const d = new Date(date);
      resolvedDayName = !isNaN(d.getDay()) ? arabicDays[d.getDay()] : 'اليوم';
    }

    // التحقق الصارم من تحديد موظف مسؤول ينتمي حصراً لنفس هذا الفرع
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "يجب اختيار الموظف المسؤول الذي سجل هذا السجل، ولا بد أن يكون من موظفي هذا الفرع حصراً."
      });
    }

    const branchEmp = await BranchEmployee.findOne({
      where: { id: employeeId, branchId }
    });
    if (!branchEmp) {
      return res.status(400).json({
        success: false,
        message: `الموظف المختار لا ينتمي إلى فرع (${branch.name}). يجب اختيار موظف مسجل وتابع لنفس هذا الفرع حصراً.`
      });
    }

    const resolvedEmployeeId = branchEmp.id;
    const resolvedEmployeeName = branchEmp.name;

    // معالجة المدخلات وحساب المجاميع
    const initialEntries = Array.isArray(entries) ? entries : [];
    let calcSales = 0;
    let calcExp = 0;
    let calcVisa = 0;
    initialEntries.forEach(item => {
      const s = parseFloat(item.sales) || 0;
      const e = parseFloat(item.expenses) || 0;
      calcSales += s;
      calcExp += e;
      if (item.isVisa) calcVisa += s;
    });

    const finalSales = totalSales !== undefined && totalSales !== '' ? parseFloat(totalSales) : calcSales;
    const finalExp = totalExpenses !== undefined && totalExpenses !== '' ? parseFloat(totalExpenses) : calcExp;
    const finalVisa = totalVisaSales !== undefined && totalVisaSales !== '' ? parseFloat(totalVisaSales) : calcVisa;
    const finalNet = netTotal !== undefined && netTotal !== '' ? parseFloat(netTotal) : (finalSales - finalExp);

    let calcEntryGrams = 0;
    initialEntries.forEach(item => {
      calcEntryGrams += parseFloat(item.weight) || 0;
    });
    const finalGrams = (totalGrams !== undefined && totalGrams !== '' && parseFloat(totalGrams) > 0)
      ? parseFloat(totalGrams)
      : calcEntryGrams;

    // توثيق الموظف المسجل لكل حركة / فاتورة داخل السجل
    for (const item of initialEntries) {
      if (item.employeeId) {
        const itemEmp = await BranchEmployee.findOne({
          where: { id: item.employeeId, branchId }
        });
        if (itemEmp) {
          item.employeeId = itemEmp.id;
          item.employeeName = itemEmp.name;
        } else {
          item.employeeId = resolvedEmployeeId;
          item.employeeName = resolvedEmployeeName;
        }
      } else {
        item.employeeId = resolvedEmployeeId;
        item.employeeName = resolvedEmployeeName;
      }
    }

    const newRegister = await BranchDailyRegister.create({
      branchId,
      date,
      dayName: resolvedDayName,
      employeeId: resolvedEmployeeId,
      employeeName: resolvedEmployeeName,
      entries: initialEntries,
      totalGrams: finalGrams.toFixed(3),
      totalSales: finalSales.toFixed(3),
      totalExpenses: finalExp.toFixed(3),
      totalVisaSales: finalVisa.toFixed(3),
      netTotal: finalNet.toFixed(3),
      totalAdvances: totalAdvances !== undefined && totalAdvances !== '' ? parseFloat(totalAdvances) : 0,
      brokenSilverGrams: brokenSilverGrams !== undefined && brokenSilverGrams !== '' ? parseFloat(brokenSilverGrams) : 0,
      brokenGoldGrams: brokenGoldGrams !== undefined && brokenGoldGrams !== '' ? parseFloat(brokenGoldGrams) : 0,
      status: status || 'مفتوح',
      notes: notes || null
    });

    const fullRegister = await BranchDailyRegister.findByPk(newRegister.id, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city', 'phone'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone'] }
      ]
    });

    let formattedRegister = fullRegister.toJSON();
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    }

    res.status(201).json({
      success: true,
      message: `تم إنشاء السجل اليومي لـ (${branch.name}) بتاريخ ${date} بنجاح`,
      data: formattedRegister
    });
  } catch (error) {
    console.error("Error creating daily register by admin:", error);
    res.status(500).json({ success: false, message: "فشل في إنشاء السجل اليومي", error: error.message });
  }
};

// تعديل أو تحديث السجل اليومي للأدمن
exports.updateDailyRegisterForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const register = await BranchDailyRegister.findByPk(id, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city', 'phone'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone'] }
      ]
    });

    if (!register) {
      return res.status(404).json({ success: false, message: "السجل اليومي غير موجود" });
    }

    const {
      branchId,
      date,
      dayName,
      employeeId,
      employeeName,
      entries,
      totalGrams,
      totalSales,
      totalExpenses,
      totalVisaSales,
      netTotal,
      totalAdvances,
      brokenSilverGrams,
      brokenGoldGrams,
      status,
      notes
    } = req.body;

    // إذا تغير التاريخ ولم يرسل اسم اليوم، نعيد حسابه
    let resolvedDayName = dayName;
    if (date && !resolvedDayName) {
      const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const d = new Date(date);
      resolvedDayName = !isNaN(d.getDay()) ? arabicDays[d.getDay()] : register.dayName;
    }

    const targetBranchId = branchId !== undefined ? branchId : register.branchId;
    let targetEmployeeId = employeeId !== undefined ? employeeId : register.employeeId;
    let targetEmployeeName = employeeName !== undefined ? employeeName : register.employeeName;

    if (employeeId !== undefined) {
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: "يجب تحديد الموظف المسؤول عن السجل، ولا بد أن يكون من موظفي هذا الفرع حصراً."
        });
      }
      const verifiedEmp = await BranchEmployee.findOne({
        where: { id: employeeId, branchId: targetBranchId }
      });
      if (!verifiedEmp) {
        return res.status(400).json({
          success: false,
          message: "الموظف المختار لا ينتمي إلى فرع هذا السجل اليومي. يجب اختيار موظف تابع لنفس هذا الفرع حصراً."
        });
      }
      targetEmployeeId = verifiedEmp.id;
      targetEmployeeName = verifiedEmp.name;
    } else if (branchId !== undefined && branchId !== register.branchId) {
      const verifiedEmp = await BranchEmployee.findOne({
        where: { id: targetEmployeeId, branchId: targetBranchId }
      });
      if (!verifiedEmp) {
        return res.status(400).json({
          success: false,
          message: "الموظف المسجل حالياً لا يتبع للفرع الجديد المختار. يرجى اختيار موظف تابع للفرع الجديد."
        });
      }
    }

    if (entries !== undefined && Array.isArray(entries)) {
      for (const item of entries) {
        if (item.employeeId) {
          const itemEmp = await BranchEmployee.findOne({
            where: { id: item.employeeId, branchId: targetBranchId }
          });
          if (itemEmp) {
            item.employeeId = itemEmp.id;
            item.employeeName = itemEmp.name;
          } else {
            item.employeeId = targetEmployeeId;
            item.employeeName = targetEmployeeName;
          }
        } else {
          item.employeeId = targetEmployeeId;
          item.employeeName = targetEmployeeName;
        }
      }
    }

    // إذا تم تمرير entries جديدة بدون فرض إجمالي المبيعات، نعيد حسابها
    let salesVal = totalSales;
    let expVal = totalExpenses;
    let visaVal = totalVisaSales;
    let netVal = netTotal;
    let gramsVal = totalGrams;

    if (entries !== undefined && Array.isArray(entries)) {
      let gSum = 0;
      entries.forEach(item => {
        gSum += parseFloat(item.weight) || 0;
      });
      if (totalGrams === undefined || totalGrams === '' || parseFloat(totalGrams) === 0) {
        gramsVal = gSum.toFixed(3);
      }
    }

    if (entries !== undefined && Array.isArray(entries) && totalSales === undefined && totalExpenses === undefined) {
      let sSum = 0;
      let eSum = 0;
      let vSum = 0;
      entries.forEach(item => {
        const s = parseFloat(item.sales) || 0;
        const e = parseFloat(item.expenses) || 0;
        sSum += s;
        eSum += e;
        if (item.isVisa) vSum += s;
      });
      salesVal = sSum.toFixed(3);
      expVal = eSum.toFixed(3);
      visaVal = vSum.toFixed(3);
      netVal = (sSum - eSum).toFixed(3);
    }

    await register.update({
      branchId: branchId !== undefined ? branchId : register.branchId,
      date: date !== undefined ? date : register.date,
      dayName: resolvedDayName !== undefined ? resolvedDayName : register.dayName,
      employeeId: targetEmployeeId,
      employeeName: targetEmployeeName,
      entries: entries !== undefined ? entries : register.entries,
      totalGrams: totalGrams !== undefined ? totalGrams : register.totalGrams,
      totalSales: salesVal !== undefined ? salesVal : register.totalSales,
      totalExpenses: expVal !== undefined ? expVal : register.totalExpenses,
      totalVisaSales: visaVal !== undefined ? visaVal : register.totalVisaSales,
      netTotal: netVal !== undefined ? netVal : register.netTotal,
      totalAdvances: totalAdvances !== undefined ? totalAdvances : register.totalAdvances,
      brokenSilverGrams: brokenSilverGrams !== undefined ? brokenSilverGrams : register.brokenSilverGrams,
      brokenGoldGrams: brokenGoldGrams !== undefined ? brokenGoldGrams : register.brokenGoldGrams,
      status: status !== undefined ? status : register.status,
      notes: notes !== undefined ? notes : register.notes
    });

    const refreshed = await BranchDailyRegister.findByPk(register.id, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'code', 'city', 'phone'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone'] }
      ]
    });

    let formattedRegister = refreshed.toJSON();
    if (typeof formattedRegister.entries === 'string') {
      try { formattedRegister.entries = JSON.parse(formattedRegister.entries); } catch (e) { formattedRegister.entries = []; }
    }

    res.json({
      success: true,
      message: "تم تحديث السجل اليومي بنجاح",
      data: formattedRegister
    });
  } catch (error) {
    console.error("Error updating daily register:", error);
    res.status(500).json({ success: false, message: "فشل في تحديث السجل اليومي", error: error.message });
  }
};

// ==========================================
// 6. طلبات سلف موظفي الفروع (Employee Advances)
// ==========================================

// الموظف يطلب سلفة مالية - مرتبطة بالراتب وبالمتبقي من الراتب بعد السلف السابقة
exports.createAdvanceRequest = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const employee = await BranchEmployee.findByPk(employeeId, {
      include: [{ model: Branch, as: 'branch' }]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "حساب الموظف غير موجود" });
    }

    const { amount, reason } = req.body;
    const requestedAmount = parseFloat(amount);

    if (!amount || isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ success: false, message: "يرجى تحديد مبلغ السلفة المطلوب بشكل صحيح" });
    }

    const salary = parseFloat(employee.salary) || 0;
    if (salary <= 0) {
      return res.status(400).json({
        success: false,
        message: "لم يتم تسجيل راتب شهري لحسابك بعد من قِبل الإدارة. يرجى مراجعة الإدارة لتحديد الراتب أولاً لطلب السلفة."
      });
    }

    // حساب مجموع سلف هذا الشهر (المعلقة والمقبولة)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentMonthAdvances = await EmployeeAdvance.findAll({
      where: {
        employeeId: employee.id,
        requestDate: { [Op.like]: `${currentMonth}%` },
        status: { [Op.in]: ['معلق', 'مقبول'] }
      }
    });

    const totalTakenAdvances = currentMonthAdvances.reduce((sum, adv) => sum + (parseFloat(adv.amount) || 0), 0);
    const remainingSalary = Math.max(0, salary - totalTakenAdvances);

    if (requestedAmount > remainingSalary) {
      return res.status(400).json({
        success: false,
        message: `مبلغ السلفة المطلوب (${requestedAmount} د.أ) يتجاوز الحد المسموح به. الراتب الشهري: ${salary} د.أ، السلف السابقة هذا الشهر: ${totalTakenAdvances} د.أ، المتبقي المتاح للسلفة: ${remainingSalary} د.أ.`
      });
    }

    const requestDate = new Date().toISOString().split('T')[0];

    const advance = await EmployeeAdvance.create({
      branchId: employee.branchId,
      employeeId: employee.id,
      employeeName: employee.name,
      amount: requestedAmount,
      requestDate,
      reason: reason ? reason.trim() : '',
      status: 'معلق'
    });

    // إرسال تنبيه بالبريد الإلكتروني إلى الأدمن
    try {
      const subject = `طلب سلفة جديد: ${employee.name} (${requestedAmount} د.أ)`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #1e293b;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">طلب سلفة جديد قيد الانتظار</h2>
          <p>قام الموظف <strong>${employee.name}</strong> بتقديم طلب سلفة جديد وهو بانتظار المراجعة والاعتماد.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 40%;">الموظف:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${employee.name}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">الفرع:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${employee.branch ? employee.branch.name : 'غير محدد'}</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">مبلغ السلفة المطلوب:</td><td style="padding: 8px; border: 1px solid #e2e8f0; color: #b91c1c; font-weight: bold;">${requestedAmount} د.أ</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">الراتب الشهري:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${salary} د.أ</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">سلف سابقة هذا الشهر:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${totalTakenAdvances} د.أ</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">المتبقي من الراتب بعد هذه السلفة:</td><td style="padding: 8px; border: 1px solid #e2e8f0; color: #047857; font-weight: bold;">${(remainingSalary - requestedAmount).toFixed(3)} د.أ</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">تاريخ الطلب:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${requestDate}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">سبب السلفة / ملاحظات:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${reason || 'غير محدد'}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
            يرجى تسجيل الدخول إلى لوحة إدارة مصوغات ELITE SILVER 925 لمراجعة الطلب والموافقة عليه أو رفضه.
          </p>
        </div>
      `;
      sendEmailNotificationToAdmin(subject, html).catch(err => console.error("Admin advance email error:", err.message));
    } catch (emailErr) {
      console.error("Failed to trigger admin email notification:", emailErr);
    }

    res.status(201).json({
      success: true,
      message: "تم تقديم طلب السلفة بنجاح وإرسال إشعار للإدارة، وهو بانتظار الموافقة",
      data: advance,
      salaryInfo: {
        salary,
        totalTakenAdvances: totalTakenAdvances + requestedAmount,
        remainingSalary: (remainingSalary - requestedAmount).toFixed(3)
      }
    });
  } catch (error) {
    console.error("Error creating advance request:", error);
    res.status(500).json({ success: false, message: "فشل في إرسال طلب السلفة", error: error.message });
  }
};

// الموظف يستعرض طلبات سلفه مع معلومات الراتب والمتبقي
exports.getMyAdvanceRequests = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const employee = await BranchEmployee.findByPk(employeeId, {
      attributes: ['id', 'name', 'salary', 'email']
    });

    const advances = await EmployeeAdvance.findAll({
      where: { employeeId },
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }],
      order: [['id', 'DESC']]
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthAdvances = advances.filter(adv =>
      adv.requestDate && adv.requestDate.startsWith(currentMonth) && (adv.status === 'معلق' || adv.status === 'مقبول')
    );

    const salary = parseFloat(employee?.salary) || 0;
    const totalTakenAdvances = monthAdvances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const remainingSalary = Math.max(0, salary - totalTakenAdvances);

    res.json({
      success: true,
      data: advances,
      salary,
      totalTakenAdvances,
      remainingSalary: remainingSalary.toFixed(3)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب طلبات السلف", error: error.message });
  }
};

// الأدمن يستعرض جميع طلبات السلف
exports.getAllAdvanceRequests = async (req, res) => {
  try {
    const { branchId, employeeId, status, month, fromDate, toDate, search } = req.query;
    const where = {};

    if (branchId) where.branchId = branchId;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    if (month) {
      where.requestDate = { [Op.like]: `${month}%` };
    } else if (fromDate && toDate) {
      where.requestDate = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.requestDate = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.requestDate = { [Op.lte]: toDate };
    }

    if (search) {
      where[Op.or] = [
        { employeeName: { [Op.like]: `%${search}%` } },
        { reason: { [Op.like]: `%${search}%` } }
      ];
    }

    const advances = await EmployeeAdvance.findAll({
      where,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone', 'email', 'salary', 'nationalId'] }
      ],
      order: [['id', 'DESC']]
    });

    let totalAmount = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;

    const employeeBreakdown = {};

    advances.forEach(adv => {
      const amt = parseFloat(adv.amount) || 0;
      totalAmount += amt;
      if (adv.status === 'مقبول') approvedAmount += amt;
      else if (adv.status === 'معلق') pendingAmount += amt;
      else if (adv.status === 'مرفوض') rejectedAmount += amt;

      const empId = adv.employeeId;
      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = {
          employeeId: empId,
          employeeName: adv.employeeName,
          branchName: adv.branch?.name || '',
          salary: adv.employee?.salary || 0,
          email: adv.employee?.email || '',
          totalRequested: 0,
          approvedTotal: 0,
          pendingTotal: 0,
          rejectedTotal: 0,
          advancesCount: 0,
          advances: []
        };
      }
      employeeBreakdown[empId].totalRequested += amt;
      if (adv.status === 'مقبول') employeeBreakdown[empId].approvedTotal += amt;
      else if (adv.status === 'معلق') employeeBreakdown[empId].pendingTotal += amt;
      else if (adv.status === 'مرفوض') employeeBreakdown[empId].rejectedTotal += amt;
      employeeBreakdown[empId].advancesCount += 1;
      employeeBreakdown[empId].advances.push(adv);
    });

    res.json({
      success: true,
      data: advances,
      summary: {
        totalAmount: totalAmount.toFixed(3),
        approvedAmount: approvedAmount.toFixed(3),
        pendingAmount: pendingAmount.toFixed(3),
        rejectedAmount: rejectedAmount.toFixed(3),
        totalCount: advances.length
      },
      employeeBreakdown: Object.values(employeeBreakdown)
    });
  } catch (error) {
    console.error("Error fetching all advance requests:", error);
    res.status(500).json({ success: false, message: "فشل في جلب طلبات السلف", error: error.message });
  }
};

// الأدمن يوافق أو يرفض طلب سلفة + إرسال بريد إلكتروني للموظف بالنتيجة
exports.updateAdvanceRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponseNotes } = req.body;

    if (!['مقبول', 'مرفوض', 'معلق'].includes(status)) {
      return res.status(400).json({ success: false, message: "حالة الطلب غير صالحة" });
    }

    const advance = await EmployeeAdvance.findByPk(id, {
      include: [
        { model: Branch, as: 'branch' },
        { model: BranchEmployee, as: 'employee' }
      ]
    });

    if (!advance) {
      return res.status(404).json({ success: false, message: "طلب السلفة غير موجود" });
    }

    const actionDate = new Date().toISOString().split('T')[0];

    await advance.update({
      status,
      adminResponseNotes: adminResponseNotes !== undefined ? adminResponseNotes : advance.adminResponseNotes,
      approvedByAdminId: req.user?.id || null,
      approvedByAdminName: req.user?.name || req.user?.username || 'إدارة ELITE SILVER',
      actionDate
    });

    // إرسال تنبيه بالبريد الإلكتروني إلى الموظف إذا كان لديه بريد مسجل
    const employee = advance.employee;
    if (employee && employee.email && employee.email.includes('@')) {
      try {
        const isApproved = status === 'مقبول';
        const subject = `تحديث بخصوص طلب السلفة - ${isApproved ? 'تمت الموافقة ✅' : status === 'مرفوض' ? 'تم الرفض ❌' : 'قيد المراجعة'}`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #1e293b;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">إشعار حالة طلب السلفة</h2>
            <p>مرحباً <strong>${employee.name}</strong>،</p>
            <p>نحيطك علماً بأنه تم اتخاذ قرار الإدارة بخصوص طلب السلفة الخاص بك المقدم بتاريخ <strong>${advance.requestDate}</strong> بمبلغ <strong>${advance.amount} د.أ</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
              <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 40%;">حالة الطلب:</td><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${isApproved ? '#047857' : '#b91c1c'};">${isApproved ? 'تمت الموافقة على السلفة ✅' : status === 'مرفوض' ? 'تم رفض طلب السلفة ❌' : 'قيد الانتظار'}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${advance.amount} د.أ</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">تاريخ الرد:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${actionDate}</td></tr>
              ${adminResponseNotes ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">ملاحظات الإدارة:</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${adminResponseNotes}</td></tr>` : ''}
            </table>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
              مصوغات ELITE SILVER 925 • قسم الموارد البشرية والإدارة
            </p>
          </div>
        `;
        sendEmailNotification(employee.email.trim(), subject, html).catch(err => console.error("Employee advance email error:", err.message));
      } catch (mailErr) {
        console.error("Failed to send email to employee:", mailErr);
      }
    }

    res.json({
      success: true,
      message: `تم تحديث حالة طلب السلفة إلى (${status}) بنجاح${employee?.email ? '، وتم إرسال إشعار بريدي للموظف' : ''}`,
      data: advance
    });
  } catch (error) {
    console.error("Error updating advance request status:", error);
    res.status(500).json({ success: false, message: "فشل في تحديث حالة السلفة", error: error.message });
  }
};

// ==========================================
// 7. الجرد الفعلي (Inventory Audits)
// ==========================================

exports.getInventoryAudits = async (req, res) => {
  try {
    const { branchId } = req.query;
    const where = {};
    if (branchId) where.branchId = branchId;

    const audits = await BranchInventoryAudit.findAll({
      where,
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] }],
      order: [['auditDate', 'DESC'], ['id', 'DESC']]
    });

    const parsed = audits.map(a => {
      const j = a.toJSON();
      if (typeof j.items === 'string') {
        try { j.items = JSON.parse(j.items); } catch (e) { j.items = []; }
      }
      return j;
    });

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب سجلات الجرد", error: error.message });
  }
};

exports.createInventoryAudit = async (req, res) => {
  try {
    const {
      branchId,
      auditTitle,
      auditDate,
      items,
      totalSystemWeight,
      totalActualWeight,
      totalWeightDiff,
      totalSystemCount,
      totalActualCount,
      totalCountDiff,
      notes
    } = req.body;

    if (!branchId || !auditTitle) {
      return res.status(400).json({ success: false, message: "الفرع وعنوان الجرد مطلوبان" });
    }

    const audit = await BranchInventoryAudit.create({
      branchId,
      auditTitle,
      auditDate: auditDate || new Date().toISOString().split('T')[0],
      adminId: req.user?.id || null,
      adminName: req.user?.name || req.user?.username || 'الإدارة',
      items: items || [],
      totalSystemWeight: parseFloat(totalSystemWeight) || 0,
      totalActualWeight: parseFloat(totalActualWeight) || 0,
      totalWeightDiff: parseFloat(totalWeightDiff) || 0,
      totalSystemCount: parseInt(totalSystemCount, 10) || 0,
      totalActualCount: parseInt(totalActualCount, 10) || 0,
      totalCountDiff: parseInt(totalCountDiff, 10) || 0,
      notes
    });

    res.status(201).json({ success: true, message: "تم تسجيل عملية الجرد بنجاح", data: audit });
  } catch (error) {
    console.error("Error creating inventory audit:", error);
    res.status(500).json({ success: false, message: "فشل في تسجيل الجرد", error: error.message });
  }
};

exports.deleteInventoryAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await BranchInventoryAudit.findByPk(id);
    if (!audit) {
      return res.status(404).json({ success: false, message: "سجل الجرد غير موجود" });
    }
    await audit.destroy();
    res.json({ success: true, message: "تم حذف سجل الجرد بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في حذف سجل الجرد", error: error.message });
  }
};

// ==========================================
// 8. البيانات التجريبية الأولية (Seed Data)
// ==========================================

exports.runSeedData = async (req, res) => {
  try {
    let branchesCount = await Branch.count();
    if (branchesCount === 0) {
      const b1 = await Branch.create({
        name: 'فرع أبو نصير',
        code: 'ABN-01',
        city: 'عمان',
        address: 'عمان أبو نصير - الشارع الرئيسي - بجانب محمص الشعب',
        phone: '0795109323',
        phone2: '078504817',
        phone3: '0782261996',
        managerName: 'أبو نصير',
        isActive: true
      });

      const b2 = await Branch.create({
        name: 'فرع خلدا',
        code: 'KHL-02',
        city: 'عمان',
        address: 'عمان - خلدا - شارع وصفي التل - مقابل مخابز فورنجي',
        phone: '0795109323',
        phone2: '078504817',
        phone3: '0782261996',
        managerName: 'خلدا',
        isActive: true
      });

      await BranchEmployee.create({
        branchId: b1.id,
        name: 'موظف أبو نصير',
        username: 'abunseir',
        password: '123456@Password',
        phone: '0795109323',
        email: 'abunseir@elitesilver925.com',
        salary: 400.000,
        isActive: true
      });

      await BranchEmployee.create({
        branchId: b2.id,
        name: 'موظف خلدا',
        username: 'khalda',
        password: '123456@Password',
        phone: '078504817',
        email: 'khalda@elitesilver925.com',
        salary: 450.000,
        isActive: true
      });
    }

    res.json({ success: true, message: "تم التحقق من بيانات الفروع والموظفين بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تهيئة البيانات", error: error.message });
  }
};

// ==========================================
// 8. سجل الحضور والغياب (Employee Attendance)
// ==========================================

// تسجيل الانصراف والخروج التلقائي للموظف
exports.employeeLogout = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

    let attendance = await EmployeeAttendance.findOne({
      where: { employeeId, date: today }
    });

    if (attendance) {
      let hours = parseFloat(attendance.totalHours) || 0;
      if (attendance.checkInTime) {
        const [inH, inM, inS] = attendance.checkInTime.split(':').map(Number);
        const [outH, outM, outS] = timeStr.split(':').map(Number);
        const inSeconds = inH * 3600 + inM * 60 + (inS || 0);
        const outSeconds = outH * 3600 + outM * 60 + (outS || 0);
        const diffSec = Math.max(0, outSeconds - inSeconds);
        hours = parseFloat((diffSec / 3600).toFixed(2));
      }

      await attendance.update({
        checkOutTime: timeStr,
        totalHours: hours
      });
    }

    res.json({ success: true, message: "تم تسجيل الانصراف وتسجيل الخروج بنجاح" });
  } catch (error) {
    console.error("Error logging out employee attendance:", error);
    res.status(500).json({ success: false, message: "فشل في تسجيل الخروج", error: error.message });
  }
};

// سجل حضور الموظف للشهر الحالي أو فترة محددة
exports.getMyAttendance = async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const { month, fromDate, toDate } = req.query;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const targetMonth = month || currentMonth;

    const where = { employeeId };
    if (fromDate && toDate) {
      where.date = { [Op.between]: [fromDate, toDate] };
    } else {
      where.date = { [Op.like]: `${targetMonth}%` };
    }

    const records = await EmployeeAttendance.findAll({
      where,
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    const today = new Date().toISOString().split('T')[0];
    const todayRecord = records.find(r => r.date === today) || null;

    let totalWorkedHours = 0;
    let totalDaysAttended = 0;
    records.forEach(r => {
      if (r.status === 'حاضر') totalDaysAttended++;
      totalWorkedHours += parseFloat(r.totalHours) || 0;
    });

    res.json({
      success: true,
      data: records,
      todayRecord,
      summary: {
        totalDaysAttended,
        totalWorkedHours: totalWorkedHours.toFixed(2),
        recordsCount: records.length
      }
    });
  } catch (error) {
    console.error("Error fetching my attendance:", error);
    res.status(500).json({ success: false, message: "فشل في جلب سجل الحضور", error: error.message });
  }
};

// سجل الحضور والغياب للإدارة (جميع الفروع والموظفين)
exports.getAllAttendanceForAdmin = async (req, res) => {
  try {
    const { branchId, employeeId, date, month, fromDate, toDate, status } = req.query;
    const where = {};
    if (branchId) where.branchId = branchId;
    if (employeeId) where.employeeId = employeeId;
    if (date) where.date = date;
    else if (month) where.date = { [Op.like]: `${month}%` };
    else if (fromDate && toDate) where.date = { [Op.between]: [fromDate, toDate] };
    if (status) where.status = status;

    const records = await EmployeeAttendance.findAll({
      where,
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] },
        { model: BranchEmployee, as: 'employee', attributes: ['id', 'name', 'username', 'phone', 'salary'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    let totalAttended = 0;
    let totalAbsent = 0;
    let totalHours = 0;

    records.forEach(r => {
      if (r.status === 'حاضر') totalAttended++;
      else if (r.status === 'غياب') totalAbsent++;
      totalHours += parseFloat(r.totalHours) || 0;
    });

    res.json({
      success: true,
      data: records,
      summary: {
        totalRecords: records.length,
        totalAttended,
        totalAbsent,
        totalHours: totalHours.toFixed(2)
      }
    });
  } catch (error) {
    console.error("Error fetching admin attendance:", error);
    res.status(500).json({ success: false, message: "فشل في جلب سجلات الحضور", error: error.message });
  }
};

// تعديل حالة الحضور أو الملاحظات من الإدارة
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, totalHours, checkInTime, checkOutTime } = req.body;
    const attendance = await EmployeeAttendance.findByPk(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "السجل غير موجود" });
    }
    if (status !== undefined) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;
    if (totalHours !== undefined) attendance.totalHours = parseFloat(totalHours) || 0;
    if (checkInTime !== undefined) attendance.checkInTime = checkInTime;
    if (checkOutTime !== undefined) attendance.checkOutTime = checkOutTime;
    await attendance.save();
    res.json({ success: true, message: "تم تحديث سجل الحضور بنجاح", data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تحديث السجل", error: error.message });
  }
};

// إنشاء سجل حضور / غياب يدوي من الإدارة
exports.createManualAttendance = async (req, res) => {
  try {
    const { employeeId, branchId, date, status, checkInTime, checkOutTime, totalHours, notes } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ success: false, message: "الموظف والتاريخ مطلوبان" });
    }
    const employee = await BranchEmployee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }
    const targetBranchId = branchId || employee.branchId;
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = arabicDays[new Date(date).getDay()];

    const [record, created] = await EmployeeAttendance.findOrCreate({
      where: { employeeId, date },
      defaults: {
        branchId: targetBranchId,
        dayName,
        status: status || 'حاضر',
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        totalHours: totalHours || 0,
        notes: notes || null
      }
    });

    if (!created) {
      await record.update({
        status: status || record.status,
        checkInTime: checkInTime !== undefined ? checkInTime : record.checkInTime,
        checkOutTime: checkOutTime !== undefined ? checkOutTime : record.checkOutTime,
        totalHours: totalHours !== undefined ? totalHours : record.totalHours,
        notes: notes !== undefined ? notes : record.notes
      });
    }

    res.status(201).json({ success: true, message: "تم تسجيل الحضور/الغياب بنجاح", data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تسجيل الحضور", error: error.message });
  }
};



// إنشاء فاتورة جديدة من قبل الأدمن لموظف تابع لفرع معين
exports.createInvoiceForAdmin = async (req, res) => {
  try {
    const {
      branchId,
      employeeId,
      invoiceNumber,
      date,
      paymentType,
      customerName,
      customerPhone,
      items,
      subtotal,
      discount,
      total,
      recipientName,
      notes
    } = req.body;

    if (!branchId || !employeeId) {
      return res.status(400).json({ success: false, message: "الفرع والموظف المسؤول مطلوبان لإنشاء الفاتورة" });
    }

    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "الفرع المحدد غير موجود" });
    }

    // التحقق الصارم من أن الموظف تابع لنفس الفرع
    const emp = await BranchEmployee.findOne({
      where: { id: employeeId, branchId }
    });
    if (!emp) {
      return res.status(400).json({
        success: false,
        message: `الموظف المحدد لا ينتمي إلى فرع (${branch.name}). يجب اختيار موظف تابع لنفس الفرع حصراً لتسجيل الفاتورة باسمه.`
      });
    }

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "رقم الفاتورة مطلوب" });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    const invoice = await BranchInvoice.create({
      branchId,
      employeeId: emp.id,
      employeeName: emp.name,
      invoiceNumber,
      date: targetDate,
      paymentType: paymentType || 'نقدي',
      customerName,
      customerPhone,
      items: items || [],
      subtotal: parseFloat(subtotal) || 0,
      discount: parseFloat(discount) || 0,
      total: parseFloat(total) || 0,
      recipientName: recipientName || emp.name,
      notes
    });

    // مزامنة الفاتورة في السجل اليومي تلقائياً باسم الموظف التابع للفرع
    await syncInvoicesToDailyRegister(branchId, targetDate, emp.id, emp.name);

    // احتساب أثر الفاتورة الفوري على تارجت الموظف
    const invoiceMonth = targetDate.slice(0, 7);
    const updatedTargetProgress = await calculateEmployeeTargetProgress(emp.id, invoiceMonth);

    res.status(201).json({
      success: true,
      message: `تم تسجيل الفاتورة #${invoiceNumber} وتحديث تارجت الموظف (${emp.name}) بنجاح (+ ${(parseFloat(total) || 0).toFixed(3)} د.أ)`,
      data: invoice,
      targetProgress: updatedTargetProgress
    });
  } catch (error) {
    console.error("Error creating invoice for admin:", error);
    res.status(500).json({ success: false, message: "فشل في إنشاء الفاتورة", error: error.message });
  }
};


function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

// دالة منطق مطابقة وإسناد الفواتير القديمة إلى موظفي الفروع
async function syncOldInvoicesLogic({ branchId = null, dryRun = false } = {}) {
  const employees = await BranchEmployee.findAll({
    include: [{ model: Branch, as: 'branch' }],
    attributes: { exclude: ['password'] }
  });

  const branches = await Branch.findAll();

  const branchEmployeesMap = {};
  branches.forEach(b => {
    branchEmployeesMap[b.id] = employees.filter(e => e.branchId === b.id);
  });

  const invoiceWhere = {};
  if (branchId) invoiceWhere.branchId = branchId;
  const invoices = await BranchInvoice.findAll({
    where: invoiceWhere,
    order: [['id', 'ASC']]
  });

  const registerWhere = {};
  if (branchId) registerWhere.branchId = branchId;
  const dailyRegisters = await BranchDailyRegister.findAll({
    where: registerWhere
  });

  let invoicesScanned = invoices.length;
  let invoicesAlreadyAssigned = 0;
  let invoicesNewlyAssigned = 0;
  let invoicesUnassigned = 0;
  const assignedDetails = [];

  for (const inv of invoices) {
    if (inv.employeeId) {
      invoicesAlreadyAssigned++;
      continue;
    }

    const bEmps = branchEmployeesMap[inv.branchId] || [];
    let matchedEmployee = null;
    let matchReason = '';

    // أ) مطابقة اسم الموظف المخزن مسبقاً
    if (inv.employeeName) {
      const norm = normalizeArabic(inv.employeeName);
      matchedEmployee = bEmps.find(e => normalizeArabic(e.name) === norm) ||
                        employees.find(e => normalizeArabic(e.name) === norm);
      if (matchedEmployee) matchReason = `تطابق اسم الموظف (${inv.employeeName})`;
    }

    // ب) مطابقة اسم المستلم / الكاشير المسجل بالفاتورة
    if (!matchedEmployee && inv.recipientName) {
      const norm = normalizeArabic(inv.recipientName);
      matchedEmployee = bEmps.find(e => normalizeArabic(e.name) === norm) ||
                        employees.find(e => normalizeArabic(e.name) === norm);
      if (matchedEmployee) matchReason = `تطابق اسم المستلم (${inv.recipientName})`;
    }

    // ج) البحث داخل السجل اليومي لنفس الفرع ونفس التاريخ
    if (!matchedEmployee) {
      const matchingRegister = dailyRegisters.find(r => r.branchId === inv.branchId && r.date === inv.date);
      if (matchingRegister) {
        let entries = [];
        if (Array.isArray(matchingRegister.entries)) entries = matchingRegister.entries;
        else if (typeof matchingRegister.entries === 'string') {
          try { entries = JSON.parse(matchingRegister.entries); } catch (e) { entries = []; }
        }

        const matchEntry = entries.find(e =>
          (e.invoiceId && String(e.invoiceId) === String(inv.id)) ||
          (e.invoiceNumber && String(e.invoiceNumber) === String(inv.invoiceNumber)) ||
          (e.weightAndDetails && e.weightAndDetails.includes(`فاتورة #${inv.invoiceNumber}`))
        );

        if (matchEntry) {
          if (matchEntry.employeeId) {
            matchedEmployee = employees.find(e => e.id === matchEntry.employeeId);
            if (matchedEmployee) matchReason = `إسناد من سطر السجل اليومي #${matchingRegister.id}`;
          } else if (matchEntry.employeeName) {
            const norm = normalizeArabic(matchEntry.employeeName);
            matchedEmployee = employees.find(e => normalizeArabic(e.name) === norm);
            if (matchedEmployee) matchReason = `إسناد من اسم موظف سطر السجل اليومي (${matchEntry.employeeName})`;
          }
        }

        // إذا لم نجد في السطور، هل السجل نفسه مسجل باسم موظف؟
        if (!matchedEmployee && matchingRegister.employeeId) {
          matchedEmployee = employees.find(e => e.id === matchingRegister.employeeId);
          if (matchedEmployee) matchReason = `إسناد من الموظف المسؤول عن سجل اليوم #${matchingRegister.id}`;
        }
      }
    }

    // د) إذا كان الفرع يحتوي على موظف واحد فقط
    if (!matchedEmployee && bEmps.length === 1) {
      matchedEmployee = bEmps[0];
      matchReason = `الموظف الوحيد المسجل في فرع (${matchedEmployee.branch?.name || bEmps[0].branchId})`;
    }

    if (matchedEmployee) {
      invoicesNewlyAssigned++;
      assignedDetails.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        total: inv.total,
        branchId: inv.branchId,
        employeeId: matchedEmployee.id,
        employeeName: matchedEmployee.name,
        reason: matchReason
      });

      if (!dryRun) {
        await inv.update({
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.name
        });
      }
    } else {
      invoicesUnassigned++;
    }
  }

  // 4. فحص وتحديث أسطر السجلات اليومية (Daily Registers)
  let registersScanned = dailyRegisters.length;
  let registerEntriesUpdated = 0;

  for (const reg of dailyRegisters) {
    let entries = [];
    if (Array.isArray(reg.entries)) entries = reg.entries;
    else if (typeof reg.entries === 'string') {
      try { entries = JSON.parse(reg.entries); } catch (e) { entries = []; }
    }

    let modified = false;
    const bEmps = branchEmployeesMap[reg.branchId] || [];

    const updatedEntries = entries.map(entry => {
      if (entry.employeeId && entry.employeeName) {
        return entry;
      }

      let resolvedEmp = null;

      // أ) إذا كانت مرتبطة بفاتورة
      if (entry.invoiceId || entry.invoiceNumber) {
        const inv = invoices.find(i =>
          (entry.invoiceId && String(i.id) === String(entry.invoiceId)) ||
          (entry.invoiceNumber && String(i.invoiceNumber) === String(entry.invoiceNumber))
        );
        if (inv && inv.employeeId) {
          resolvedEmp = employees.find(e => e.id === inv.employeeId);
        }
      }

      // ب) إذا كان السطر يحمل اسم موظف
      if (!resolvedEmp && entry.employeeName) {
        const norm = normalizeArabic(entry.employeeName);
        resolvedEmp = employees.find(e => normalizeArabic(e.name) === norm);
      }

      // ج) من الموظف المسؤول عن السجل
      if (!resolvedEmp && reg.employeeId) {
        resolvedEmp = employees.find(e => e.id === reg.employeeId);
      }

      // د) الموظف الوحيد في الفرع
      if (!resolvedEmp && bEmps.length === 1) {
        resolvedEmp = bEmps[0];
      }

      if (resolvedEmp) {
        modified = true;
        registerEntriesUpdated++;
        return {
          ...entry,
          employeeId: resolvedEmp.id,
          employeeName: resolvedEmp.name
        };
      }

      return entry;
    });

    if (modified && !dryRun) {
      await reg.update({ entries: updatedEntries });
    }
  }

  return {
    invoicesScanned,
    invoicesAlreadyAssigned,
    invoicesNewlyAssigned,
    invoicesUnassigned,
    registersScanned,
    registerEntriesUpdated,
    assignedDetails
  };
}

exports.syncOldInvoicesLogic = syncOldInvoicesLogic;

// مسار للأدمن لتنفيذ فحص وإسناد الفواتير القديمة ومزامنة التارجت فوراً
exports.syncOldInvoicesToEmployeeTargets = async (req, res) => {
  try {
    const { branchId, dryRun } = req.body || {};
    const result = await syncOldInvoicesLogic({
      branchId: branchId || null,
      dryRun: Boolean(dryRun)
    });

    res.json({
      success: true,
      message: `تم فحص ${result.invoicesScanned} فاتورة بنجاح، وتم إسناد ${result.invoicesNewlyAssigned} فاتورة قديمة لموظفي الفروع وتحديث تارجت مبيعاتهم والجرامات!`,
      data: result
    });
  } catch (error) {
    console.error("Error in syncOldInvoicesToEmployeeTargets:", error);
    res.status(500).json({ success: false, message: "فشل في مزامنة الفواتير القديمة للتارجت", error: error.message });
  }
};
