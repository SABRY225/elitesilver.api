// controllers/adminController.js

const { Order, Product, Category, User, Rating, OrderSilver } = require('../models');

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = {
      // 1. الإحصائيات الأساسية
      ordersCount: await Order.count() + await OrderSilver.count(),
      categoriesCount: await Category.count(),
      productsCount: await Product.count(),
      totalSales: await Order.sum('total', { where: { status: "مكتمل" } }) + await OrderSilver.sum('total_price', { where: { status: "مكتمل" } }),
      reviewsCount:await Rating.count(),
      adminsCount:await User.count({where:{role:'admin'}}),
      clientsCount:await User.count({where:{role:'customer'}}),

      // 2. توزيع حالات الطلبات (إضافي)
      orderStatusDistribution: {
        new: await Order.count({ where: { status: 'جديد' } })+ await OrderSilver.count({ where: { status: 'جديد' } }),
        pending: await Order.count({ where: { status: 'قيد التنفيذ' } })+ await OrderSilver.count({ where: { status: 'قيد التنفيذ' } }),
        shipping: await Order.count({ where: { status: 'جاري الشحن' } }) + await OrderSilver.count({ where: { status: 'جاري الشحن' } }),
        completed: await Order.count({ where: { status: 'مكتمل' } }) + await OrderSilver.count({ where: { status: 'مكتمل' } }),
        cancelled: await Order.count({ where: { status: 'ملغي' } }) + await OrderSilver.count({ where: { status: 'ملغي' } }),
      },
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ 
      success: false,
      message: "خطأ في جلب البيانات", 
      error: error.message 
    });
  }
};

exports.getAdmins = async(req, res) => {
  try {
    const admins =await User.findAll({where:{role:"admin"}});
    res.json(admins);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "خطأ في جلب البيانات", 
      error: error.message 
    });
  }
}

exports.addAdmin = async(req,res)=>{
  try {
    const { name, email } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "الاسم والبريد الإلكتروني مطلوبان"
      });
    }

    // التحقق من وجود المسؤول بالفعل
    const existingAdmin = await User.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مستخدم بالفعل"
      });
    }

    // إنشاء مسؤول جديد
    const newAdmin = await User.create({
      name,
      email,
      role: 'admin'
    });

    res.status(201).json({
      success: true,
      message: "تم إضافة المسؤول بنجاح",
      data: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error("Add Admin Error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة المسؤول",
      error: error.message
    });
  }
}

exports.updateAdmin = async(req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    // جلب المسؤول
    const admin = await User.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "المسؤول غير موجود"
      });
    }

    // التحقق من أنه مسؤول فعلاً
    if (admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "هذا المستخدم ليس مسؤولاً"
      });
    }

    // التحقق من البريد الإلكتروني الجديد
    if (email && email !== admin.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "البريد الإلكتروني مستخدم بالفعل"
        });
      }
    }

    // تحديث البيانات
    await admin.update({
      name: name || admin.name,
      email: email || admin.email
    });

    res.json({
      success: true,
      message: "تم تحديث بيانات المسؤول بنجاح",
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error("Update Admin Error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث بيانات المسؤول",
      error: error.message
    });
  }
}

exports.getUsers = async(req, res) => {
  try {
    const users =await User.findAll({where:{role:"customer"}});
    res.json(users);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "خطأ في جلب البيانات", 
      error: error.message 
    });
  }
}

exports.deleteAdmin = async(req, res) => {
  try {
    const { id } = req.params;

    // جلب المسؤول
    const admin = await User.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "المسؤول غير موجود"
      });
    }

    // التحقق من أنه مسؤول فعلاً
    if (admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "هذا المستخدم ليس مسؤولاً"
      });
    }

    // منع حذف المسؤول الأخير (اختياري - حسب متطلبات النظام)
    const adminsCount = await User.count({ where: { role: 'admin' } });
    if (adminsCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف آخر مسؤول في النظام"
      });
    }

    // حذف المسؤول
    await admin.destroy();

    res.json({
      success: true,
      message: "تم حذف المسؤول بنجاح",
      deletedAdmin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error("Delete Admin Error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المسؤول",
      error: error.message
    });
  }
}