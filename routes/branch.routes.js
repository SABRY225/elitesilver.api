const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const employeeAuth = require('../middleware/employeeAuth');

const {
  // Branches
  getAllBranches,
  getBranchById,
  getBranchStatistics,
  createBranch,
  updateBranch,
  deleteBranch,

  // Employees
  getAllEmployees,
  createBranchEmployee,
  updateBranchEmployee,
  deleteBranchEmployee,
  updateEmployeeTargets,
  getEmployeeTargetsPerformance,

  // Employee Auth
  employeeLogin,
  getEmployeeMe,

  // Invoices
  getNextInvoiceNumber,
  createInvoice,
  getBranchInvoices,
  deleteInvoice,

  // Daily Registers
  getTodayDailyRegister,
  saveDailyRegister,
  closeDailyRegister,
  getAllDailyRegistersForAdmin,
  updateDailyRegisterForAdmin,
  deleteDailyRegister,
  removeInvoiceFromDailyRegister,

  // Inventory Audits
  getInventoryAudits,
  createInventoryAudit,
  deleteInventoryAudit,

  // Advances
  createAdvanceRequest,
  getMyAdvanceRequests,
  getAllAdvanceRequests,
  updateAdvanceRequestStatus,

  // Attendance
  employeeLogout,
  getMyAttendance,
  getAllAttendanceForAdmin,
  updateAttendanceStatus,
  createManualAttendance,

  // Seed
  runSeedData,
} = require('../controllers/branch.controller');

// ============================
// 1. مسارات موظف الفرع (Employee Portal)
// ============================
router.post('/employee/login', employeeLogin);
router.get('/employee/me', employeeAuth, getEmployeeMe);

// الفواتير لموظف الفرع
router.get('/employee/next-invoice-number', employeeAuth, getNextInvoiceNumber);
router.post('/employee/invoices', employeeAuth, createInvoice);
router.get('/employee/invoices', employeeAuth, getBranchInvoices);

// السجل اليومي لموظف الفرع
router.get('/employee/daily-register', employeeAuth, getTodayDailyRegister);
router.post('/employee/daily-register', employeeAuth, saveDailyRegister);
router.post('/employee/daily-register/close', employeeAuth, closeDailyRegister);

// طلبات السلف لموظف الفرع
router.post('/employee/advances', employeeAuth, createAdvanceRequest);
router.get('/employee/advances', employeeAuth, getMyAdvanceRequests);

// الحضور والانصراف لموظف الفرع
router.post('/employee/logout', employeeAuth, employeeLogout);
router.get('/employee/attendance', employeeAuth, getMyAttendance);

// ============================
// 2. مسارات الإدارة (Admin Only)
// ============================
// الفروع
router.get('/admin/branches', adminAuth, getAllBranches);
router.get('/admin/branches/:id', adminAuth, getBranchById);
router.get('/admin/branches/:id/statistics', adminAuth, getBranchStatistics);
router.post('/admin/branches', adminAuth, createBranch);
router.put('/admin/branches/:id', adminAuth, updateBranch);
router.delete('/admin/branches/:id', adminAuth, deleteBranch);

// موظفي الفروع
router.get('/admin/employees', adminAuth, getAllEmployees);
router.post('/admin/employees', adminAuth, createBranchEmployee);
router.put('/admin/employees/:id', adminAuth, updateBranchEmployee);
router.delete('/admin/employees/:id', adminAuth, deleteBranchEmployee);
router.put('/admin/employees/:id/targets', adminAuth, updateEmployeeTargets);
router.get('/admin/employee-targets', adminAuth, getEmployeeTargetsPerformance);

// سجل الحضور والغياب للأدمن
router.get('/admin/attendance', adminAuth, getAllAttendanceForAdmin);
router.put('/admin/attendance/:id', adminAuth, updateAttendanceStatus);
router.post('/admin/attendance', adminAuth, createManualAttendance);

// فواتير وسجلات الفروع للأدمن
router.get('/admin/invoices', adminAuth, getBranchInvoices);
router.delete('/admin/invoices/:id', adminAuth, deleteInvoice);

router.get('/admin/daily-registers', adminAuth, getAllDailyRegistersForAdmin);
router.put('/admin/daily-registers/:id', adminAuth, updateDailyRegisterForAdmin);
router.delete('/admin/daily-registers/:id', adminAuth, deleteDailyRegister);
router.post('/admin/daily-registers/:id/remove-invoice', adminAuth, removeInvoiceFromDailyRegister);

// طلبات السلف للأدمن
router.get('/admin/advances', adminAuth, getAllAdvanceRequests);
router.put('/admin/advances/:id/status', adminAuth, updateAdvanceRequestStatus);

// سجل الجرد (للأدمن فقط)
router.get('/admin/inventory-audits', adminAuth, getInventoryAudits);
router.post('/admin/inventory-audits', adminAuth, createInventoryAudit);
router.delete('/admin/inventory-audits/:id', adminAuth, deleteInventoryAudit);

// مسار توليد البيانات التجريبية (Seed Data)
router.get('/seed', runSeedData);
router.post('/seed', runSeedData);

module.exports = router;
