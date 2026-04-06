// controllers/rating.controller.js
const { Rating, Product, User } = require('../models');

// إضافة تقييم جديد للمنتج
exports.addRating = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user?.id; // من middleware الحماية

    // التحقق من وجود المنتج
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "المنتج غير موجود" 
      });
    }

    // التحقق من صحة التقييم (1-5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "التقييم يجب أن يكون بين 1 و 5" 
      });
    }

    // التحقق من عدم تكرار التقييم من نفس المستخدم
    const existingRating = await Rating.findOne({
      where: { userId, productId }
    });

    if (existingRating) {
      return res.status(400).json({ 
        success: false, 
        message: "لقد قمت بتقييم هذا المنتج بالفعل" 
      });
    }

    // إنشاء التقييم
    const newRating = await Rating.create({
      userId,
      productId,
      rating,
      comment
    });

    res.status(201).json({
      success: true,
      message: "تم إضافة التقييم بنجاح",
      data: newRating
    });
  } catch (error) {
    console.error("Error adding rating:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في إضافة التقييم" 
    });
  }
};

// جلب جميع التقييمات لمنتج معين
exports.getProductRatings = async (req, res) => {
  try {
    const { productId } = req.params;

    const ratings = await Rating.findAll({
      where: { productId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // حساب متوسط التقييم
    const averageRating = ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      averageRating,
      totalRatings: ratings.length,
      ratings
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في جلب التقييمات" 
    });
  }
};

// تحديث تقييم
exports.updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?.id;

    // جلب التقييم
    const existingRating = await Rating.findByPk(ratingId);
    if (!existingRating) {
      return res.status(404).json({ 
        success: false, 
        message: "التقييم غير موجود" 
      });
    }

    // التحقق من ملكية التقييم
    if (existingRating.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "لا يمكنك تعديل تقييم لا ينتمي إليك" 
      });
    }

    // تحديث التقييم
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ 
          success: false, 
          message: "التقييم يجب أن يكون بين 1 و 5" 
        });
      }
      existingRating.rating = rating;
    }

    if (comment) {
      existingRating.comment = comment;
    }

    await existingRating.save();

    res.json({
      success: true,
      message: "تم تحديث التقييم بنجاح",
      data: existingRating
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في تحديث التقييم" 
    });
  }
};

// حذف تقييم
exports.deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // جلب التقييم
    const rating = await Rating.findByPk(ratingId);
    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        message: "التقييم غير موجود" 
      });
    }

    // التحقق من الصلاحيات (المالك أو المدير فقط)
    if (rating.userId !== userId && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "لا يمكنك حذف هذا التقييم" 
      });
    }

    await rating.destroy();

    res.json({
      success: true,
      message: "تم حذف التقييم بنجاح"
    });
  } catch (error) {
    console.error("Error deleting rating:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في حذف التقييم" 
    });
  }
};

// جلب تقييمات المستخدم
exports.getUserRatings = async (req, res) => {
  try {
    const userId = req.user?.id;

    const ratings = await Rating.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'image']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      ratings
    });
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في جلب تقييماتك" 
    });
  }
};


exports.getReviewsAdmin= async (req, res) => {
  try {
    const reviews = await Rating.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'] // جلب البيانات الهامة فقط للأمان
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'image'] // جلب اسم المنتج وصورته
        }
      ],
      order: [['createdAt', 'DESC']] // ترتيب من الأحدث للأقدم
    });

    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب التقييمات' });
  }
}

exports.deleteRatingByAdmin = async (req, res) => {
  try {
    await Rating.destroy({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف التقييم بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'فشل حذف التقييم' });
  }
}