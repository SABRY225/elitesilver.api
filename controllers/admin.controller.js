// controllers/adminController.js

const e = require('express');
const { Order, Product, Category, User, Rating, OrderSilver, CustomOrder, OrderCashierSystem, SpecialOrder } = require('../models');

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = {
      ordersCount: await Order.count() + await OrderSilver.count() + await OrderCashierSystem.count(),
      CustomOrdersCount: await CustomOrder.count(),
      categoriesCount: await Category.count(),
      productsCount: await Product.count(),
      totalSales: await Order.sum('total', { where: { status: "مكتمل" } }) + await OrderSilver.sum('total_price', { where: { status: "مكتمل" } }) + await OrderCashierSystem.sum('totalAmount', { where: { status: "مكتمل" } }),
      reviewsCount:await Rating.count(),
      adminsCount:await User.count({where:{role:'admin'}}),
      clientsCount:await User.count({where:{role:'customer'}}),

      orderStatusDistribution: {
        new: await Order.count({ where: { status: 'جديد' } })+ await OrderSilver.count({ where: { status: 'جديد' } }) + await OrderCashierSystem.count({ where: { status: 'new' } }),
        pending: await Order.count({ where: { status: 'قيد التنفيذ' } })+ await OrderSilver.count({ where: { status: 'قيد التنفيذ' } }) + await OrderCashierSystem.count({ where: { status: 'pending' } }),
        shipping: await Order.count({ where: { status: 'جاري الشحن' } }) + await OrderSilver.count({ where: { status: 'جاري الشحن' } }) + await OrderCashierSystem.count({ where: { status: 'shipping' } }),
        completed: await Order.count({ where: { status: 'مكتمل' } }) + await OrderSilver.count({ where: { status: 'مكتمل' } }) + await OrderCashierSystem.count({ where: { status: 'completed' } }),
        cancelled: await Order.count({ where: { status: 'ملغي' } }) + await OrderSilver.count({ where: { status: 'ملغي' } }) + await OrderCashierSystem.count({ where: { status: 'cancelled' } }),
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
exports.getAllProducts = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { where: { categoryId  } } : {};
    const products = await Product.findAll({ ...filter, include: 'category' });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getAdmins = async(req, res) => {
  try {
    const admins =await User.findAll({where:{role:"admin"}});
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "خطأ في جلب البيانات", 
      error: error.message 
    });
  }
}

exports.getAdmin = async(req, res) => {
  try {
    const { id } = req.params;
    const admin = await User.findByPk(id);

    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: "المسؤول غير موجود"
      });
    }
    res.status(200).json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        permissions: JSON.parse(admin.permissions),
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error("Get Admin Error:", error);
    res.status(500).json({  
      success: false,
      message: "خطأ في جلب بيانات المسؤول",
      error: error.message
    });
  }
};

exports.addAdmin = async(req,res)=>{
  try {
    const { name, email,permissions,phone } = req.body;

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
      role: 'admin',
      phone: phone || null,
      permissions: permissions || []
    });

    res.status(201).json({
      success: true,
      message: "تم إضافة المسؤول بنجاح",
      data: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions
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
    const { name, email ,permissions } = req.body;

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
      email: email || admin.email,
      permissions: permissions || admin.permissions
    });

    res.json({
      success: true,
      message: "تم تحديث بيانات المسؤول بنجاح",
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
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
};

// Special Orders (طلبات المناسبات والهدايا)
exports.getSpecialOrders = async (req, res) => {
  try {
    const orders = await SpecialOrder.findAll({
      order: [['id', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    console.error("Get Special Orders Error:", error);
    res.status(500).json({ success: false, message: "فشل في جلب طلبات المناسبات", error: error.message });
  }
};

exports.updateSpecialOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await SpecialOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    }
    await order.update({ status });
    res.json({ success: true, message: "تم تحديث حالة الطلب بنجاح", data: order });
  } catch (error) {
    console.error("Update Special Order Status Error:", error);
    res.status(500).json({ success: false, message: "فشل في تحديث حالة الطلب", error: error.message });
  }
};

exports.createSpecialOrder = async (req, res) => {
  try {
    const { customerName, phone, occasion, budget, description } = req.body;
    if (!customerName || !phone) {
      return res.status(400).json({ success: false, message: "اسم العميل ورقم الهاتف مطلوبان" });
    }
    const order = await SpecialOrder.create({
      customerName,
      phone,
      occasion,
      budget: budget || 0,
      description,
      status: 'جديد'
    });
    res.status(201).json({ success: true, message: "تم إنشاء طلب المناسبة بنجاح", data: order });
  } catch (error) {
    console.error("Create Special Order Error:", error);
    res.status(500).json({ success: false, message: "فشل في إنشاء الطلب", error: error.message });
  }
};

exports.deleteSpecialOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await SpecialOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    }
    await order.destroy();
    res.json({ success: true, message: "تم حذف الطلب بنجاح" });
  } catch (error) {
    console.error("Delete Special Order Error:", error);
    res.status(500).json({ success: false, message: "فشل في حذف الطلب", error: error.message });
  }
};