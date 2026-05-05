const { Category, CustomOrder, Product } = require('../models');
const fs = require('fs');
const path = require('path');
const { where } = require('sequelize');
const sendEmailNotificationToAdmin = require('../utils/sendEmailToAdmin');

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

exports.getProductsByCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // جلب المنتجات مع التأكد من ترتيبها (مثلاً الأحدث أولاً)
    const products = await Product.findAll({
      where: { categoryId: id },
      order: [['createdAt', 'DESC']] 
    });

    // إرجاع البيانات بشكل منظم
    return res.status(200).json(products);

  } catch (error) {
    console.error("Error in getProductsByCategory:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching products for this category",
      error: error.message
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
         // إرسال إشعار عبر البريد الإلكتروني للمسؤول
         const htmlContent = `
            <h2 style="color: #007bff;">طلب جديد من ${customerName}</h2>
            <p>تم استلام طلب جديد من العميل ${customerName}.</p>
            <p><strong>رقم الهاتف:</strong> ${customerPhone}</p>
            <p><strong>العنوان:</strong> ${customerAddress}</p>
            <p><strong>الوصف:</strong> ${description}</p>
            <p>يرجى مراجعة الطلب في لوحة التحكم لاتخاذ الإجراءات اللازمة.</p>
        `;
        await sendEmailNotificationToAdmin(htmlContent, "طلب جديد من العميل", htmlContent);
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

        if (order.customerEmail) {
            const statusTranslations = {
                'reviewing': 'قيد المراجعة',
                'approved': 'تمت الموافقة عليه',
                'completed': 'تم الإنجاز',
                'new': 'جديد'
            };

            const html = `
                <h2 style="color: #007bff;">تحديث بخصوص طلبك #${order.id}</h2>
                <p>عزيزي ${order.customerName}، نود إعلامك بأن حالة طلبك قد تغيرت إلى:</p>
                <div style="background: #f8f9fa; padding: 15px; border-right: 5px solid #007bff; font-weight: bold;">
                    ${statusTranslations[status] || status}
                </div>
                <p>يمكنك متابعة التفاصيل عبر حسابك في موقعنا.</p>
            `;

            await sendEmailNotification(order.customerEmail, "تحديث حالة الطلب", html)
                .catch(err => console.error("Email Error:", err));
        }

        res.status(200).json({ 
            status: 'success', 
            message: `تم تحديث حالة الطلب إلى: ${status}`,
            data: order 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.updateOrderCustomPrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body; // 'new', 'reviewing', 'approved', 'completed'

        const order = await CustomOrder.findByPk(id);
        
        if (!order) {
            return res.status(404).json({ message: "الطلب غير موجود" });
        }

        // تحديث السعر
        order.price = price;
        await order.save();

        if (order.customerEmail) {
            const html = `
                <h2 style="color: #28a745;">تحديد سعر طلبك #${order.id}</h2>
                <p>عزيزي ${order.customerName}، تم مراجعة طلبك وتحديد التكلفة النهائية:</p>
                <div style="background: #f0fff4; padding: 15px; border-right: 5px solid #28a745; font-size: 18px; font-weight: bold;">
                    السعر المطلوب: ${price} دينار أردني
                </div>
                <p>يرجى الدخول للموقع لتأكيد الطلب وبدء عملية التنفيذ.</p>
            `;

           await sendEmailNotification(order.customerEmail, "تحديد سعر الطلب", html)
                .catch(err => console.error("Email Error:", err));
        }
        
        res.status(200).json({ 
            status: 'success', 
            message: `تم تحديث السعر للطلب إلى: ${price}`,
            data: order 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 3. جلب كافة الطلبات (للمسؤول لرؤيتها في لوحة التحكم)
exports.getAllOrdersCustom = async (req, res) => {
try {
        const page = parseInt(req.query.page) || 1; // رقم الصفحة
        const limit = parseInt(req.query.limit) || 10; // عدد الطلبات في الصفحة
        const offset = (page - 1) * limit;

        const orders = await CustomOrder.findAndCountAll({
            limit: limit,
            offset: offset,
            order: [['createdAt', 'DESC']] // الأحدث أولاً
        });

        res.status(200).json({
            totalItems: orders.count,
            totalPages: Math.ceil(orders.count / limit),
            currentPage: page,
            data: orders.rows
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
