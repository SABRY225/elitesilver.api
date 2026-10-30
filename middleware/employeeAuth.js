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

    req.employee = employee;
    req.branch = employee.branch;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'جلسة العمل غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول' });
  }
};

module.exports = employeeAuth;
