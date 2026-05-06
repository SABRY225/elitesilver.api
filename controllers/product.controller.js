

const { Product } = require('../models');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
// جلب كل المنتجات مع إمكانية الفلترة حسب التصنيف
exports.getAll = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { where: { categoryId ,stock: { [Op.gt]: 0 } } } : {where:{stock: { [Op.gt]: 0 }} };
    const products = await Product.findAll({ ...filter, include: 'category' });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// البحث في المنتجات مع الفلترة والترتيب
exports.searchProducts = async (req, res) => {
  try {
    const { q, sortBy, priceRange } = req.query;
    
    let whereClause = {};
    
    // البحث النصي
    if (q) {
      whereClause = {
        [require('sequelize').Op.or]: [
          { name: { [require('sequelize').Op.like]: `%${q}%` } },
          { description: { [require('sequelize').Op.like]: `%${q}%` } }
        ]
        ,
        stock: { [require('sequelize').Op.gt]: 0 }
      };
    }
    
    // فلترة حسب نطاق السعر
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      if (max) {
        whereClause.price = { [require('sequelize').Op.between]: [min, max] };
      } else {
        whereClause.price = { [require('sequelize').Op.gte]: min };
      }
    }
    
    // تحديد الترتيب
    let order = [['createdAt', 'DESC']]; // الافتراضي: الأحدث أولاً
    if (sortBy === 'name') {
      order = [['name', 'ASC']];
    } else if (sortBy === 'price-low') {
      order = [['price', 'ASC']];
    } else if (sortBy === 'price-high') {
      order = [['price', 'DESC']];
    }
    
    const products = await Product.findAll({
      where: whereClause,
      order: order,
      include: 'category'
    });
    
    res.json(products);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.searchProductsBySuk = async (req, res) => {
  try {
    const { suk } = req.query;
    if (!suk) {
      return res.status(400).json({ message: "يرجى تقديم رقم SKU للبحث" });
    }
    const products = await Product.findOne({
      where: { sku: suk },
      attributes: ['id', 'name', 'price', 'image', 'sku','stock']
    });
    res.status(200).json(products);
  } catch (error) {
    console.error('Search by SKU error:', error);
    res.status(500).json({ message: error.message });
  }
};
// جلب منتج واحد بواسطة الـ ID
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params; // الحصول على الـ ID من الرابط

    // البحث عن المنتج في قاعدة البيانات (بفرض استخدام Mongoose)
    const product = await Product.findByPk(id);

    // التحقق مما إذا كان المنتج موجوداً
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "عذراً، هذا المنتج غير موجود."
      });
    }

    // إرجاع بيانات المنتج في حال العثور عليه
    res.status(200).json(product);

  } catch (error) {
    console.error("Error in getProduct:", error);

    // التعامل مع خطأ الـ ID غير الصالح (Format Error)
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: "معرف المنتج غير صالح."
      });
    }

    res.status(500).json({
      success: false,
      message: "حدث خطأ في السيرفر أثناء جلب بيانات المنتج."
    });
  }
};

exports.getProductByMobile = async (req, res) => {
  try {
    const { id } = req.params; // الحصول على الـ ID من الرابط

    // البحث عن المنتج في قاعدة البيانات (بفرض استخدام Mongoose)
    const product = await Product.findByPk(id);

    // التحقق مما إذا كان المنتج موجوداً
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "عذراً، هذا المنتج غير موجود."
      });
    }

    // إرجاع بيانات المنتج في حال العثور عليه
    res.status(200).json({product});

  } catch (error) {
    console.error("Error in getProduct:", error);

    // التعامل مع خطأ الـ ID غير الصالح (Format Error)
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: "معرف المنتج غير صالح."
      });
    }

    res.status(500).json({
      success: false,
      message: "حدث خطأ في السيرفر أثناء جلب بيانات المنتج."
    });
  }
};
// إضافة منتج جديد (Admin)
exports.add = async (req, res) => {
  try {
    // 1. استخراج البيانات من body
    const { 
      name, price, pricePerGram, categoryId, description, 
      weight, silverType, stoneType, stoneColor, size, stock, sku ,branch
    } = req.body;
    
    // 2. التحقق من وجود صورة رئيسية
    let imageUrl = null;
    if (req.files?.['image']?.[0]) {
      imageUrl = `uploads/${req.files['image'][0].filename}`;
    }

    // 3. معالجة الصور الإضافية (galleryImages)
    let galleryImages = [];
    if (req.files?.['galleryImages']) {
      galleryImages = req.files['galleryImages'].map(file => `uploads/${file.filename}`);
    }

    // 4. التحقق من تفرد SKU
    if (sku) {
      const existingSku = await Product.findOne({ where: { sku } });
      if (existingSku) {
        return res.status(400).json({ 
          success: false, 
          message: "رقم SKU موجود بالفعل" 
        });
      }
    }

    // 5. إنشاء المنتج في قاعدة البيانات
    const product = await Product.create({
      name,
      price,
      pricePerGram,
      categoryId,
      description,
      weight,
      silverType,
      stoneType,
      stoneColor,
      size,
      stock,
      branch,
      sku,
      image: imageUrl,
      galleryImages
    });

    res.status(201).json({
      success: true,
      message: "تم إضافة المنتج بنجاح",
      data: product
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ 
      success: false, 
      message: "خطأ في بيانات المنتج أو رفع الصور",
      error: error.message 
    });
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "المنتج غير موجود" 
      });
    }

    // تحضير البيانات المحدثة من req.body
    let updatedData = { ...req.body };

    // معالجة الصورة الرئيسية
    if (req.files?.['image']?.[0]) {
      // حذف الصورة القديمة
      if (product.image) {
        const oldImagePath = path.join(__dirname, '..', product.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      updatedData.image = `uploads/${req.files['image'][0].filename}`;
    }

    // معالجة الصور الإضافية
    if (req.files?.['galleryImages']) {
      // حذف الصور القديمة
      if (product.galleryImages && Array.isArray(product.galleryImages)) {
        product.galleryImages.forEach(imagePath => {
          const fullPath = path.join(__dirname, '..', imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }
      
      updatedData.galleryImages = req.files['galleryImages'].map(file => `uploads/${file.filename}`);
    }

    // التحقق من تفرد SKU عند التحديث
    if (updatedData.sku && updatedData.sku !== product.sku) {
      const existingSku = await Product.findOne({ 
        where: { sku: updatedData.sku } 
      });
      if (existingSku) {
        return res.status(400).json({ 
          success: false, 
          message: "رقم SKU موجود بالفعل" 
        });
      }
    }

    // تحديث المنتج
    await product.update(updatedData);
    
    res.json({
      success: true,
      message: "تم تحديث المنتج بنجاح",
      data: product
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ 
      success: false, 
      message: "خطأ في تحديث المنتج",
      error: error.message 
    });
  }
};

// حذف منتج
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "المنتج غير موجود" 
      });
    }

    // حذف الصورة الرئيسية
    if (product.image && !product.image.startsWith('http')) {
      const imagePath = path.join(__dirname, '..', product.image); 
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // حذف الصور الإضافية
    if (product.galleryImages && Array.isArray(product.galleryImages)) {
      product.galleryImages.forEach(imagePath => {
        if (!imagePath.startsWith('http')) {
          const fullPath = path.join(__dirname, '..', imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      });
    }

    // حذف السجل من قاعدة البيانات
    await product.destroy();

    res.json({ 
      success: true, 
      message: "تم حذف المنتج وجميع صوره بنجاح" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في الخادم أثناء الحذف" 
    });
  }
};