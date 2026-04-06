const { Category } = require('../models');
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
