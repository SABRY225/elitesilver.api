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
  EmployeeAttendance
} = db;

// التأكد التلقائي من وجود جدول employee_attendances وأعمدة email و salary
(async () => {
  try {
    if (EmployeeAttendance) {
      await EmployeeAttendance.sync();
    }
  } catch (e) {
    console.warn("EmployeeAttendance sync check:", e.message);
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
})();

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

    const employees = await BranchEmployee.findAll({
      where,
      include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'city'] }],
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب الموظفين", error: error.message });
  }
};

exports.createBranchEmployee = async (req, res) => {
  try {
    const { branchId, name, username, password, phone, email, salary, nationalId } = req.body;
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

    const employee = await BranchEmployee.create({
      branchId,
      name,
      username: username.toLowerCase().trim(),
      password,
      phone,
      email: email ? email.trim() : null,
      salary: salary !== undefined && salary !== '' ? parseFloat(salary) : 0,
      nationalId,
      isActive: true
    });

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

    const { branchId, name, username, password, phone, email, salary, nationalId, isActive } = req.body;

    if (username && username.toLowerCase().trim() !== employee.username) {
      const existing = await BranchEmployee.findOne({ where: { username: username.toLowerCase().trim() } });
      if (existing) {
        return res.status(400).json({ success: false, message: "اسم المستخدم مستخدم مسبقاً" });
      }
      employee.username = username.toLowerCase().trim();
    }

    if (branchId) employee.branchId = branchId;
    if (name) employee.name = name;
    if (phone !== undefined) employee.phone = phone;
    if (email !== undefined) employee.email = email ? email.trim() : null;
    if (salary !== undefined) employee.salary = salary !== '' ? parseFloat(salary) : 0;
    if (nationalId !== undefined) employee.nationalId = nationalId;
    if (isActive !== undefined) employee.isActive = isActive;
    if (password && password.trim() !== '') {
      employee.password = password; // Hook will hash it
    }

    await employee.save();

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;

    res.json({ success: true, message: "تم تحديث بيانات الموظف بنجاح", data: safeEmployee });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تحديث بيانات الموظف", error: error.message });
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
    const { username, password } = req.body;
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

    if (employee.branch && !employee.branch.isActive) {
      return res.status(403).json({ success: false, message: "الفرع التابع له غير نشط حالياً" });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    const token = jwt.sign(
      {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        branchId: employee.branchId,
        role: 'branch_employee'
      },
      process.env.JWT_SECRET || 'secretKey',
      { expiresIn: '30d' }
    );

    const safeEmployee = employee.toJSON();
    delete safeEmployee.password;

    // تسجيل الحضور التلقائي للموظف عند تسجيل الدخول
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
          branchId: employee.branchId,
          date: today,
          dayName,
          checkInTime: timeStr,
          status: 'حاضر'
        });
      } else if (!attendance.checkInTime) {
        await attendance.update({
          checkInTime: timeStr,
          status: 'حاضر'
        });
      }
      attendanceToday = attendance;
    } catch (attErr) {
      console.error("Error auto-recording attendance on login:", attErr.message);
    }

    res.json({
      success: true,
      message: `مرحباً بك ${employee.name}`,
      token,
      employee: safeEmployee,
      branch: employee.branch,
      attendance: attendanceToday
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({ success: false, message: "فشل في تسجيل الدخول", error: error.message });
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

    res.json({
      success: true,
      employee,
      branch: employee.branch
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب بيانات الموظف", error: error.message });
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

    let updatedEntries = [...existingEntries];
    let hasNew = false;

    for (const inv of invoices) {
      const invNum = inv.invoiceNumber;
      const alreadyExists = updatedEntries.some(e =>
        e.invoiceId === inv.id ||
        (e.weightAndDetails && e.weightAndDetails.includes(`فاتورة #${invNum}`))
      );

      if (!alreadyExists) {
        let itemsDesc = '';
        if (Array.isArray(inv.items)) {
          itemsDesc = inv.items.map(it => it.type).filter(Boolean).join('، ');
        }

        updatedEntries.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          invoiceId: inv.id,
          invoiceNumber: invNum,
          clientPhone: inv.customerPhone || '',
          clientName: inv.customerName || 'عميل نقدي',
          weightAndDetails: `فاتورة #${invNum}${itemsDesc ? ' (' + itemsDesc + ')' : ''}`,
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
      updatedEntries.forEach(item => {
        const s = parseFloat(item.sales) || 0;
        salesSum += s;
        if (item.isVisa) visaSum += s;
      });

      register = await BranchDailyRegister.create({
        branchId,
        employeeId: employeeId || null,
        employeeName: employeeName || '',
        date: targetDate,
        dayName: currentDayName,
        entries: updatedEntries,
        totalGrams: 0,
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
      updatedEntries.forEach(item => {
        const s = parseFloat(item.sales) || 0;
        const e = parseFloat(item.expenses) || 0;
        salesSum += s;
        expSum += e;
        if (item.isVisa) visaSum += s;
      });

      await register.update({
        entries: updatedEntries,
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

    res.status(201).json({
      success: true,
      message: "تم حفظ الفاتورة وإدراجها في السجل اليومي بنجاح",
      data: invoice
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

    if (register) {
      let formatted = register.toJSON();
      if (typeof formatted.entries === 'string') {
        try { formatted.entries = JSON.parse(formatted.entries); } catch (e) { formatted.entries = []; }
      }
      return res.json({ success: true, data: formatted });
    }

    res.json({ success: true, data: null, message: "لا يوجد سجل مسجل لهذا اليوم بعد" });
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
        entries: entries !== undefined ? entries : register.entries,
        totalGrams: totalGrams !== undefined ? totalGrams : register.totalGrams,
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
        entries: entries || [],
        totalGrams: totalGrams || 0,
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
        entries: entries !== undefined ? entries : register.entries,
        totalGrams: totalGrams !== undefined ? totalGrams : register.totalGrams,
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
        entries: entries || [],
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

