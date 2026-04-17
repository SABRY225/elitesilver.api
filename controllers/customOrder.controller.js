const { Category, CustomOrder } = require('../models');
const fs = require('fs');
const path = require('path');

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في جلب التصنيفات"
    });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "اسم التصنيف مطلوب"
      });
    }

    // معالجة الصورة
    let imageUrl = null;
    if (req.file) {
      imageUrl = `uploads/${req.file.filename}`;
    }

    const category = await Category.create({
      name,
      image: imageUrl
    });

    res.status(201).json({
      success: true,
      message: "تم إضافة التصنيف بنجاح",
      data: category
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: "خطأ في إضافة التصنيف",
      error: error.message
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "التصنيف غير موجود"
      });
    }

    const { name } = req.body;
    let imageUrl = category.image; // الصورة الحالية

    // معالجة الصورة الجديدة
    if (req.file) {
      // حذف الصورة القديمة
      if (category.image) {
        const oldImagePath = path.join(__dirname, '..', category.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      imageUrl = `uploads/${req.file.filename}`;
    }

    await category.update({
      name: name || category.name,
      image: imageUrl
    });

    res.json({
      success: true,
      message: "تم تحديث التصنيف بنجاح",
      data: category
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: "خطأ في تحديث التصنيف",
      error: error.message
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "التصنيف غير موجود"
      });
    }

    // حذف الصورة
    if (category.image && !category.image.startsWith('http')) {
      const imagePath = path.join(__dirname, '..', category.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await category.destroy();

    res.json({
      success: true,
      message: "تم حذف التصنيف بنجاح"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف التصنيف"
    });
  }
};


// 1. إنشاء طلب جديد (للعميل)
exports.createCustomOrder = async (req, res) => {
    try {
        const { customerName, customerPhone, customerAddress, description } = req.body;
        
        // التأكد من وجود صورة مرفوعة (باستخدام multer)
        if (!req.file) {
            return res.status(400).json({ message: "يرجى رفع صورة للمنتج" });
        }

        const newOrder = await CustomOrder.create({
            customerName,
            customerPhone,
            customerAddress,
            description,
            imagePath: req.file.filename // حفظ اسم الملف المرفوع
        });

        res.status(201).json({ status: 'success', data: newOrder });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 2. تعديل حالة الطلب (للمسؤول فقط)
exports.updateOrderCustomStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'new', 'reviewing', 'approved', 'completed'

        const order = await CustomOrder.findByPk(id);
        
        if (!order) {
            return res.status(404).json({ message: "الطلب غير موجود" });
        }

        // تحديث الحالة
        order.status = status;
        await order.save();

        res.status(200).json({ 
            status: 'success', 
            message: `تم تحديث حالة الطلب إلى: ${status}`,
            data: order 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 3. جلب كافة الطلبات (للمسؤول لرؤيتها في لوحة التحكم)
exports.getAllOrdersCustom = async (req, res) => {
    try {
        const orders = await CustomOrder.findAll({
            order: [['createdAt', 'DESC']] // الأحدث أولاً
        });
        res.status(200).json({ status: 'success', data: orders });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
