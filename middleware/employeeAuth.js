const jwt = require('jsonwebtoken');
const { BranchEmployee, Branch } = require('../models');
require('dotenv').config();

const employeeAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'لم يتم توفير تصريح الدخول' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await BranchEmployee.findOne({
      where: { id: decoded.id, isActive: true },
      include: [{ model: Branch, as: 'branch' }],
    });

    if (!employee) {
      return res.status(403).json({ error: 'حساب الموظف غير موجود أو غير نشط' });
    }

    // تحديد الفرع النشط لجلسة الدوام الحالية بناءً على ما اختاره الموظف عند تسجيل الدخول
    let activeBranch = employee.branch;
    if (decoded.branchId && (!employee.branch || decoded.branchId !== employee.branch.id)) {
      const b = await Branch.findByPk(decoded.branchId);
      if (b && b.isActive) {
        activeBranch = b;
      }
    }

    req.employee = employee;
    req.branch = activeBranch;
    // ضبط branchId للجلسة الحالية ليعكس الفرع الذي يداوم فيه الموظف الآن
    req.employee.branchId = activeBranch ? activeBranch.id : employee.branchId;
    req.employee.activeBranch = activeBranch;
    req.employee.homeBranchId = employee.branchId;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'جلسة العمل غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول' });
  }
};

module.exports = employeeAuth;
